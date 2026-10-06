'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { recordAudit } from '@/lib/audit'
import { getGuardianRecipients } from '@/lib/attendance-queries'
import { db } from '@/lib/db'
import { notification, occurrence, occurrenceAlertSent, occurrenceChange, occurrenceType, school } from '@/lib/db/schema'
import {
  academicTerm,
  formatBR,
  isISODate,
  isOccurrenceStatus,
  isSeverity,
  isTime,
  occurredTimestamp,
  parseMeasures,
  todayISO,
} from '@/lib/occurrences'
import {
  countDisciplinaryInTerm,
  disciplineScope,
  getCurrentEnrollmentForStudent,
  getOccurrence,
  getOccurrenceSettings,
  getPedagogyRecipients,
  listDisciplineStudents,
  listOccurrenceTypes,
  studentInScope,
} from '@/lib/occurrence-queries'
import { can, type Role } from '@/lib/rbac'
import { requireSchoolAction, runAction, runVoidAction, UUID_RE } from '@/lib/school-action'
import { formText, toFieldErrors, type ActionState } from '@/lib/validation'
import { z } from 'zod'

const MIN_REASON = 5

function revalidateOccurrence(schoolId: string, studentId?: string, id?: string) {
  revalidatePath('/school/occurrences')
  revalidatePath('/school')
  revalidatePath('/family')
  if (studentId) revalidatePath(`/school/students/${studentId}`)
  if (id) revalidatePath(`/school/occurrences/${id}`)
  void schoolId
}

const typeInput = z.object({
  name: z.string().trim().min(2, 'Informe o nome do tipo').max(80),
  isPositive: z.string().optional(),
})

export async function createOccurrenceType(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.type_create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_all_discipline')
    const parsed = typeInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }

    const [row] = await db
      .insert(occurrenceType)
      .values({
        schoolId,
        name: parsed.data.name,
        isPositive: parsed.data.isPositive === 'on',
        sortOrder: 100,
      })
      .returning({ id: occurrenceType.id })

    await recordAudit({
      action: 'occurrence_type.created',
      entityType: 'occurrence_type',
      entityId: row.id,
      schoolId,
      actorUserId: userId,
      metadata: { name: parsed.data.name },
    })
    revalidatePath('/school/occurrences/types')
    revalidatePath('/school/occurrences/new')
    return { ok: true, message: 'Tipo de ocorrência criado.' }
  })
}

export async function updateOccurrenceType(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.type_update_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_all_discipline')
    const id = String(formData.get('typeId') ?? '')
    if (!UUID_RE.test(id)) return { ok: false, message: 'Tipo inválido.' }
    const parsed = typeInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }

    const [row] = await db
      .update(occurrenceType)
      .set({
        name: parsed.data.name,
        isPositive: parsed.data.isPositive === 'on',
        isActive: formData.get('isActive') === 'on',
        updatedAt: new Date(),
      })
      .where(and(eq(occurrenceType.id, id), eq(occurrenceType.schoolId, schoolId), isNull(occurrenceType.deletedAt)))
      .returning({ id: occurrenceType.id })
    if (!row) return { ok: false, message: 'Tipo não encontrado.' }

    await recordAudit({
      action: 'occurrence_type.updated',
      entityType: 'occurrence_type',
      entityId: id,
      schoolId,
      actorUserId: userId,
    })
    revalidatePath('/school/occurrences/types')
    return { ok: true, message: 'Tipo atualizado.' }
  })
}

export async function archiveOccurrenceType(formData: FormData): Promise<void> {
  await runVoidAction('occurrence.type_archive_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_all_discipline')
    const id = String(formData.get('typeId') ?? '')
    if (!UUID_RE.test(id)) return
    await db
      .update(occurrenceType)
      .set({ deletedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(and(eq(occurrenceType.id, id), eq(occurrenceType.schoolId, schoolId)))
    await recordAudit({
      action: 'occurrence_type.archived',
      entityType: 'occurrence_type',
      entityId: id,
      schoolId,
      actorUserId: userId,
    })
    revalidatePath('/school/occurrences/types')
  })
}

export async function updateOccurrenceSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.settings_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_settings')
    const threshold = Number(formData.get('threshold'))
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 20) {
      return { ok: false, fieldErrors: { threshold: 'Entre 1 e 20 ocorrências no bimestre.' } }
    }
    await db.update(school).set({ occurrenceAlertThreshold: threshold, updatedAt: new Date() }).where(eq(school.id, schoolId))
    await recordAudit({
      action: 'school.occurrence_settings_updated',
      entityType: 'school',
      entityId: schoolId,
      schoolId,
      actorUserId: userId,
      metadata: { threshold },
    })
    revalidatePath('/school/occurrences')
    return { ok: true, message: 'Alerta de disciplina atualizado.' }
  })
}

export async function createOccurrence(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.create_failed', async () => {
    const { ctx, schoolId, userId } = await requireSchoolAction('school:manage_discipline')
    const scope = await disciplineScope(schoolId, ctx.active?.role ?? null, userId, ctx.user.email)

    const studentId = String(formData.get('studentId') ?? '')
    const typeId = String(formData.get('typeId') ?? '')
    const occurredOn = String(formData.get('occurredOn') ?? '')
    const occurredTime = String(formData.get('occurredTime') ?? '')
    const severity = String(formData.get('severity') ?? '')
    const description = String(formData.get('description') ?? '').trim()
    const measuresNote = String(formData.get('measuresNote') ?? '').trim().slice(0, 500) || null
    const visibleToFamily = formData.get('visibleToFamily') === 'on'
    const measures = parseMeasures(formData)

    const fieldErrors: Record<string, string> = {}
    if (!UUID_RE.test(studentId)) fieldErrors.studentId = 'Selecione o aluno.'
    if (!UUID_RE.test(typeId)) fieldErrors.typeId = 'Selecione o tipo.'
    if (!isISODate(occurredOn)) fieldErrors.occurredOn = 'Informe a data.'
    else if (occurredOn > todayISO()) fieldErrors.occurredOn = 'Não é possível registrar em data futura.'
    if (!isTime(occurredTime)) fieldErrors.occurredTime = 'Informe o horário.'
    if (!isSeverity(severity)) fieldErrors.severity = 'Informe a gravidade.'
    if (description.length < 10) fieldErrors.description = 'Descreva o fato (mín. 10 caracteres).'
    if (description.length > 4000) fieldErrors.description = 'Máximo de 4000 caracteres.'
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

    if (!(await studentInScope(schoolId, studentId, scope))) {
      return { ok: false, message: 'Você não pode registrar ocorrência para este aluno.' }
    }

    const roster = await listDisciplineStudents(schoolId, scope)
    const picked = roster.find((r) => r.studentId === studentId)
    const studentName = picked ? picked.socialName || picked.fullName : 'aluno'

    const types = await listOccurrenceTypes(schoolId, { activeOnly: true })
    const type = types.find((t) => t.id === typeId)
    if (!type) return { ok: false, fieldErrors: { typeId: 'Tipo inativo ou inválido.' } }

    const enr = await getCurrentEnrollmentForStudent(schoolId, studentId)
    const term = enr ? academicTerm(occurredOn, enr.startsOn, enr.endsOn) : 1
    const occurredAt = occurredTimestamp(occurredOn, occurredTime)

    const [row] = await db
      .insert(occurrence)
      .values({
        schoolId,
        studentId,
        classId: enr?.classId ?? null,
        enrollmentId: enr?.enrollmentId ?? null,
        academicYearId: enr?.academicYearId ?? null,
        typeId,
        recordedByUserId: userId,
        teacherId: scope.teacherId,
        occurredOn,
        occurredAt,
        term,
        severity,
        description,
        measures,
        measuresNote,
        visibleToFamily,
      })
      .returning({ id: occurrence.id })

    const notices: { userId: string; schoolId: string; title: string; body: string; href: string }[] = []

    if (visibleToFamily) {
      const recipients = await getGuardianRecipients(schoolId, [studentId])
      for (const uid of recipients.get(studentId) ?? []) {
        notices.push({
          userId: uid,
          schoolId,
          title: `Ocorrência registrada: ${studentName}`,
          body: `${type.name} · ${formatBR(occurredOn)} · gravidade ${severityLabel(severity)}`,
          href: `/family?student=${studentId}`,
        })
      }
    }

    if (!type.isPositive && enr?.academicYearId) {
      const settings = await getOccurrenceSettings(schoolId)
      const n = await countDisciplinaryInTerm(schoolId, studentId, enr.academicYearId, term)
      if (n >= settings.threshold) {
        try {
          await db.insert(occurrenceAlertSent).values({
            schoolId,
            studentId,
            academicYearId: enr.academicYearId,
            term,
            kind: 'CRITICAL_COUNT',
            countAtSend: n,
          })
          const pedagogy = await getPedagogyRecipients(schoolId)
          for (const uid of pedagogy) {
            if (uid === userId) continue
            notices.push({
              userId: uid,
              schoolId,
              title: `Alerta de disciplina: ${studentName}`,
              body: `${n} ocorrência(s) no ${term}º bimestre (limite ${settings.threshold}).`,
              href: `/school/occurrences?student=${studentId}`,
            })
          }
        } catch {
          // Já houve alerta neste bimestre para o aluno.
        }
      }
    }

    if (notices.length) await db.insert(notification).values(notices)

    await recordAudit({
      action: 'occurrence.created',
      entityType: 'occurrence',
      entityId: row.id,
      schoolId,
      actorUserId: userId,
      metadata: { studentId, typeId, severity, visibleToFamily, occurredOn },
    })
    revalidateOccurrence(schoolId, studentId, row.id)
    return { ok: true, message: 'Ocorrência registrada.' }
  })
}

function severityLabel(severity: string) {
  if (severity === 'MILD') return 'leve'
  if (severity === 'MODERATE') return 'moderada'
  if (severity === 'SEVERE') return 'grave'
  return severity
}

async function assertCanMutate(schoolId: string, id: string, userId: string, role: Role | null | undefined) {
  const row = await getOccurrence(schoolId, id)
  if (!row) return { error: 'Ocorrência não encontrada.' as const, row: null }
  const all = can(role, 'school:manage_all_discipline')
  if (!all && row.recordedByUserId !== userId) {
    return { error: 'Somente a coordenação ou quem registrou pode alterar esta ocorrência.' as const, row: null }
  }
  return { error: null, row }
}

function requireReason(formData: FormData) {
  const reason = String(formData.get('reason') ?? '').trim()
  if (reason.length < MIN_REASON) return { reason: '', error: 'Justifique a alteração (mín. 5 caracteres).' }
  return { reason: reason.slice(0, 500), error: null }
}

export async function updateOccurrence(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.update_failed', async () => {
    const { ctx, schoolId, userId } = await requireSchoolAction('school:manage_discipline')
    const id = String(formData.get('occurrenceId') ?? '')
    if (!UUID_RE.test(id)) return { ok: false, message: 'Ocorrência inválida.' }

    const { reason, error: reasonError } = requireReason(formData)
    if (reasonError) return { ok: false, fieldErrors: { reason: reasonError } }

    const access = await assertCanMutate(schoolId, id, userId, ctx.active?.role)
    if (access.error || !access.row) return { ok: false, message: access.error }

    const typeId = String(formData.get('typeId') ?? '')
    const occurredOn = String(formData.get('occurredOn') ?? '')
    const occurredTime = String(formData.get('occurredTime') ?? '')
    const severity = String(formData.get('severity') ?? '')
    const description = String(formData.get('description') ?? '').trim()
    const visibleToFamily = formData.get('visibleToFamily') === 'on'

    const fieldErrors: Record<string, string> = {}
    if (!UUID_RE.test(typeId)) fieldErrors.typeId = 'Selecione o tipo.'
    if (!isISODate(occurredOn)) fieldErrors.occurredOn = 'Informe a data.'
    if (!isTime(occurredTime)) fieldErrors.occurredTime = 'Informe o horário.'
    if (!isSeverity(severity)) fieldErrors.severity = 'Informe a gravidade.'
    if (description.length < 10) fieldErrors.description = 'Descreva o fato (mín. 10 caracteres).'
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

    const types = await listOccurrenceTypes(schoolId)
    if (!types.some((t) => t.id === typeId)) return { ok: false, fieldErrors: { typeId: 'Tipo inválido.' } }

    const occurredAt = occurredTimestamp(occurredOn, occurredTime)
    const oldValues = {
      typeId: access.row.typeId,
      occurredOn: access.row.occurredOn,
      severity: access.row.severity,
      description: access.row.description,
      visibleToFamily: access.row.visibleToFamily,
    }
    const newValues = { typeId, occurredOn, severity, description, visibleToFamily }

    await db.transaction(async (tx) => {
      await tx
        .update(occurrence)
        .set({ typeId, occurredOn, occurredAt, severity, description, visibleToFamily, updatedAt: new Date() })
        .where(and(eq(occurrence.id, id), eq(occurrence.schoolId, schoolId)))
      await tx.insert(occurrenceChange).values({
        schoolId,
        occurrenceId: id,
        action: 'UPDATE',
        reason,
        changedBy: userId,
        oldValues,
        newValues,
      })
    })

    await recordAudit({
      action: 'occurrence.updated',
      entityType: 'occurrence',
      entityId: id,
      schoolId,
      actorUserId: userId,
      metadata: { reason, oldValues, newValues },
    })
    revalidateOccurrence(schoolId, access.row.studentId, id)
    return { ok: true, message: 'Ocorrência atualizada. A justificativa ficou no histórico.' }
  })
}

export async function followUpOccurrence(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.followup_failed', async (): Promise<ActionState> => {
    const { ctx, schoolId, userId } = await requireSchoolAction('school:manage_discipline')
    const id = String(formData.get('occurrenceId') ?? '')
    if (!UUID_RE.test(id)) return { ok: false, message: 'Ocorrência inválida.' }

    const { reason, error: reasonError } = requireReason(formData)
    if (reasonError) return { ok: false, fieldErrors: { reason: reasonError } } satisfies ActionState

    const access = await assertCanMutate(schoolId, id, userId, ctx.active?.role)
    if (access.error || !access.row) return { ok: false, message: access.error }

    const status = String(formData.get('status') ?? '')
    if (!isOccurrenceStatus(status)) return { ok: false, fieldErrors: { status: 'Situação inválida.' } } satisfies ActionState
    const measures = parseMeasures(formData)
    const measuresNote = String(formData.get('measuresNote') ?? '').trim().slice(0, 500) || null

    const oldValues = { status: access.row.status, measures: access.row.measures, measuresNote: access.row.measuresNote }
    const newValues = { status, measures, measuresNote }

    await db.transaction(async (tx) => {
      await tx
        .update(occurrence)
        .set({ status, measures, measuresNote, updatedAt: new Date() })
        .where(and(eq(occurrence.id, id), eq(occurrence.schoolId, schoolId)))
      await tx.insert(occurrenceChange).values({
        schoolId,
        occurrenceId: id,
        action: 'STATUS',
        reason,
        changedBy: userId,
        oldValues,
        newValues,
      })
    })

    await recordAudit({
      action: 'occurrence.followed_up',
      entityType: 'occurrence',
      entityId: id,
      schoolId,
      actorUserId: userId,
      metadata: { reason, oldValues, newValues },
    })
    revalidateOccurrence(schoolId, access.row.studentId, id)
    return { ok: true, message: 'Acompanhamento registrado.' }
  })
}

export async function deleteOccurrence(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('occurrence.delete_failed', async () => {
    const { ctx, schoolId, userId } = await requireSchoolAction('school:manage_discipline')
    const id = String(formData.get('occurrenceId') ?? '')
    if (!UUID_RE.test(id)) return { ok: false, message: 'Ocorrência inválida.' }

    const { reason, error: reasonError } = requireReason(formData)
    if (reasonError) return { ok: false, fieldErrors: { reason: reasonError } }

    const access = await assertCanMutate(schoolId, id, userId, ctx.active?.role)
    if (access.error || !access.row) return { ok: false, message: access.error }

    await db.transaction(async (tx) => {
      await tx
        .update(occurrence)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(occurrence.id, id), eq(occurrence.schoolId, schoolId)))
      await tx.insert(occurrenceChange).values({
        schoolId,
        occurrenceId: id,
        action: 'DELETE',
        reason,
        changedBy: userId,
        oldValues: { status: access.row.status, description: access.row.description },
        newValues: { deleted: true },
      })
    })

    await recordAudit({
      action: 'occurrence.deleted',
      entityType: 'occurrence',
      entityId: id,
      schoolId,
      actorUserId: userId,
      metadata: { reason, studentId: access.row.studentId },
    })
    revalidateOccurrence(schoolId, access.row.studentId)
    return { ok: true, message: 'Ocorrência excluída. A justificativa ficou na auditoria.' }
  })
}
