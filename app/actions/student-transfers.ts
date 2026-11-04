'use server'

import { and, desc, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { enrollment, school, student, studentPassport, studentTransfer } from '@/lib/db/schema'
import { requireSchoolAction, runAction } from '@/lib/school-action'
import {
  formText,
  studentTransferDecisionInput,
  studentTransferInput,
  toFieldErrors,
  type ActionState,
} from '@/lib/validation'

const MANAGE_STUDENTS = 'school:manage_academic' as const
const today = () => new Date().toISOString().slice(0, 10)

export async function requestStudentTransfer(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('student_transfer.request_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE_STUDENTS)
    const parsed = studentTransferInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const { studentId, destinationSchoolId } = parsed.data
    if (schoolId === destinationSchoolId) {
      return { ok: false, fieldErrors: { destinationSchoolId: 'Escolha outra escola.' } }
    }

    const outcome = await db.transaction(async (tx) => {
      const [source] = await tx
        .select({
          id: student.id,
          passportId: student.passportId,
          currentSchoolId: studentPassport.currentSchoolId,
          currentStudentId: studentPassport.currentStudentId,
        })
        .from(student)
        .innerJoin(studentPassport, eq(studentPassport.id, student.passportId))
        .where(and(eq(student.id, studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt)))
        .for('update')
      if (!source || !source.passportId) {
        return { ok: false as const, message: 'Aluno não encontrado.' }
      }
      if (source.currentSchoolId !== schoolId || source.currentStudentId !== studentId) {
        await recordAudit({
          action: 'student.edit_blocked',
          entityType: 'student',
          entityId: studentId,
          schoolId,
          actorUserId: userId,
          metadata: { operation: 'transfer.request', currentSchoolId: source.currentSchoolId },
        })
        return { ok: false as const, message: 'Somente a escola responsável atual pode solicitar a transferência.' }
      }

      const [destination] = await tx
        .select({ id: school.id })
        .from(school)
        .where(and(eq(school.id, destinationSchoolId), isNull(school.deletedAt)))
        .limit(1)
      if (!destination) {
        return { ok: false as const, fieldErrors: { destinationSchoolId: 'Escola de destino não encontrada.' } }
      }

      const [pending] = await tx
        .select({ id: studentTransfer.id })
        .from(studentTransfer)
        .where(and(eq(studentTransfer.passportId, source.passportId), eq(studentTransfer.status, 'PENDING')))
        .limit(1)
      if (pending) return { ok: false as const, message: 'Já existe uma solicitação pendente para este aluno.' }

      const [transfer] = await tx
        .insert(studentTransfer)
        .values({
          passportId: source.passportId,
          fromSchoolId: schoolId,
          toSchoolId: destinationSchoolId,
          fromStudentId: studentId,
          requestedBy: userId,
        })
        .returning({ id: studentTransfer.id })
      return { ok: true as const, transferId: transfer.id, passportId: source.passportId }
    })

    if (!outcome.ok) return outcome
    await recordAudit({
      action: 'student_transfer.requested',
      entityType: 'student_passport',
      entityId: outcome.passportId,
      schoolId,
      actorUserId: userId,
      metadata: { transferId: outcome.transferId, destinationSchoolId },
    })
    revalidatePath(`/school/students/${studentId}`)
    revalidatePath('/school/transfers')
    return { ok: true, message: 'Solicitação enviada. A escola de destino precisa confirmar o recebimento.' }
  })
}

export async function acceptStudentTransfer(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('student_transfer.accept_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE_STUDENTS)
    const parsed = studentTransferDecisionInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const { transferId } = parsed.data

    const outcome = await db.transaction(async (tx) => {
      const [unlocked] = await tx
        .select({ passportId: studentTransfer.passportId })
        .from(studentTransfer)
        .where(eq(studentTransfer.id, transferId))
        .limit(1)
      if (!unlocked) return { ok: false as const, message: 'Solicitação não encontrada.' }

      const [passport] = await tx
        .select()
        .from(studentPassport)
        .where(eq(studentPassport.id, unlocked.passportId))
        .for('update')
      if (!passport) return { ok: false as const, message: 'Passaporte não encontrado.' }

      const [transfer] = await tx
        .select()
        .from(studentTransfer)
        .where(eq(studentTransfer.id, transferId))
        .for('update')
      if (!transfer || transfer.toSchoolId !== schoolId || transfer.status !== 'PENDING') {
        return { ok: false as const, message: 'Solicitação pendente não encontrada para esta escola.' }
      }
      if (passport.currentSchoolId !== transfer.fromSchoolId || passport.currentStudentId !== transfer.fromStudentId) {
        return { ok: false as const, message: 'O vínculo de origem mudou. Solicite uma nova transferência.' }
      }

      const [source] = await tx
        .select({
          fullName: student.fullName,
          socialName: student.socialName,
          birthDate: student.birthDate,
          sex: student.sex,
          cpf: student.cpf,
        })
        .from(student)
        .where(
          and(
            eq(student.id, transfer.fromStudentId),
            eq(student.schoolId, transfer.fromSchoolId),
            eq(student.passportId, transfer.passportId),
            isNull(student.deletedAt),
          ),
        )
        .limit(1)
      if (!source) return { ok: false as const, message: 'O cadastro de origem não está disponível.' }

      const [destination] = await tx
        .select({ name: school.name })
        .from(school)
        .where(and(eq(school.id, schoolId), isNull(school.deletedAt)))
        .limit(1)
      if (!destination) return { ok: false as const, message: 'Escola de destino não encontrada.' }

      const [existingProfile] = await tx
        .select({ id: student.id })
        .from(student)
        .where(and(eq(student.passportId, transfer.passportId), eq(student.schoolId, schoolId)))
        .orderBy(desc(student.createdAt))
        .limit(1)
      let destinationStudentId: string
      if (existingProfile) {
        destinationStudentId = existingProfile.id
      } else {
        const [created] = await tx
          .insert(student)
          .values({
            schoolId,
            passportId: transfer.passportId,
            fullName: source.fullName,
            socialName: source.socialName,
            birthDate: source.birthDate,
            sex: source.sex,
            cpf: source.cpf,
          })
          .returning({ id: student.id })
        destinationStudentId = created.id
      }

      const resolvedAt = new Date()
      await tx
        .update(enrollment)
        .set({
          status: 'TRANSFERRED',
          statusChangedOn: today(),
          statusNote: `Transferência recebida por ${destination.name}`.slice(0, 300),
          updatedAt: resolvedAt,
        })
        .where(
          and(
            eq(enrollment.schoolId, transfer.fromSchoolId),
            eq(enrollment.studentId, transfer.fromStudentId),
            eq(enrollment.status, 'ACTIVE'),
          ),
        )

      await tx
        .update(studentPassport)
        .set({ currentSchoolId: schoolId, currentStudentId: destinationStudentId, updatedAt: resolvedAt })
        .where(eq(studentPassport.id, transfer.passportId))
      if (existingProfile) {
        await tx
          .update(student)
          .set({
            fullName: source.fullName,
            socialName: source.socialName,
            birthDate: source.birthDate,
            sex: source.sex,
            cpf: source.cpf,
            deletedAt: null,
            updatedAt: resolvedAt,
          })
          .where(and(eq(student.id, destinationStudentId), eq(student.schoolId, schoolId)))
      }

      await tx
        .update(studentTransfer)
        .set({
          status: 'ACCEPTED',
          toStudentId: destinationStudentId,
          resolvedBy: userId,
          resolvedAt,
        })
        .where(and(eq(studentTransfer.id, transfer.id), eq(studentTransfer.status, 'PENDING')))

      return {
        ok: true as const,
        passportId: transfer.passportId,
        fromSchoolId: transfer.fromSchoolId,
        fromStudentId: transfer.fromStudentId,
        destinationStudentId,
      }
    })

    if (!outcome.ok) return outcome
    await recordAudit({
      action: 'student_transfer.accepted',
      entityType: 'student_passport',
      entityId: outcome.passportId,
      schoolId,
      actorUserId: userId,
      metadata: { transferId, fromSchoolId: outcome.fromSchoolId, toStudentId: outcome.destinationStudentId },
    })
    revalidatePath('/school/transfers')
    revalidatePath(`/school/students/${outcome.fromStudentId}`)
    revalidatePath(`/school/students/${outcome.destinationStudentId}`)
    return { ok: true, message: 'Transferência confirmada. A escola agora é responsável pelo período atual.' }
  })
}

async function resolveTransfer(
  transferId: string,
  schoolId: string,
  userId: string,
  status: 'REJECTED' | 'CANCELLED',
): Promise<ActionState> {
  const outcome = await db.transaction(async (tx) => {
    const [unlocked] = await tx
      .select({ passportId: studentTransfer.passportId })
      .from(studentTransfer)
      .where(eq(studentTransfer.id, transferId))
      .limit(1)
    if (!unlocked) return { ok: false as const, message: 'Solicitação não encontrada.' }

    const [passport] = await tx
      .select()
      .from(studentPassport)
      .where(eq(studentPassport.id, unlocked.passportId))
      .for('update')
    const [transfer] = await tx
      .select()
      .from(studentTransfer)
      .where(eq(studentTransfer.id, transferId))
      .for('update')
    if (!passport || !transfer || transfer.status !== 'PENDING') {
      return { ok: false as const, message: 'Solicitação pendente não encontrada.' }
    }

    const authorizedSchool = status === 'REJECTED' ? transfer.toSchoolId : transfer.fromSchoolId
    if (authorizedSchool !== schoolId) {
      return { ok: false as const, message: 'Você não pode resolver esta solicitação.' }
    }
    if (passport.currentSchoolId !== transfer.fromSchoolId || passport.currentStudentId !== transfer.fromStudentId) {
      return { ok: false as const, message: 'O vínculo de origem mudou. Solicite uma nova transferência.' }
    }

    const resolvedAt = new Date()
    await tx
      .update(studentTransfer)
      .set({ status, resolvedBy: userId, resolvedAt })
      .where(and(eq(studentTransfer.id, transferId), eq(studentTransfer.status, 'PENDING')))
    return {
      ok: true as const,
      passportId: transfer.passportId,
      fromStudentId: transfer.fromStudentId,
      fromSchoolId: transfer.fromSchoolId,
      toSchoolId: transfer.toSchoolId,
    }
  })
  if (!outcome.ok) return outcome

  await recordAudit({
    action: status === 'REJECTED' ? 'student_transfer.rejected' : 'student_transfer.cancelled',
    entityType: 'student_passport',
    entityId: outcome.passportId,
    schoolId,
    actorUserId: userId,
    metadata: { transferId, fromSchoolId: outcome.fromSchoolId, toSchoolId: outcome.toSchoolId },
  })
  revalidatePath('/school/transfers')
  revalidatePath(`/school/students/${outcome.fromStudentId}`)
  return {
    ok: true,
    message: status === 'REJECTED' ? 'Solicitação recusada.' : 'Solicitação cancelada.',
  }
}

export async function rejectStudentTransfer(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('student_transfer.reject_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE_STUDENTS)
    const parsed = studentTransferDecisionInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    return resolveTransfer(parsed.data.transferId, schoolId, userId, 'REJECTED')
  })
}

export async function cancelStudentTransfer(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('student_transfer.cancel_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE_STUDENTS)
    const parsed = studentTransferDecisionInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    return resolveTransfer(parsed.data.transferId, schoolId, userId, 'CANCELLED')
  })
}
