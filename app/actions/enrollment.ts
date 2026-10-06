"use server";

import { db } from "@/lib/db";
import { schoolEnrollment, academicHistory } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";

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

        const [newEnrollment] = await db.insert(schoolEnrollment).values({
            schoolId: data.schoolId,
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
            .where(and(eq(schoolEnrollment.id, enrollmentId), eq(schoolEnrollment.schoolId, schoolId)))
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
        const [historyRecord] = await db.insert(academicHistory).values({
            schoolId: data.schoolId,
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