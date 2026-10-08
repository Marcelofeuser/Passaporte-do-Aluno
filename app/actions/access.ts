'use server'

import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accessDevice, student, studentAccessLog, studentCredential } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { runAction, requireSchoolAction, UUID_RE } from '@/lib/school-action'
import type { ActionState } from '@/lib/validation'
import { toFieldErrors } from '@/lib/validation'

const DEVICE_INPUT = z.object({
  name: z.string().trim().min(3, 'Informe o nome do dispositivo').max(120),
  location: z.string().trim().max(160).nullish().transform((v) => v || null),
})

/** Cria um dispositivo de portaria e devolve a deviceKey (exibida UMA única vez; só o hash fica). */
export async function createAccessDevice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('access.device_create', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_access')
    const parsed = DEVICE_INPUT.safeParse({
      name: formData.get('name'),
      location: formData.get('location') || null,
    })
    if (!parsed.success) {
      return { ok: false, message: 'Verifique os campos destacados.', fieldErrors: toFieldErrors(parsed.error) }
    }
    const deviceKey = randomBytes(24).toString('hex')
    const deviceKeyHash = createHash('sha256').update(deviceKey).digest('hex')
    const [row] = await db
      .insert(accessDevice)
      .values({ schoolId, name: parsed.data.name, location: parsed.data.location, deviceKeyHash, createdBy: userId })
      .returning({ id: accessDevice.id })

    await recordAudit({
      action: 'access.device_created',
      entityType: 'access_device',
      entityId: row?.id ?? null,
      schoolId,
      actorUserId: userId,
      metadata: { name: parsed.data.name },
    })
    revalidatePath('/school/access')
    return { ok: true, message: `Dispositivo criado. Guarde esta chave — ela não será exibida novamente: ${deviceKey}` }
  })
}

/** Revoga (soft delete) um dispositivo. */
export async function revokeAccessDevice(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('access.device_revoke', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_access')
    const deviceId = String(formData.get('deviceId') ?? '')
    if (!UUID_RE.test(deviceId)) return { ok: false, message: 'Dispositivo inválido.' }
    await db
      .update(accessDevice)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(and(eq(accessDevice.schoolId, schoolId), eq(accessDevice.id, deviceId), isNull(accessDevice.deletedAt)))
    await recordAudit({
      action: 'access.device_revoked',
      entityType: 'access_device',
      entityId: deviceId,
      schoolId,
      actorUserId: userId,
      metadata: {},
    })
    revalidatePath('/school/access')
    return { ok: true, message: 'Dispositivo revogado.' }
  })
}

const CREDENTIAL_INPUT = z.object({
  studentId: z.string().trim().regex(UUID_RE, 'Aluno inválido'),
  nfcCardUid: z.string().trim().max(64).nullish().transform((v) => v || null),
  facialProfileId: z.string().trim().max(128).nullish().transform((v) => v || null),
  consent: z.string().optional(),
})

/** Vincula/troca credenciais do aluno. Biometria facial exige consentimento registrado (LGPD). */
export async function upsertCredential(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('access.credential_upsert', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_access')
    const parsed = CREDENTIAL_INPUT.safeParse({
      studentId: formData.get('studentId'),
      nfcCardUid: formData.get('nfcCardUid') || null,
      facialProfileId: formData.get('facialProfileId') || null,
      consent: formData.get('consent'),
    })
    if (!parsed.success) {
      return { ok: false, message: 'Verifique os campos destacados.', fieldErrors: toFieldErrors(parsed.error) }
    }
    const data = parsed.data
    if (!data.nfcCardUid && !data.facialProfileId) {
      return { ok: false, message: 'Informe o UID do cartão NFC ou o ID facial.' }
    }
    const [stu] = await db
      .select({ id: student.id })
      .from(student)
      .where(and(eq(student.schoolId, schoolId), eq(student.id, data.studentId), isNull(student.deletedAt)))
      .limit(1)
    if (!stu) return { ok: false, message: 'Aluno não encontrado nesta escola.' }
    if (data.facialProfileId && !data.consent) {
      return { ok: false, message: 'Biometria facial exige o consentimento do responsável (LGPD).' }
    }
    await db
      .insert(studentCredential)
      .values({
        schoolId,
        studentId: data.studentId,
        nfcCardUid: data.nfcCardUid,
        facialProfileId: data.facialProfileId,
        consentAt: data.consent ? new Date() : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: studentCredential.studentId,
        set: {
          nfcCardUid: data.nfcCardUid,
          facialProfileId: data.facialProfileId,
          consentAt: data.consent ? new Date() : null,
          updatedAt: new Date(),
        },
      })
    await recordAudit({
      action: 'access.credential_updated',
      entityType: 'student_credential',
      entityId: data.studentId,
      schoolId,
      actorUserId: userId,
      metadata: { nfc: Boolean(data.nfcCardUid), facial: Boolean(data.facialProfileId), consent: Boolean(data.consent) },
    })
    revalidatePath('/school/access')
    return { ok: true, message: 'Credencial salva.' }
  })
}

const MANUAL_INPUT = z.object({
  studentId: z.string().trim().regex(UUID_RE, 'Aluno inválido'),
  type: z.enum(['ENTRADA', 'SAIDA'], 'Tipo inválido'),
})

/** Registro manual pela portaria (aluno sem credencial/cartão esquecido). */
export async function manualAccessLog(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('access.manual_log', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_access')
    const parsed = MANUAL_INPUT.safeParse({ studentId: formData.get('studentId'), type: formData.get('type') })
    if (!parsed.success) {
      return { ok: false, message: 'Verifique os campos destacados.', fieldErrors: toFieldErrors(parsed.error) }
    }
    const [stu] = await db
      .select({ id: student.id })
      .from(student)
      .where(and(eq(student.schoolId, schoolId), eq(student.id, parsed.data.studentId), isNull(student.deletedAt)))
      .limit(1)
    if (!stu) return { ok: false, message: 'Aluno não encontrado nesta escola.' }
    await db.insert(studentAccessLog).values({
      schoolId,
      studentId: parsed.data.studentId,
      method: 'MANUAL',
      type: parsed.data.type,
      metadata: { byUserId: userId },
    })
    await recordAudit({
      action: 'access.manual_logged',
      entityType: 'student_access_log',
      schoolId,
      actorUserId: userId,
      metadata: { studentId: parsed.data.studentId, type: parsed.data.type },
    })
    revalidatePath('/school/access')
    revalidatePath('/family/access')
    return { ok: true, message: 'Acesso registrado manualmente.' }
  })
}
