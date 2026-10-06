'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import {
  notification,
  occurrence,
  occurrenceAction,
  occurrenceAudit,
  occurrenceType,
  school,
  schoolClass,
  student,
} from '@/lib/db/schema'
import { getGuardianRecipients } from '@/lib/attendance-queries'
import {
  countOccurrencesInCurrentBimester,
  getOccurrenceById,
  hasRecentNotification,
  listCriticalAlertRecipients,
} from '@/lib/occurrence-queries'
import { requireSchoolAction, runAction, runVoidAction, UUID_RE } from '@/lib/school-action'
import {
  formText,
  occurrenceActionInput,
  occurrenceInput,
  occurrenceTypeInput,
  occurrenceUpdateInput,
  toFieldErrors,
  type ActionState,
} from '@/lib/validation'

const TYPE_PERMISSION = 'school:manage_academic' as const
const OCC_PERMISSION = 'school:manage_attendance' as const

function parseOccurredAt(value: string) {
  const normalized = value.length === 10 ? `${value}T12:00` : value
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return null
  return date
}

async function ensureStudentInSchool(schoolId: string, studentId: string) {
  const [row] = await db
    .select({ id: student.id })
    .from(student)
    .where(and(eq(student.id, studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt)))
    .limit(1)
  return Boolean(row)
}

async function ensureClassInSchool(schoolId: string, classId: string | null | undefined) {
  if (!classId) return true
  const [row] = await db
    .select({ id: schoolClass.id })
    .from(schoolClass)
    .where(and(eq(schoolClass.id, classId), eq(schoolClass.schoolId, schoolId), isNull(schoolClass.deletedAt)))
    .limit(1)
  return Boolean(row)
}

async function ensureOccurrenceTypeInSchool(schoolId: string, typeId: string) {
  const [row] = await db
    .select({ id: occurrenceType.id, active: occurrenceType.active, name: occurrenceType.name })
    .from(occurrenceType)
    .where(and(eq(occurrenceType.id, typeId), eq(occurrenceType.schoolId, schoolId), isNull(occurrenceType.deletedAt)))
    .limit(1)
  return row ?? null
}

async function notifyFamilyIfNeeded(schoolId: string, studentId: string, visibility: string, typeLabel: string) {
  if (visibility !== 'FAMILY') return
  const recipients = await getGuardianRecipients(schoolId, [studentId])
  const target = recipients.get(studentId) ?? []
  const href = `/family/occurrences?student=${studentId}`
  const title = `Nova ocorrência: ${typeLabel}`

  const rows: { userId: string; schoolId: string; title: string; body: string; href: string }[] = []
  for (const userId of target) {
    if (await hasRecentNotification(userId, schoolId, title, href)) continue
    rows.push({
      userId,
      schoolId,
      title,
      body: 'Uma nova ocorrência foi registrada e está disponível no portal da família.',
      href,
    })
  }

  if (rows.length) await db.insert(notification).values(rows)
}

async function notifyCriticalThreshold(schoolId: string, studentId: string, threshold: number) {
  const { count } = await countOccurrencesInCurrentBimester(schoolId, studentId)
  if (count < threshold) return

  const recipients = await listCriticalAlertRecipients(schoolId)
  if (recipients.length === 0) return
  const href = `/school/students/${studentId}`
  const title = 'Alerta disciplinar: limite atingido'
  const rows: { userId: string; schoolId: string; title: string; body: string; href: string }[] = []
  for (const userId of recipients) {
    if (await hasRecentNotification(userId, schoolId, title, href)) continue
    rows.push({
      userId,
      schoolId,
      title,
      body: `O aluno atingiu ${count} ocorrência(s) no bimestre atual.`,
      href,
    })
  }
  if (rows.length) await db.insert(notification).values(rows)
}

export async function createOccurrenceType(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence_type.create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(TYPE_PERMISSION)
    const parsed = occurrenceTypeInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }

    await db.insert(occurrenceType).values({
      schoolId,
      name: parsed.data.name,
      description: parsed.data.description,
      sortOrder: parsed.data.sortOrder,
      active: parsed.data.active,
      createdBy: userId,
    })

    await recordAudit({
      action: 'occurrence_type.created',
      entityType: 'occurrence_type',
      schoolId,
      actorUserId: userId,
      metadata: { name: parsed.data.name },
    })
    revalidatePath('/school/occurrences/types')
    revalidatePath('/school/occurrences')
    return { ok: true, message: 'Tipo de ocorrência cadastrado.' }
  })
}

export async function updateOccurrenceType(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence_type.update_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(TYPE_PERMISSION)
    const typeId = String(formData.get('typeId') ?? '')
    if (!UUID_RE.test(typeId)) return { ok: false, message: 'Tipo inválido.' }

    const parsed = occurrenceTypeInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }

    const updated = await db
      .update(occurrenceType)
      .set({
        name: parsed.data.name,
        description: parsed.data.description,
        sortOrder: parsed.data.sortOrder,
        active: parsed.data.active,
        updatedAt: new Date(),
      })
      .where(and(eq(occurrenceType.id, typeId), eq(occurrenceType.schoolId, schoolId), isNull(occurrenceType.deletedAt)))
      .returning({ id: occurrenceType.id })

    if (updated.length === 0) return { ok: false, message: 'Tipo não encontrado.' }

    await recordAudit({
      action: 'occurrence_type.updated',
      entityType: 'occurrence_type',
      entityId: typeId,
      schoolId,
      actorUserId: userId,
      metadata: { name: parsed.data.name },
    })
    revalidatePath('/school/occurrences/types')
    revalidatePath('/school/occurrences')
    return { ok: true, message: 'Tipo de ocorrência atualizado.' }
  })
}

export async function archiveOccurrenceType(formData: FormData) {
  await runVoidAction('occurrence_type.archive_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(TYPE_PERMISSION)
    const typeId = String(formData.get('typeId') ?? '')
    if (!UUID_RE.test(typeId)) return

    await db
      .update(occurrenceType)
      .set({ active: false, deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(occurrenceType.id, typeId), eq(occurrenceType.schoolId, schoolId), isNull(occurrenceType.deletedAt)))

    await recordAudit({
      action: 'occurrence_type.archived',
      entityType: 'occurrence_type',
      entityId: typeId,
      schoolId,
      actorUserId: userId,
    })
  })
  revalidatePath('/school/occurrences/types')
  revalidatePath('/school/occurrences')
}

export async function updateOccurrenceThreshold(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.threshold_update_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(TYPE_PERMISSION)
    const threshold = Number(formData.get('occurrenceAlertThreshold'))
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 20) {
      return { ok: false, fieldErrors: { occurrenceAlertThreshold: 'Informe um valor entre 1 e 20.' } }
    }

    await db.update(school).set({ occurrenceAlertThreshold: threshold }).where(eq(school.id, schoolId))
    await recordAudit({
      action: 'school.occurrence_threshold_updated',
      entityType: 'school',
      entityId: schoolId,
      schoolId,
      actorUserId: userId,
      metadata: { threshold },
    })

    revalidatePath('/school/occurrences/types')
    return { ok: true, message: 'Limite crítico atualizado.' }
  })
}

export async function createOccurrence(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(OCC_PERMISSION)
    const parsed = occurrenceInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }

    const occurredAt = parseOccurredAt(parsed.data.occurredAt)
    if (!occurredAt) return { ok: false, fieldErrors: { occurredAt: 'Data/hora inválida.' } }

    if (!(await ensureStudentInSchool(schoolId, parsed.data.studentId))) {
      return { ok: false, fieldErrors: { studentId: 'Aluno não encontrado.' } }
    }
    if (!(await ensureClassInSchool(schoolId, parsed.data.classId ?? null))) {
      return { ok: false, fieldErrors: { classId: 'Turma inválida.' } }
    }
    const type = await ensureOccurrenceTypeInSchool(schoolId, parsed.data.occurrenceTypeId)
    if (!type?.active) return { ok: false, fieldErrors: { occurrenceTypeId: 'Tipo de ocorrência inválido ou inativo.' } }

    const [created] = await db
      .insert(occurrence)
      .values({
        schoolId,
        studentId: parsed.data.studentId,
        classId: parsed.data.classId ?? null,
        occurrenceTypeId: parsed.data.occurrenceTypeId,
        reporterUserId: userId,
        occurredAt,
        severity: parsed.data.severity,
        visibility: parsed.data.visibility,
        status: parsed.data.status,
        description: parsed.data.description,
      })
      .returning({ id: occurrence.id })

    const [cfg] = await db
      .select({ threshold: school.occurrenceAlertThreshold })
      .from(school)
      .where(eq(school.id, schoolId))
      .limit(1)

    await notifyFamilyIfNeeded(schoolId, parsed.data.studentId, parsed.data.visibility, type.name)
    await notifyCriticalThreshold(schoolId, parsed.data.studentId, cfg?.threshold ?? 3)

    await recordAudit({
      action: 'occurrence.created',
      entityType: 'occurrence',
      entityId: created.id,
      schoolId,
      actorUserId: userId,
      metadata: {
        studentId: parsed.data.studentId,
        severity: parsed.data.severity,
        visibility: parsed.data.visibility,
        status: parsed.data.status,
      },
    })

    revalidatePath('/school/occurrences')
    revalidatePath(`/school/students/${parsed.data.studentId}`)
    revalidatePath('/family/occurrences')
    return { ok: true, message: 'Ocorrência registrada.' }
  })
}

export async function updateOccurrence(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.update_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(OCC_PERMISSION)
    const parsed = occurrenceUpdateInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }

    const occurredAt = parseOccurredAt(parsed.data.occurredAt)
    if (!occurredAt) return { ok: false, fieldErrors: { occurredAt: 'Data/hora inválida.' } }

    const current = await getOccurrenceById(schoolId, parsed.data.occurrenceId)
    if (!current) return { ok: false, message: 'Ocorrência não encontrada.' }
    if (!(await ensureStudentInSchool(schoolId, parsed.data.studentId))) {
      return { ok: false, fieldErrors: { studentId: 'Aluno não encontrado.' } }
    }
    if (!(await ensureClassInSchool(schoolId, parsed.data.classId ?? null))) {
      return { ok: false, fieldErrors: { classId: 'Turma inválida.' } }
    }
    const type = await ensureOccurrenceTypeInSchool(schoolId, parsed.data.occurrenceTypeId)
    if (!type) return { ok: false, fieldErrors: { occurrenceTypeId: 'Tipo de ocorrência inválido.' } }

    await db
      .update(occurrence)
      .set({
        studentId: parsed.data.studentId,
        classId: parsed.data.classId ?? null,
        occurrenceTypeId: parsed.data.occurrenceTypeId,
        occurredAt,
        severity: parsed.data.severity,
        visibility: parsed.data.visibility,
        status: parsed.data.status,
        description: parsed.data.description,
        updatedAt: new Date(),
      })
      .where(and(eq(occurrence.id, parsed.data.occurrenceId), eq(occurrence.schoolId, schoolId), isNull(occurrence.deletedAt)))

    await db.insert(occurrenceAudit).values({
      schoolId,
      occurrenceId: parsed.data.occurrenceId,
      actorUserId: userId,
      action: 'updated',
      justification: parsed.data.justification,
      beforeData: current,
      afterData: {
        studentId: parsed.data.studentId,
        classId: parsed.data.classId ?? null,
        occurrenceTypeId: parsed.data.occurrenceTypeId,
        occurredAt: occurredAt.toISOString(),
        severity: parsed.data.severity,
        visibility: parsed.data.visibility,
        status: parsed.data.status,
        description: parsed.data.description,
      },
      metadata: { mandatoryJustification: true },
    })

    await recordAudit({
      action: 'occurrence.updated',
      entityType: 'occurrence',
      entityId: parsed.data.occurrenceId,
      schoolId,
      actorUserId: userId,
      metadata: { justification: parsed.data.justification },
    })

    await notifyFamilyIfNeeded(schoolId, parsed.data.studentId, parsed.data.visibility, type.name)

    revalidatePath('/school/occurrences')
    revalidatePath(`/school/students/${parsed.data.studentId}`)
    revalidatePath('/family/occurrences')
    return { ok: true, message: 'Ocorrência atualizada.' }
  })
}

export async function archiveOccurrence(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.archive_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(OCC_PERMISSION)
    const occurrenceId = String(formData.get('occurrenceId') ?? '')
    const justification = String(formData.get('justification') ?? '').trim().slice(0, 500)
    if (!UUID_RE.test(occurrenceId)) return { ok: false, message: 'Ocorrência inválida.' }
    if (justification.length < 5) {
      return { ok: false, fieldErrors: { justification: 'Justifique o arquivamento (mín. 5 caracteres).' } }
    }

    const current = await getOccurrenceById(schoolId, occurrenceId)
    if (!current) return { ok: false, message: 'Ocorrência não encontrada.' }

    await db
      .update(occurrence)
      .set({ archivedAt: new Date(), deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(occurrence.id, occurrenceId), eq(occurrence.schoolId, schoolId), isNull(occurrence.deletedAt)))

    await db.insert(occurrenceAudit).values({
      schoolId,
      occurrenceId,
      actorUserId: userId,
      action: 'archived',
      justification,
      beforeData: current,
      afterData: { archivedAt: new Date().toISOString() },
      metadata: { mandatoryJustification: true },
    })

    await recordAudit({
      action: 'occurrence.archived',
      entityType: 'occurrence',
      entityId: occurrenceId,
      schoolId,
      actorUserId: userId,
      metadata: { justification },
    })

    revalidatePath('/school/occurrences')
    revalidatePath(`/school/students/${current.studentId}`)
    revalidatePath('/family/occurrences')
    return { ok: true, message: 'Ocorrência arquivada.' }
  })
}

export async function addOccurrenceAction(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence_action.create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(OCC_PERMISSION)
    const parsed = occurrenceActionInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }

    const current = await getOccurrenceById(schoolId, parsed.data.occurrenceId)
    if (!current) return { ok: false, message: 'Ocorrência não encontrada.' }

    const performedAt = parsed.data.performedAt ? parseOccurredAt(parsed.data.performedAt) : new Date()
    if (!performedAt) return { ok: false, fieldErrors: { performedAt: 'Data da ação inválida.' } }

    await db.insert(occurrenceAction).values({
      schoolId,
      occurrenceId: parsed.data.occurrenceId,
      actionType: parsed.data.actionType,
      description: parsed.data.description,
      performedBy: userId,
      performedAt,
      dueDate: parsed.data.dueDate ?? null,
    })

    if (current.status !== 'EM_ACOMPANHAMENTO') {
      await db
        .update(occurrence)
        .set({ status: 'EM_ACOMPANHAMENTO', updatedAt: new Date() })
        .where(and(eq(occurrence.id, parsed.data.occurrenceId), eq(occurrence.schoolId, schoolId), isNull(occurrence.deletedAt)))
    }

    await recordAudit({
      action: 'occurrence.action_added',
      entityType: 'occurrence',
      entityId: parsed.data.occurrenceId,
      schoolId,
      actorUserId: userId,
      metadata: { actionType: parsed.data.actionType },
    })

    revalidatePath('/school/occurrences')
    revalidatePath(`/school/students/${current.studentId}`)
    return { ok: true, message: 'Acompanhamento registrado.' }
  })
}

export async function transitionOccurrenceStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.status_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(OCC_PERMISSION)
    const occurrenceId = String(formData.get('occurrenceId') ?? '')
    const status = String(formData.get('status') ?? '')
    if (!UUID_RE.test(occurrenceId)) return { ok: false, message: 'Ocorrência inválida.' }
    if (!['PENDENTE', 'EM_ACOMPANHAMENTO', 'RESOLVIDA'].includes(status)) {
      return { ok: false, fieldErrors: { status: 'Status inválido.' } }
    }

    const current = await getOccurrenceById(schoolId, occurrenceId)
    if (!current) return { ok: false, message: 'Ocorrência não encontrada.' }

    await db
      .update(occurrence)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(occurrence.id, occurrenceId), eq(occurrence.schoolId, schoolId), isNull(occurrence.deletedAt)))

    await recordAudit({
      action: 'occurrence.status_changed',
      entityType: 'occurrence',
      entityId: occurrenceId,
      schoolId,
      actorUserId: userId,
      metadata: { from: current.status, to: status },
    })

    revalidatePath('/school/occurrences')
    revalidatePath(`/school/students/${current.studentId}`)
    return { ok: true, message: 'Status atualizado.' }
  })
}
