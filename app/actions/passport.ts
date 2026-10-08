'use server'

import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { student } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { runAction, requireSchoolAction, UUID_RE } from '@/lib/school-action'
import type { ActionState } from '@/lib/validation'

/**
 * Token do passaporte: 192 bits aleatórios, armazenado em coluna única (o QR precisa ser
 * re-renderizado na carteirinha da família, então não pode guardar só o hash).
 * Lookup sempre por igualdade exata — não enumerável.
 */

/** Emite (ou reemite) o passaporte digital do aluno. O token anterior deixa de valer. */
export async function issuePassport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('passport.issue', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_access')
    const studentId = String(formData.get('studentId') ?? '')
    if (!UUID_RE.test(studentId)) return { ok: false, message: 'Aluno inválido.' }

    const [stu] = await db
      .select({ id: student.id })
      .from(student)
      .where(and(eq(student.schoolId, schoolId), eq(student.id, studentId), isNull(student.deletedAt)))
      .limit(1)
    if (!stu) return { ok: false, message: 'Aluno não encontrado nesta escola.' }

    const token = randomBytes(24).toString('hex')
    await db
      .update(student)
      .set({ passportToken: token, passportActive: true, passportUpdatedAt: new Date() })
      .where(and(eq(student.schoolId, schoolId), eq(student.id, studentId)))

    await recordAudit({
      action: 'passport.issued',
      entityType: 'student',
      entityId: studentId,
      schoolId,
      actorUserId: userId,
      metadata: {},
    })
    revalidatePath('/school/passport')
    revalidatePath('/family/passport')
    return {
      ok: true,
      message: `Passaporte emitido. Token para carteirinha impressa (use uma única vez): ${token}`,
    }
  })
}

/** Revoga o passaporte (carteirinha perdida/trocada): token invalidado imediatamente. */
export async function revokePassport(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('passport.revoke', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_access')
    const studentId = String(formData.get('studentId') ?? '')
    if (!UUID_RE.test(studentId)) return { ok: false, message: 'Aluno inválido.' }

    await db
      .update(student)
      .set({ passportActive: false, passportUpdatedAt: new Date() })
      .where(and(eq(student.schoolId, schoolId), eq(student.id, studentId)))

    await recordAudit({
      action: 'passport.revoked',
      entityType: 'student',
      entityId: studentId,
      schoolId,
      actorUserId: userId,
      metadata: {},
    })
    revalidatePath('/school/passport')
    revalidatePath('/family/passport')
    return { ok: true, message: 'Passaporte revogado.' }
  })
}
