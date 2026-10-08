'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { schoolClass, schoolEvent, subject } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { runAction, requireSchoolAction, UUID_RE } from '@/lib/school-action'
import type { ActionState } from '@/lib/validation'
import { toFieldErrors } from '@/lib/validation'

export const EVENT_KINDS = ['EVENT', 'EXAM', 'ASSIGNMENT'] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  EVENT: 'Evento',
  EXAM: 'Prova',
  ASSIGNMENT: 'Trabalho',
}

const EVENT_INPUT = z.object({
  classId: z.string().trim().regex(UUID_RE, 'Turma inválida').nullish().transform((v) => v || null),
  subjectId: z.string().trim().regex(UUID_RE, 'Disciplina inválida').nullish().transform((v) => v || null),
  kind: z.enum(EVENT_KINDS, 'Tipo inválido').default('EVENT'),
  title: z.string().trim().min(3, 'Informe o título').max(160),
  description: z.string().trim().max(2000, 'Máximo de 2000 caracteres').nullish().transform((v) => v || null),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  time: z.string().regex(/^\d{2}:\d{2}$/, 'Hora inválida'),
  location: z.string().trim().max(160).nullish().transform((v) => v || null),
})

/** Publica evento/prova/trabalho na agenda. Permissão: school:manage_calendar. */
export async function createSchoolEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('calendar.event_create', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_calendar')
    const parsed = EVENT_INPUT.safeParse({
      classId: formData.get('classId') || null,
      subjectId: formData.get('subjectId') || null,
      kind: formData.get('kind') || 'EVENT',
      title: formData.get('title'),
      description: formData.get('description') || null,
      date: formData.get('date'),
      time: formData.get('time') || '08:00',
      location: formData.get('location') || null,
    })
    if (!parsed.success) {
      return { ok: false, message: 'Verifique os campos destacados.', fieldErrors: toFieldErrors(parsed.error) }
    }
    const data = parsed.data
    if (data.classId) {
      const [cls] = await db
        .select({ id: schoolClass.id })
        .from(schoolClass)
        .where(and(eq(schoolClass.schoolId, schoolId), eq(schoolClass.id, data.classId), isNull(schoolClass.deletedAt)))
      if (!cls) return { ok: false, message: 'Turma não encontrada nesta escola.' }
    }
    if (data.subjectId) {
      const [sub] = await db
        .select({ id: subject.id })
        .from(subject)
        .where(and(eq(subject.schoolId, schoolId), eq(subject.id, data.subjectId), isNull(subject.deletedAt)))
      if (!sub) return { ok: false, message: 'Disciplina não encontrada nesta escola.' }
    }
    const [row] = await db
      .insert(schoolEvent)
      .values({
        schoolId,
        classId: data.classId ?? null,
        subjectId: data.subjectId ?? null,
        kind: data.kind,
        title: data.title,
        description: data.description ?? null,
        startsAt: new Date(`${data.date}T${data.time}:00`),
        location: data.location ?? null,
        createdBy: userId,
      })
      .returning({ id: schoolEvent.id })

    await recordAudit({
      action: 'school_event.created',
      entityType: 'school_event',
      entityId: row?.id ?? null,
      schoolId,
      actorUserId: userId,
      metadata: { kind: data.kind, classId: data.classId ?? null, startsAt: `${data.date} ${data.time}` },
    })

    revalidatePath('/school/calendar')
    revalidatePath('/family/agenda')
    return { ok: true, message: 'Evento publicado na agenda.' }
  })
}

/** Remove (soft delete) um evento da agenda. Permissão: school:manage_calendar. */
export async function deleteSchoolEvent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('calendar.event_delete', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_calendar')
    const eventId = String(formData.get('eventId') ?? '')
    if (!UUID_RE.test(eventId)) return { ok: false, message: 'Evento inválido.' }
    await db
      .update(schoolEvent)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(schoolEvent.schoolId, schoolId), eq(schoolEvent.id, eventId), isNull(schoolEvent.deletedAt)))
    await recordAudit({
      action: 'school_event.deleted',
      entityType: 'school_event',
      entityId: eventId,
      schoolId,
      actorUserId: userId,
      metadata: {},
    })
    revalidatePath('/school/calendar')
    revalidatePath('/family/agenda')
    return { ok: true, message: 'Evento removido.' }
  })
}
