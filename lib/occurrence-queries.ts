import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  sql,
  type SQL,
} from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  notification,
  occurrence,
  occurrenceAction,
  occurrenceType,
  schoolMembership,
  schoolClass,
  student,
  user,
} from '@/lib/db/schema'
import { getFamilyStudents } from '@/lib/attendance-queries'

export type OccurrenceFilter = {
  studentId?: string
  classId?: string
  typeId?: string
  severity?: string
  status?: string
  visibility?: string
  from?: Date
  to?: Date
  page?: number
  pageSize?: number
}

export async function listOccurrenceTypes(schoolId: string, includeInactive = false) {
  const filters: SQL[] = [eq(occurrenceType.schoolId, schoolId), isNull(occurrenceType.deletedAt)]
  if (!includeInactive) filters.push(eq(occurrenceType.active, true))

  return db
    .select()
    .from(occurrenceType)
    .where(and(...filters))
    .orderBy(asc(occurrenceType.sortOrder), asc(occurrenceType.name))
}

export async function getOccurrenceById(schoolId: string, occurrenceId: string) {
  const [row] = await db
    .select()
    .from(occurrence)
    .where(and(eq(occurrence.schoolId, schoolId), eq(occurrence.id, occurrenceId), isNull(occurrence.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function listOccurrences(schoolId: string, filter: OccurrenceFilter) {
  const page = Math.max(filter.page ?? 1, 1)
  const pageSize = Math.min(Math.max(filter.pageSize ?? 20, 1), 100)
  const where: SQL[] = [eq(occurrence.schoolId, schoolId), isNull(occurrence.deletedAt)]

  if (filter.studentId) where.push(eq(occurrence.studentId, filter.studentId))
  if (filter.classId) where.push(eq(occurrence.classId, filter.classId))
  if (filter.typeId) where.push(eq(occurrence.occurrenceTypeId, filter.typeId))
  if (filter.severity) where.push(eq(occurrence.severity, filter.severity))
  if (filter.status) where.push(eq(occurrence.status, filter.status))
  if (filter.visibility) where.push(eq(occurrence.visibility, filter.visibility))
  if (filter.from) where.push(gte(occurrence.occurredAt, filter.from))
  if (filter.to) where.push(lte(occurrence.occurredAt, filter.to))

  const [totalRow, items] = await Promise.all([
    db.select({ value: count() }).from(occurrence).where(and(...where)).then((rows) => rows[0]),
    db
      .select({
        id: occurrence.id,
        studentId: occurrence.studentId,
        classId: occurrence.classId,
        occurrenceTypeId: occurrence.occurrenceTypeId,
        occurredAt: occurrence.occurredAt,
        severity: occurrence.severity,
        visibility: occurrence.visibility,
        status: occurrence.status,
        description: occurrence.description,
        archivedAt: occurrence.archivedAt,
        studentName: student.fullName,
        className: schoolClass.name,
        typeName: occurrenceType.name,
        reporterName: user.name,
      })
      .from(occurrence)
      .innerJoin(student, eq(student.id, occurrence.studentId))
      .leftJoin(schoolClass, eq(schoolClass.id, occurrence.classId))
      .innerJoin(occurrenceType, eq(occurrenceType.id, occurrence.occurrenceTypeId))
      .leftJoin(user, eq(user.id, occurrence.reporterUserId))
      .where(and(...where))
      .orderBy(desc(occurrence.occurredAt), desc(occurrence.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
  ])

  return {
    items,
    page,
    pageSize,
    total: totalRow?.value ?? 0,
    totalPages: Math.max(Math.ceil((totalRow?.value ?? 0) / pageSize), 1),
  }
}

export async function listOccurrenceActions(schoolId: string, occurrenceId: string) {
  return db
    .select({
      id: occurrenceAction.id,
      actionType: occurrenceAction.actionType,
      description: occurrenceAction.description,
      performedAt: occurrenceAction.performedAt,
      dueDate: occurrenceAction.dueDate,
      actorName: user.name,
    })
    .from(occurrenceAction)
    .leftJoin(user, eq(user.id, occurrenceAction.performedBy))
    .where(and(eq(occurrenceAction.schoolId, schoolId), eq(occurrenceAction.occurrenceId, occurrenceId)))
    .orderBy(desc(occurrenceAction.performedAt), desc(occurrenceAction.createdAt))
}

export async function listStudentOccurrences(schoolId: string, studentId: string, limit = 30) {
  return db
    .select({
      id: occurrence.id,
      occurrenceTypeId: occurrence.occurrenceTypeId,
      occurredAt: occurrence.occurredAt,
      severity: occurrence.severity,
      status: occurrence.status,
      visibility: occurrence.visibility,
      description: occurrence.description,
      typeName: occurrenceType.name,
    })
    .from(occurrence)
    .innerJoin(occurrenceType, eq(occurrenceType.id, occurrence.occurrenceTypeId))
    .where(and(eq(occurrence.schoolId, schoolId), eq(occurrence.studentId, studentId), isNull(occurrence.deletedAt)))
    .orderBy(desc(occurrence.occurredAt))
    .limit(limit)
}

export async function getStudentBehaviorSummary(schoolId: string, studentId: string) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const yearStart = new Date(now.getFullYear(), 0, 1)

  const [month, year] = await Promise.all([
    db
      .select({
        severity: occurrence.severity,
        value: sql<number>`count(*)::int`,
      })
      .from(occurrence)
      .where(
        and(
          eq(occurrence.schoolId, schoolId),
          eq(occurrence.studentId, studentId),
          isNull(occurrence.deletedAt),
          gte(occurrence.occurredAt, monthStart),
        ),
      )
      .groupBy(occurrence.severity),
    db
      .select({
        severity: occurrence.severity,
        value: sql<number>`count(*)::int`,
      })
      .from(occurrence)
      .where(
        and(
          eq(occurrence.schoolId, schoolId),
          eq(occurrence.studentId, studentId),
          isNull(occurrence.deletedAt),
          gte(occurrence.occurredAt, yearStart),
        ),
      )
      .groupBy(occurrence.severity),
  ])

  const init = { LEVE: 0, MODERADA: 0, GRAVE: 0 }
  const monthBySeverity = { ...init }
  const yearBySeverity = { ...init }
  for (const row of month) if (row.severity in monthBySeverity) monthBySeverity[row.severity as keyof typeof init] = row.value
  for (const row of year) if (row.severity in yearBySeverity) yearBySeverity[row.severity as keyof typeof init] = row.value

  return {
    month: monthBySeverity,
    year: yearBySeverity,
    monthTotal: Object.values(monthBySeverity).reduce((a, b) => a + b, 0),
    yearTotal: Object.values(yearBySeverity).reduce((a, b) => a + b, 0),
  }
}

export async function getFamilyVisibleOccurrences(
  schoolId: string,
  userId: string,
  email: string,
  studentId?: string,
) {
  const students = await getFamilyStudents(schoolId, 'PARENT', userId, email)
  const studentIds = students.map((s) => s.id)
  if (studentIds.length === 0) return { students, selectedStudentId: null as string | null, items: [] as Awaited<ReturnType<typeof listStudentOccurrences>> }

  const selectedStudentId = studentId && studentIds.includes(studentId) ? studentId : studentIds[0]
  const items = await db
    .select({
      id: occurrence.id,
      studentId: occurrence.studentId,
      occurredAt: occurrence.occurredAt,
      severity: occurrence.severity,
      status: occurrence.status,
      visibility: occurrence.visibility,
      description: occurrence.description,
      typeName: occurrenceType.name,
      studentName: student.fullName,
    })
    .from(occurrence)
    .innerJoin(occurrenceType, eq(occurrenceType.id, occurrence.occurrenceTypeId))
    .innerJoin(student, eq(student.id, occurrence.studentId))
    .where(
      and(
        eq(occurrence.schoolId, schoolId),
        eq(occurrence.visibility, 'FAMILY'),
        eq(occurrence.studentId, selectedStudentId),
        isNull(occurrence.deletedAt),
      ),
    )
    .orderBy(desc(occurrence.occurredAt))
    .limit(100)

  return { students, selectedStudentId, items }
}

export async function countOccurrencesInCurrentBimester(schoolId: string, studentId: string, reference = new Date()) {
  const month = reference.getMonth()
  const bimesterStartMonth = month - (month % 2)
  const start = new Date(reference.getFullYear(), bimesterStartMonth, 1)
  const end = new Date(reference.getFullYear(), bimesterStartMonth + 2, 0, 23, 59, 59, 999)

  const [row] = await db
    .select({ value: count() })
    .from(occurrence)
    .where(
      and(
        eq(occurrence.schoolId, schoolId),
        eq(occurrence.studentId, studentId),
        isNull(occurrence.deletedAt),
        gte(occurrence.occurredAt, start),
        lte(occurrence.occurredAt, end),
      ),
    )

  return { count: row?.value ?? 0, range: { start, end } }
}

export async function listCriticalAlertRecipients(schoolId: string) {
  const rows = await db
    .selectDistinct({ userId: schoolMembership.userId })
    .from(schoolMembership)
    .where(
      and(
        eq(schoolMembership.schoolId, schoolId),
        inArray(schoolMembership.role, ['SCHOOL_ADMIN', 'COORDINATOR']),
        isNull(schoolMembership.deletedAt),
      ),
    )

  return rows.map((r) => r.userId)
}

export async function hasRecentNotification(userId: string, schoolId: string, title: string, href: string) {
  const since = new Date(Date.now() - 12 * 60 * 60 * 1000)
  const [row] = await db
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.schoolId, schoolId),
        eq(notification.title, title),
        eq(notification.href, href),
        gte(notification.createdAt, since),
      ),
    )
    .limit(1)
  return Boolean(row)
}
