"use server";

import { db } from "@/lib/db";
import { academicHistory, academicYear, schoolClass, schoolEnrollment } from "@/lib/db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recordAudit } from "@/lib/audit";
import { requireSchoolAction } from "@/lib/school-action";
import { isCurrentPassportStudent } from "@/lib/student-passport-access";

async function authorizeCurrentStudent(schoolId: string, studentId: string, operation: string) {
    const { schoolId: activeSchoolId, userId } = await requireSchoolAction("school:manage_academic");
    if (activeSchoolId !== schoolId) return { ok: false as const, error: "Escola inválida.", userId };
    if (!(await isCurrentPassportStudent(activeSchoolId, studentId))) {
        await recordAudit({
            action: "student.edit_blocked",
            entityType: "student",
            entityId: studentId,
            schoolId: activeSchoolId,
            actorUserId: userId,
            metadata: { operation },
        });
        return { ok: false as const, error: "Este período escolar é somente para leitura.", userId };
    }
    return { ok: true as const, schoolId: activeSchoolId, userId };
}

interface EnrollmentInput {
    schoolId: string;
    studentId: string;
    academicYearId: string;
    classId?: string;
    enrollmentType?: "new" | "renewal" | "transfer";
    notes?: string;
}

/**
 * Cria ou solicita uma nova matrícula/rematrícula
 */
export async function createEnrollment(data: EnrollmentInput) {
    try {
        if (!data.schoolId || !data.studentId || !data.academicYearId) {
            return { success: false, error: "Preencha todos os campos obrigatórios da matrícula." };
        }
        const authorization = await authorizeCurrentStudent(data.schoolId, data.studentId, "enrollment.create");
        if (!authorization.ok) return { success: false, error: authorization.error };
        const [year] = await db
            .select({ id: academicYear.id })
            .from(academicYear)
            .where(and(eq(academicYear.id, data.academicYearId), eq(academicYear.schoolId, authorization.schoolId), isNull(academicYear.deletedAt)))
            .limit(1);
        if (!year) return { success: false, error: "Ano letivo inválido para esta escola." };
        if (data.classId) {
            const [classRow] = await db
                .select({ id: schoolClass.id })
                .from(schoolClass)
                .where(and(eq(schoolClass.id, data.classId), eq(schoolClass.schoolId, authorization.schoolId), isNull(schoolClass.deletedAt)))
                .limit(1);
            if (!classRow) return { success: false, error: "Turma inválida para esta escola." };
        }

        const [newEnrollment] = await db.insert(schoolEnrollment).values({
            schoolId: authorization.schoolId,
            studentId: data.studentId,
            academicYearId: data.academicYearId,
            classId: data.classId || null,
            status: "pending",
            enrollmentType: data.enrollmentType || "new",
            contractAccepted: false,
            financialCleared: false,
            documentsCleared: false,
            notes: data.notes || null,
        }).returning();

        revalidatePath("/school/enrollments");
        return { success: true, data: newEnrollment };
    } catch (error: any) {
        console.error("Erro ao criar matrícula:", error);
        return { success: false, error: error.message || "Erro ao processar matrícula." };
    }
}

/**
 * Atualiza o status de aprovação, financeiro ou documental da matrícula
 */
export async function updateEnrollmentStatus(
    enrollmentId: string,
    schoolId: string,
    updates: {
        status?: string;
        contractAccepted?: boolean;
        financialCleared?: boolean;
        documentsCleared?: boolean;
        classId?: string;
        notes?: string;
    }
) {
    try {
        const { schoolId: activeSchoolId, userId } = await requireSchoolAction("school:manage_academic");
        if (activeSchoolId !== schoolId) return { success: false, error: "Escola inválida." };
        const [enrollmentRow] = await db
            .select({ studentId: schoolEnrollment.studentId })
            .from(schoolEnrollment)
            .where(and(eq(schoolEnrollment.id, enrollmentId), eq(schoolEnrollment.schoolId, activeSchoolId)))
            .limit(1);
        if (!enrollmentRow) return { success: false, error: "Matrícula não encontrada." };
        if (!(await isCurrentPassportStudent(activeSchoolId, enrollmentRow.studentId))) {
            await recordAudit({
                action: "student.edit_blocked",
                entityType: "student",
                entityId: enrollmentRow.studentId,
                schoolId: activeSchoolId,
                actorUserId: userId,
                metadata: { operation: "enrollment.update" },
            });
            return { success: false, error: "Este período escolar é somente para leitura." };
        }
        if (updates.classId) {
            const [classRow] = await db
                .select({ id: schoolClass.id })
                .from(schoolClass)
                .where(and(eq(schoolClass.id, updates.classId), eq(schoolClass.schoolId, activeSchoolId), isNull(schoolClass.deletedAt)))
                .limit(1);
            if (!classRow) return { success: false, error: "Turma inválida para esta escola." };
        }
        const updateData: any = { updatedAt: new Date() };

        if (updates.status) updateData.status = updates.status;
        if (updates.contractAccepted !== undefined) {
            updateData.contractAccepted = updates.contractAccepted;
            if (updates.contractAccepted) updateData.contractAcceptedAt = new Date();
        }
        if (updates.financialCleared !== undefined) updateData.financialCleared = updates.financialCleared;
        if (updates.documentsCleared !== undefined) updateData.documentsCleared = updates.documentsCleared;
        if (updates.classId !== undefined) updateData.classId = updates.classId;
        if (updates.notes !== undefined) updateData.notes = updates.notes;

        const [updated] = await db
            .update(schoolEnrollment)
            .set(updateData)
            .where(and(eq(schoolEnrollment.id, enrollmentId), eq(schoolEnrollment.schoolId, activeSchoolId)))
            .returning();

        if (!updated) {
            return { success: false, error: "Matrícula não encontrada." };
        }

        revalidatePath("/school/enrollments");
        return { success: true, data: updated };
    } catch (error: any) {
        console.error("Erro ao atualizar status da matrícula:", error);
        return { success: false, error: error.message || "Erro ao atualizar matrícula." };
    }
}

/**
 * Regista o histórico acadêmico ou resultado de fim de ano do aluno
 */
export async function createAcademicHistoryRecord(data: {
    schoolId: string;
    studentId: string;
    academicYearId: string;
    gradeLevel: string;
    result: "promoted" | "retained" | "transferred";
    finalAverage?: number;
    attendanceRate?: number;
    institutionName?: string;
    notes?: string;
}) {
    try {
        const authorization = await authorizeCurrentStudent(data.schoolId, data.studentId, "academic_history.create");
        if (!authorization.ok) return { success: false, error: authorization.error };
        const [year] = await db
            .select({ id: academicYear.id })
            .from(academicYear)
            .where(and(eq(academicYear.id, data.academicYearId), eq(academicYear.schoolId, authorization.schoolId), isNull(academicYear.deletedAt)))
            .limit(1);
        if (!year) return { success: false, error: "Ano letivo inválido para esta escola." };
        const [historyRecord] = await db.insert(academicHistory).values({
            schoolId: authorization.schoolId,
            studentId: data.studentId,
            academicYearId: data.academicYearId,
            gradeLevel: data.gradeLevel,
            result: data.result,
            finalAverage: data.finalAverage ? data.finalAverage.toString() as any : null,
            attendanceRate: data.attendanceRate ? data.attendanceRate.toString() as any : null,
            institutionName: data.institutionName || null,
            notes: data.notes || null,
        }).returning();

        revalidatePath("/school/academic-history");
        return { success: true, data: historyRecord };
    } catch (error: any) {
        console.error("Erro ao registar histórico acadêmico:", error);
        return { success: false, error: error.message || "Erro ao registar histórico acadêmico." };
    }
}
