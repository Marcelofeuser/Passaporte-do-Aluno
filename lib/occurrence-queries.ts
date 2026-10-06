import { and, asc, count, desc, eq, gte, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  academicYear,
  classSubject,
  enrollment,
  occurrence,
  occurrenceChange,
  occurrenceType,
  school,
  schoolClass,
  schoolMembership,
  student,
  teacher,
  user,
} from '@/lib/db/schema'
import { DEFAULT_OCCURRENCE_TYPES } from '@/lib/occurrences'
import { can, type Role } from '@/lib/rbac'
import { getTeacherIdForUser } from '@/lib/grade-queries'

/* Todas as funções recebem `schoolId` do vínculo ativo validado no servidor. */

export async function disciplineScope(schoolId: string, role: Role | null, userId: string, email: string) {
  if (can(role, 'school:manage_all_discipline')) return { all: true as const, teacherId: null as string | null }
  const teacherId = await getTeacherIdForUser(schoolId, userId, email)
  return { all: false as const, teacherId }
}

export type DisciplineScope = Awaited<ReturnType<typeof disciplineScope>>

export async function getOccurrenceSettings(schoolId: string) {
  const [row] = await db
    .select({ threshold: school.occurrenceAlertThreshold })
    .from(school)
    .where(eq(school.id, schoolId))
  return { threshold: row?.threshold ?? 3 }
}

export async function ensureOccurrenceTypes(schoolId: string) {
  const [existing] = await db
    .select({ n: count() })
    .from(occurrenceType)
    .where(and(eq(occurrenceType.schoolId, schoolId), isNull(occurrenceType.deletedAt)))
  if (existing.n > 0) return
  await db.insert(occurrenceType).values(
    DEFAULT_OCCURRENCE_TYPES.map((t) => ({
      schoolId,
      name: t.name,
      isPositive: t.isPositive,
      sortOrder: t.sortOrder,
    })),
  )
}

export async function listOccurrenceTypes(schoolId: string, opts?: { activeOnly?: boolean }) {
  await ensureOccurrenceTypes(schoolId)
  const filters = [eq(occurrenceType.schoolId, schoolId), isNull(occurrenceType.deletedAt)]
  if (opts?.activeOnly) filters.push(eq(occurrenceType.isActive, true))
  return db
    .select({
      id: occurrenceType.id,
      name: occurrenceType.name,
      isPositive: occurrenceType.isPositive,
      isActive: occurrenceType.isActive,
      sortOrder: occurrenceType.sortOrder,
    })
    .from(occurrenceType)
    .where(and(...filters))
    .orderBy(asc(occurrenceType.sortOrder), asc(occurrenceType.name))
}

/** Turmas em que o professor leciona ou é titular. */
export async function getTeacherClassIds(schoolId: string, teacherId: string) {
  const [taught, homeroom] = await Promise.all([
    db
      .selectDistinct({ classId: classSubject.classId })
      .from(classSubject)
      .where(and(eq(classSubject.schoolId, schoolId), eq(classSubject.teacherId, teacherId))),
    db
      .select({ classId: schoolClass.id })
      .from(schoolClass)
      .where(and(eq(schoolClass.schoolId, schoolId), eq(schoolClass.homeroomTeacherId, teacherId), isNull(schoolClass.deletedAt))),
  ])
  return [...new Set([...taught.map((r) => r.classId), ...homeroom.map((r) => r.classId)])]
}

export async function listDisciplineStudents(schoolId: string, scope: DisciplineScope) {
  const current = await db
    .select({ id: academicYear.id })
    .from(academicYear)
    .where(and(eq(academicYear.schoolId, schoolId), eq(academicYear.isCurrent, true), isNull(academicYear.deletedAt)))
    .limit(1)
  if (!current[0]) return []

  const filters = [
    eq(enrollment.schoolId, schoolId),
    eq(enrollment.academicYearId, current[0].id),
    eq(enrollment.status, 'ACTIVE'),
    isNull(student.deletedAt),
  ]

  if (!scope.all) {
    if (!scope.teacherId) return []
    const classIds = await getTeacherClassIds(schoolId, scope.teacherId)
    if (classIds.length === 0) return []
    filters.push(inArray(enrollment.classId, classIds))
  }

  return db
    .select({
      studentId: student.id,
      fullName: student.fullName,
      socialName: student.socialName,
      classId: enrollment.classId,
      className: schoolClass.name,
      enrollmentId: enrollment.id,
    })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(and(...filters))
    .orderBy(asc(schoolClass.name), asc(student.fullName))
}

export async function studentInScope(schoolId: string, studentId: string, scope: DisciplineScope) {
  const rows = await listDisciplineStudents(schoolId, scope)
  return rows.some((r) => r.studentId === studentId)
}

export type OccurrenceListFilter = {
  status?: string
  severity?: string
  typeId?: string
  studentId?: string
  classId?: string
  from?: string
  to?: string
}

export async function listOccurrences(
  schoolId: string,
  scope: DisciplineScope,
  userId: string,
  filter: OccurrenceListFilter,
) {
  const where = [eq(occurrence.schoolId, schoolId), isNull(occurrence.deletedAt)]
  if (filter.status) where.push(eq(occurrence.status, filter.status))
  if (filter.severity) where.push(eq(occurrence.severity, filter.severity))
  if (filter.typeId) where.push(eq(occurrence.typeId, filter.typeId))
  if (filter.studentId) where.push(eq(occurrence.studentId, filter.studentId))
  if (filter.classId) where.push(eq(occurrence.classId, filter.classId))
  if (filter.from) where.push(gte(occurrence.occurredOn, filter.from))
  if (filter.to) where.push(lte(occurrence.occurredOn, filter.to))

  if (!scope.all) {
    if (!scope.teacherId) return []
    const classIds = await getTeacherClassIds(schoolId, scope.teacherId)
    if (classIds.length === 0) return []
    where.push(or(inArray(occurrence.classId, classIds), eq(occurrence.recordedByUserId, userId))!)
  }

  const rows = await db
    .select({
      id: occurrence.id,
      studentId: occurrence.studentId,
      studentName: student.fullName,
      socialName: student.socialName,
      className: schoolClass.name,
      typeName: occurrenceType.name,
      isPositive: occurrenceType.isPositive,
      occurredOn: occurrence.occurredOn,
      occurredAt: occurrence.occurredAt,
      severity: occurrence.severity,
      status: occurrence.status,
      visibleToFamily: occurrence.visibleToFamily,
      recordedByUserId: occurrence.recordedByUserId,
      recordedBy: user.name,
    })
    .from(occurrence)
    .innerJoin(student, eq(student.id, occurrence.studentId))
    .innerJoin(occurrenceType, eq(occurrenceType.id, occurrence.typeId))
    .leftJoin(schoolClass, eq(schoolClass.id, occurrence.classId))
    .leftJoin(user, eq(user.id, occurrence.recordedByUserId))
    .where(and(...where))
    .orderBy(desc(occurrence.occurredAt))
    .limit(200)

  return rows.filter((r) => canSeeOccurrence(r, scope, userId))
}

/** Professor: internas só se ele registrou. */
export function canSeeOccurrence(
  row: { visibleToFamily: boolean; recordedByUserId: string },
  scope: DisciplineScope,
  userId: string,
) {
  if (scope.all) return true
  return row.visibleToFamily || row.recordedByUserId === userId
}

export async function getOccurrence(schoolId: string, id: string) {
  const [row] = await db
    .select({
      id: occurrence.id,
      studentId: occurrence.studentId,
      studentName: student.fullName,
      socialName: student.socialName,
      classId: occurrence.classId,
      className: schoolClass.name,
      enrollmentId: occurrence.enrollmentId,
      academicYearId: occurrence.academicYearId,
      typeId: occurrence.typeId,
      typeName: occurrenceType.name,
      isPositive: occurrenceType.isPositive,
      recordedByUserId: occurrence.recordedByUserId,
      recordedBy: user.name,
      teacherId: occurrence.teacherId,
      teacherName: teacher.fullName,
      occurredOn: occurrence.occurredOn,
      occurredAt: occurrence.occurredAt,
      term: occurrence.term,
      severity: occurrence.severity,
      description: occurrence.description,
      measures: occurrence.measures,
      measuresNote: occurrence.measuresNote,
      status: occurrence.status,
      visibleToFamily: occurrence.visibleToFamily,
      createdAt: occurrence.createdAt,
      updatedAt: occurrence.updatedAt,
    })
    .from(occurrence)
    .innerJoin(student, eq(student.id, occurrence.studentId))
    .innerJoin(occurrenceType, eq(occurrenceType.id, occurrence.typeId))
    .leftJoin(schoolClass, eq(schoolClass.id, occurrence.classId))
    .leftJoin(user, eq(user.id, occurrence.recordedByUserId))
    .leftJoin(teacher, eq(teacher.id, occurrence.teacherId))
    .where(and(eq(occurrence.id, id), eq(occurrence.schoolId, schoolId), isNull(occurrence.deletedAt)))
  return row ?? null
}

export async function getOccurrenceHistory(schoolId: string, occurrenceId: string) {
  return db
    .select({
      id: occurrenceChange.id,
      action: occurrenceChange.action,
      reason: occurrenceChange.reason,
      changedBy: user.name,
      oldValues: occurrenceChange.oldValues,
      newValues: occurrenceChange.newValues,
      createdAt: occurrenceChange.createdAt,
    })
    .from(occurrenceChange)
    .leftJoin(user, eq(user.id, occurrenceChange.changedBy))
    .where(and(eq(occurrenceChange.schoolId, schoolId), eq(occurrenceChange.occurrenceId, occurrenceId)))
    .orderBy(desc(occurrenceChange.createdAt))
    .limit(50)
}

export async function listStudentOccurrences(
  schoolId: string,
  studentId: string,
  opts?: { visibleOnly?: boolean; from?: string; to?: string; limit?: number },
) {
  const where = [eq(occurrence.schoolId, schoolId), eq(occurrence.studentId, studentId), isNull(occurrence.deletedAt)]
  if (opts?.visibleOnly) where.push(eq(occurrence.visibleToFamily, true))
  if (opts?.from) where.push(gte(occurrence.occurredOn, opts.from))
  if (opts?.to) where.push(lte(occurrence.occurredOn, opts.to))
  return db
    .select({
      id: occurrence.id,
      occurredOn: occurrence.occurredOn,
      occurredAt: occurrence.occurredAt,
      severity: occurrence.severity,
      status: occurrence.status,
      description: occurrence.description,
      typeName: occurrenceType.name,
      isPositive: occurrenceType.isPositive,
      visibleToFamily: occurrence.visibleToFamily,
    })
    .from(occurrence)
    .innerJoin(occurrenceType, eq(occurrenceType.id, occurrence.typeId))
    .where(and(...where))
    .orderBy(desc(occurrence.occurredAt))
    .limit(opts?.limit ?? 100)
}

export async function getStudentBehaviorSummary(schoolId: string, studentId: string) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const yearStart = `${now.getFullYear()}-01-01`
  const [monthRows, yearRows] = await Promise.all([
    listStudentOccurrences(schoolId, studentId, { from: monthStart }),
    listStudentOccurrences(schoolId, studentId, { from: yearStart }),
  ])
  const summarize = (rows: Array<{ severity: string }>) => ({
    MILD: rows.filter((row) => row.severity === 'MILD').length,
    MODERATE: rows.filter((row) => row.severity === 'MODERATE').length,
    SEVERE: rows.filter((row) => row.severity === 'SEVERE').length,
    GRAVE: rows.filter((row) => row.severity === 'SEVERE').length,
  })
  return {
    monthTotal: monthRows.length,
    yearTotal: yearRows.length,
    month: summarize(monthRows),
    year: summarize(yearRows),
  }
}

export async function countDisciplinaryInTerm(
  schoolId: string,
  studentId: string,
  academicYearId: string,
  term: number,
) {
  const [row] = await db
    .select({ n: count() })
    .from(occurrence)
    .innerJoin(occurrenceType, eq(occurrenceType.id, occurrence.typeId))
    .where(
      and(
        eq(occurrence.schoolId, schoolId),
        eq(occurrence.studentId, studentId),
        eq(occurrence.academicYearId, academicYearId),
        eq(occurrence.term, term),
        eq(occurrenceType.isPositive, false),
        isNull(occurrence.deletedAt),
      ),
    )
  return row?.n ?? 0
}

export async function occurrenceSummary(schoolId: string, studentId: string, from: string, to: string, visibleOnly: boolean) {
  const where = [
    eq(occurrence.schoolId, schoolId),
    eq(occurrence.studentId, studentId),
    isNull(occurrence.deletedAt),
    gte(occurrence.occurredOn, from),
    lte(occurrence.occurredOn, to),
  ]
  if (visibleOnly) where.push(eq(occurrence.visibleToFamily, true))
  const [row] = await db
    .select({
      total: count(),
      mild: sql<number>`count(*) filter (where ${occurrence.severity} = 'MILD')::int`,
      moderate: sql<number>`count(*) filter (where ${occurrence.severity} = 'MODERATE')::int`,
      severe: sql<number>`count(*) filter (where ${occurrence.severity} = 'SEVERE')::int`,
    })
    .from(occurrence)
    .where(and(...where))
  return row ?? { total: 0, mild: 0, moderate: 0, severe: 0 }
}

export async function listCriticalAlerts(schoolId: string, threshold: number, academicYearId: string, term: number) {
  return db
    .select({
      studentId: occurrence.studentId,
      studentName: student.fullName,
      socialName: student.socialName,
      className: schoolClass.name,
      n: count(),
    })
    .from(occurrence)
    .innerJoin(occurrenceType, eq(occurrenceType.id, occurrence.typeId))
    .innerJoin(student, eq(student.id, occurrence.studentId))
    .leftJoin(schoolClass, eq(schoolClass.id, occurrence.classId))
    .where(
      and(
        eq(occurrence.schoolId, schoolId),
        eq(occurrence.academicYearId, academicYearId),
        eq(occurrence.term, term),
        eq(occurrenceType.isPositive, false),
        isNull(occurrence.deletedAt),
        isNull(student.deletedAt),
      ),
    )
    .groupBy(occurrence.studentId, student.fullName, student.socialName, schoolClass.name)
    .having(sql`count(*) >= ${threshold}`)
    .orderBy(desc(sql`count(*)`))
}

export async function countPendingOccurrences(schoolId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(occurrence)
    .where(and(eq(occurrence.schoolId, schoolId), eq(occurrence.status, 'PENDING'), isNull(occurrence.deletedAt)))
  return row?.n ?? 0
}

export async function getPedagogyRecipients(schoolId: string) {
  const rows = await db
    .select({ userId: schoolMembership.userId })
    .from(schoolMembership)
    .where(
      and(
        eq(schoolMembership.schoolId, schoolId),
        isNull(schoolMembership.deletedAt),
        inArray(schoolMembership.role, ['SCHOOL_ADMIN', 'COORDINATOR']),
      ),
    )
  return [...new Set(rows.map((r) => r.userId))]
}

export async function getCurrentEnrollmentForStudent(schoolId: string, studentId: string) {
  const [row] = await db
    .select({
      enrollmentId: enrollment.id,
      classId: enrollment.classId,
      academicYearId: enrollment.academicYearId,
      startsOn: academicYear.startsOn,
      endsOn: academicYear.endsOn,
      className: schoolClass.name,
    })
    .from(enrollment)
    .innerJoin(academicYear, eq(academicYear.id, enrollment.academicYearId))
    .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(
      and(
        eq(enrollment.schoolId, schoolId),
        eq(enrollment.studentId, studentId),
        eq(enrollment.status, 'ACTIVE'),
        eq(academicYear.isCurrent, true),
      ),
    )
    .limit(1)
  return row ?? null
}
