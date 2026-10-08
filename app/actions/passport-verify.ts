'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { passportVerification, student } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { runAction, requireSchoolAction } from '@/lib/school-action'
import type { ActionState } from '@/lib/validation'

export type VerifyResult = {
  ok: boolean
  status: 'VALID' | 'REVOKED' | 'NOT_FOUND'
  studentName?: string
  socialName?: string | null
  registrationCode?: string | null
  message: string
}

/** Validação em duas etapas (consulta → registro): consulta o token sem gravar leitura. */
export async function lookupPassport(token: string): Promise<VerifyResult> {
  const clean = token.trim().replace(/^.*[?&]token=/, '')
  if (clean.length < 16) {
    return { ok: false, status: 'NOT_FOUND', message: 'Código muito curto ou inválido.' }
  }
  const [row] = await db
    .select({
      studentId: student.id,
      fullName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
      passportActive: student.passportActive,
      schoolId: student.schoolId,
    })
    .from(student)
    .where(eq(student.passportToken, clean))
    .limit(1)
  if (!row) return { ok: false, status: 'NOT_FOUND', message: 'Passaporte não encontrado.' }
  if (!row.passportActive) return { ok: false, status: 'REVOKED', message: 'Passaporte revogado pela escola.' }
  return {
    ok: true,
    status: 'VALID',
    studentName: row.fullName,
    socialName: row.socialName,
    registrationCode: row.registrationCode,
    message: 'Passaporte válido.',
  }
}

/** Confirma a leitura: grava a verificação (auditoria) para o token válido/revogado. */
export async function confirmPassportVerification(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('passport.verify', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:view_access')
    const token = String(formData.get('token') ?? '')
    const result = await lookupPassport(token)
    if (result.status === 'NOT_FOUND') {
      return { ok: false, message: result.message }
    }

    const clean = token.trim().replace(/^.*[?&]token=/, '')
    const [row] = await db
      .select({ studentId: student.id, schoolId: student.schoolId })
      .from(student)
      .where(eq(student.passportToken, clean))
      .limit(1)

    // Tenant check: só registra verificação de aluno da escola do validador.
    if (!row || row.schoolId !== schoolId) {
      return { ok: false, message: 'Passaporte pertence a outra escola.' }
    }

    await db.insert(passportVerification).values({
      schoolId,
      studentId: row.studentId,
      verifierUserId: userId,
      status: result.status,
    })
    await recordAudit({
      action: 'passport.verified',
      entityType: 'passport_verification',
      entityId: row.studentId,
      schoolId,
      actorUserId: userId,
      metadata: { status: result.status },
    })
    revalidatePath('/school/passport/verify')
    return { ok: result.ok, message: result.message }
  })
}
