import { and, asc, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { calendarEvent, calendarEventType, schoolClass, schoolEvent, subject } from '@/lib/db/schema'
import type { Role } from '@/lib/rbac'

export type SchoolEventKind = 'EVENT' | 'EXAM' | 'ASSIGNMENT'

export type AgendaEntry = {
  id: string
  source: 'SCHOOL_EVENT' | 'CALENDAR_EVENT'
  kind: string
  kindLabel: string
  title: string
  description: string | null
  startsAt: Date
  location: string | null
  scope: 'school' | 'class'
  className: string | null
  subjectName: string | null
}

const KIND_LABEL: Record<string, string> = {
  EVENT: 'Evento',
  EXAM: 'Prova',
  ASSIGNMENT: 'Trabalho',
}

/**
 * Agenda consolidada no intervalo [from, to]: eventos gerais da escola + eventos de
 * provas/trabalhos das turmas informadas (filhos do responsável / aluno). Tenant-safe.
 */
export async function listAgendaEntries(
  schoolId: string,
  role: Role,
  from: Date,
  to: Date,
  classIds: string[],
): Promise<AgendaEntry[]> {
  const audiences = role === 'PARENT' || role === 'STUDENT' ? ['ALL', 'FAMILY'] : ['ALL', 'FAMILY', 'STAFF']

  const calendarRows = await db
    .select({
      id: calendarEvent.id,
      title: calendarEvent.title,
      description: calendarEvent.description,
      startsAt: calendarEvent.startsAt,
      location: calendarEvent.location,
      typeName: calendarEventType.name,
    })
    .from(calendarEvent)
    .innerJoin(calendarEventType, and(eq(calendarEventType.id, calendarEvent.typeId), eq(calendarEventType.schoolId, schoolId)))
    .where(
      and(
        eq(calendarEvent.schoolId, schoolId),
        isNull(calendarEvent.deletedAt),
        gte(calendarEvent.startsAt, from),
        lte(calendarEvent.startsAt, to),
        inArray(calendarEventType.audience, audiences),
      ),
    )

  const classFilter = classIds.length
    ? or(isNull(schoolEvent.classId), inArray(schoolEvent.classId, classIds))
    : isNull(schoolEvent.classId)

  const eventRows = await db
    .select({
      id: schoolEvent.id,
      kind: schoolEvent.kind,
      title: schoolEvent.title,
      description: schoolEvent.description,
      startsAt: schoolEvent.startsAt,
      location: schoolEvent.location,
      classId: schoolEvent.classId,
      className: schoolClass.name,
      subjectName: subject.name,
    })
    .from(schoolEvent)
    .leftJoin(schoolClass, and(eq(schoolClass.id, schoolEvent.classId), eq(schoolClass.schoolId, schoolId)))
    .leftJoin(subject, and(eq(subject.id, schoolEvent.subjectId), eq(subject.schoolId, schoolId)))
    .where(and(eq(schoolEvent.schoolId, schoolId), isNull(schoolEvent.deletedAt), gte(schoolEvent.startsAt, from), lte(schoolEvent.startsAt, to), classFilter))
    .orderBy(asc(schoolEvent.startsAt))

  const entries: AgendaEntry[] = [
    ...calendarRows.map((r) => ({
      id: `cal-${r.id}`,
      source: 'CALENDAR_EVENT' as const,
      kind: 'EVENT',
      kindLabel: r.typeName,
      title: r.title,
      description: r.description,
      startsAt: r.startsAt,
      location: r.location,
      scope: 'school' as const,
      className: null,
      subjectName: null,
    })),
    ...eventRows.map((r) => ({
      id: `evt-${r.id}`,
      source: 'SCHOOL_EVENT' as const,
      kind: r.kind,
      kindLabel: KIND_LABEL[r.kind] ?? r.kind,
      title: r.title,
      description: r.description,
      startsAt: r.startsAt,
      location: r.location,
      scope: r.classId ? ('class' as const) : ('school' as const),
      className: r.className,
      subjectName: r.subjectName,
    })),
  ]

  return entries.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}
