import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, or, sql, type SQL } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  academicYear,
  attendanceChange,
  attendanceRecord,
  attendanceSession,
  classSubject,
  enrollment,
  parent,
  school,
  schoolClass,
  schoolMembership,
  student,
  studentParent,
  subject,
  teacher,
  user,
} from '@/lib/db/schema'
import { EMPTY_TOTALS, type AttendanceTotals } from '@/lib/attendance'

/* Todas as funções recebem `schoolId` do vínculo ativo validado no servidor. */

export async function getAttendanceSettings(schoolId: string) {
  const [row] = await db
    .select({ minAttendance: school.minAttendance, lateThreshold: school.lateAlertThreshold })
    .from(school)
    .where(eq(school.id, schoolId))
  return row ?? { minAttendance: 75, lateThreshold: 3 }
}

/**
 * Alunos matriculados na turma na data: entrada até a data e situação ativa,
 * ou situação encerrada somente depois da data.
 */
export async function getRosterOn(schoolId: string, classId: string, date: string) {
  return db
    .select({
      enrollmentId: enrollment.id,
      studentId: student.id,
      fullName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
    })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .where(
      and(
        eq(enrollment.schoolId, schoolId),
        eq(enrollment.classId, classId),
        isNull(student.deletedAt),
        lte(enrollment.enrolledOn, date),
        or(
          eq(enrollment.status, 'ACTIVE'),
          and(isNotNull(enrollment.statusChangedOn), sql`${enrollment.statusChangedOn} > ${date}`),
        ),
      ),
    )
    .orderBy(asc(student.fullName))
}

export async function getAttendanceSession(schoolId: string, classSubjectId: string, date: string) {
  const [row] = await db
    .select()
    .from(attendanceSession)
    .where(
      and(
        eq(attendanceSession.schoolId, schoolId),
        eq(attendanceSession.classSubjectId, classSubjectId),
        eq(attendanceSession.heldOn, date),
      ),
    )
  return row ?? null
}

export async function getSessionRecords(schoolId: string, sessionId: string) {
  return db
    .select()
    .from(attendanceRecord)
    .where(and(eq(attendanceRecord.schoolId, schoolId), eq(attendanceRecord.sessionId, sessionId)))
}

export async function listRecentSessions(schoolId: string, classSubjectId: string) {
  return db
    .select({
      id: attendanceSession.id,
      heldOn: attendanceSession.heldOn,
      lessons: attendanceSession.lessons,
      term: attendanceSession.term,
      absents: sql<number>`count(*) filter (where ${attendanceRecord.status} = 'ABSENT')::int`,
      lates: sql<number>`count(*) filter (where ${attendanceRecord.status} = 'LATE')::int`,
    })
    .from(attendanceSession)
    .leftJoin(attendanceRecord, eq(attendanceRecord.sessionId, attendanceSession.id))
    .where(and(eq(attendanceSession.schoolId, schoolId), eq(attendanceSession.classSubjectId, classSubjectId)))
    .groupBy(attendanceSession.id)
    .orderBy(desc(attendanceSession.heldOn))
    .limit(20)
}

export async function getAttendanceHistory(schoolId: string, sessionId: string) {
  return db
    .select({
      id: attendanceChange.id,
      oldStatus: attendanceChange.oldStatus,
      newStatus: attendanceChange.newStatus,
      reason: attendanceChange.reason,
      createdAt: attendanceChange.createdAt,
      changedBy: user.name,
      studentName: student.fullName,
    })
    .from(attendanceChange)
    .innerJoin(attendanceRecord, eq(attendanceRecord.id, attendanceChange.recordId))
    .innerJoin(student, eq(student.id, attendanceRecord.studentId))
    .leftJoin(user, eq(user.id, attendanceChange.changedBy))
    .where(and(eq(attendanceChange.schoolId, schoolId), eq(attendanceRecord.sessionId, sessionId)))
    .orderBy(desc(attendanceChange.createdAt))
    .limit(50)
}

export type TotalsRow = AttendanceTotals & { studentId: string; classSubjectId: string; term: number }

/** Totais de frequência agrupados por aluno, disciplina e bimestre. */
export async function getAttendanceTotals(
  schoolId: string,
  filter: { classId?: string; classSubjectId?: string; studentIds?: string[]; from?: string; to?: string },
): Promise<TotalsRow[]> {
  const where: SQL[] = [eq(attendanceRecord.schoolId, schoolId), eq(attendanceSession.schoolId, schoolId)]
  if (filter.classId) where.push(eq(attendanceSession.classId, filter.classId))
  if (filter.classSubjectId) where.push(eq(attendanceSession.classSubjectId, filter.classSubjectId))
  if (filter.studentIds) {
    if (filter.studentIds.length === 0) return []
    where.push(inArray(attendanceRecord.studentId, filter.studentIds))
  }
  if (filter.from) where.push(gte(attendanceSession.heldOn, filter.from))
  if (filter.to) where.push(lte(attendanceSession.heldOn, filter.to))

  return db
    .select({
      studentId: attendanceRecord.studentId,
      classSubjectId: attendanceSession.classSubjectId,
      term: attendanceSession.term,
      given: sql<number>`coalesce(sum(${attendanceSession.lessons}), 0)::int`,
      absent: sql<number>`coalesce(sum(${attendanceSession.lessons}) filter (where ${attendanceRecord.status} = 'ABSENT'), 0)::int`,
      late: sql<number>`count(*) filter (where ${attendanceRecord.status} = 'LATE')::int`,
      earlyLeave: sql<number>`count(*) filter (where ${attendanceRecord.status} = 'EARLY_LEAVE')::int`,
    })
    .from(attendanceRecord)
    .innerJoin(attendanceSession, eq(attendanceSession.id, attendanceRecord.sessionId))
    .where(and(...where))
    .groupBy(attendanceRecord.studentId, attendanceSession.classSubjectId, attendanceSession.term)
}

/** Agrupa linhas de totais por uma chave. */
export function groupTotals(rows: TotalsRow[], key: (r: TotalsRow) => string) {
  const out = new Map<string, AttendanceTotals>()
  for (const r of rows) {
    const k = key(r)
    const t = out.get(k) ?? { ...EMPTY_TOTALS }
    out.set(k, {
      given: t.given + r.given,
      absent: t.absent + r.absent,
      late: t.late + r.late,
      earlyLeave: t.earlyLeave + r.earlyLeave,
    })
  }
  return out
}

/** Disciplinas das turmas do ano vigente, para alertas da escola. */
export async function listCurrentClassSubjects(schoolId: string, teacherId?: string | null) {
  const where = [eq(classSubject.schoolId, schoolId), isNull(schoolClass.deletedAt), eq(academicYear.isCurrent, true)]
  if (teacherId) where.push(eq(classSubject.teacherId, teacherId))
  return db
    .select({
      id: classSubject.id,
      classId: classSubject.classId,
      workloadHours: classSubject.workloadHours,
      className: schoolClass.name,
      subjectName: subject.name,
    })
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .where(and(...where))
}

export async function getStudentsByIds(schoolId: string, ids: string[]) {
  if (ids.length === 0) return []
  return db
    .select({ id: student.id, fullName: student.fullName, socialName: student.socialName })
    .from(student)
    .where(and(eq(student.schoolId, schoolId), inArray(student.id, ids), isNull(student.deletedAt)))
}

/**
 * Alunos que o usuário pode acompanhar na escola ativa:
 * responsável → filhos vinculados; aluno → o próprio cadastro.
 */
export async function getFamilyStudents(schoolId: string, role: 'PARENT' | 'STUDENT', userId: string, email: string) {
  const owns = (userCol: typeof parent.userId | typeof student.userId, emailCol: typeof parent.email | typeof student.email) =>
    or(eq(userCol, userId), sql`lower(${emailCol}) = lower(${email})`)

  const base = db
    .selectDistinct({
      id: student.id,
      fullName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
    })
    .from(student)

  if (role === 'STUDENT') {
    return base
      .where(and(eq(student.schoolId, schoolId), isNull(student.deletedAt), owns(student.userId, student.email)))
      .orderBy(asc(student.fullName))
  }
  return base
    .innerJoin(studentParent, eq(studentParent.studentId, student.id))
    .innerJoin(parent, eq(parent.id, studentParent.parentId))
    .where(
      and(
        eq(student.schoolId, schoolId),
        eq(parent.schoolId, schoolId),
        isNull(student.deletedAt),
        isNull(parent.deletedAt),
        owns(parent.userId, parent.email),
      ),
    )
    .orderBy(asc(student.fullName))
}

/** Matrícula do ano vigente (ativa) de cada aluno, com turma e intervalo do ano letivo. */
export async function getCurrentEnrollments(schoolId: string, studentIds: string[]) {
  if (studentIds.length === 0) return []
  return db
    .select({
      studentId: enrollment.studentId,
      classId: enrollment.classId,
      className: schoolClass.name,
      grade: schoolClass.grade,
      startsOn: academicYear.startsOn,
      endsOn: academicYear.endsOn,
    })
    .from(enrollment)
    .innerJoin(academicYear, eq(academicYear.id, enrollment.academicYearId))
    .innerJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(
      and(
        eq(enrollment.schoolId, schoolId),
        inArray(enrollment.studentId, studentIds),
        eq(enrollment.status, 'ACTIVE'),
        eq(academicYear.isCurrent, true),
      ),
    )
}

export async function getClassSubjects(schoolId: string, classIds: string[]) {
  if (classIds.length === 0) return []
  return db
    .select({
      id: classSubject.id,
      classId: classSubject.classId,
      subjectName: subject.name,
      workloadHours: classSubject.workloadHours,
      teacherName: teacher.fullName,
    })
    .from(classSubject)
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .leftJoin(teacher, eq(teacher.id, classSubject.teacherId))
    .where(and(eq(classSubject.schoolId, schoolId), inArray(classSubject.classId, classIds)))
    .orderBy(asc(subject.name))
}

/** Registros individuais (dia a dia) dos alunos num intervalo. */
export async function getAttendanceEntries(schoolId: string, studentIds: string[], from: string, to: string) {
  if (studentIds.length === 0) return []
  return db
    .select({
      id: attendanceRecord.id,
      studentId: attendanceRecord.studentId,
      status: attendanceRecord.status,
      heldOn: attendanceSession.heldOn,
      lessons: attendanceSession.lessons,
      subjectName: subject.name,
    })
    .from(attendanceRecord)
    .innerJoin(attendanceSession, eq(attendanceSession.id, attendanceRecord.sessionId))
    .innerJoin(subject, eq(subject.id, attendanceSession.subjectId))
    .where(
      and(
        eq(attendanceRecord.schoolId, schoolId),
        inArray(attendanceRecord.studentId, studentIds),
        gte(attendanceSession.heldOn, from),
        lte(attendanceSession.heldOn, to),
      ),
    )
    .orderBy(desc(attendanceSession.heldOn), asc(subject.name))
}

/**
 * Contas dos responsáveis a avisar, por aluno. Só usuários com vínculo de
 * Responsável ativo nesta mesma escola recebem avisos.
 */
export async function getGuardianRecipients(schoolId: string, studentIds: string[]) {
  if (studentIds.length === 0) return new Map<string, string[]>()
  const rows = await db
    .selectDistinct({ studentId: studentParent.studentId, userId: user.id })
    .from(studentParent)
    .innerJoin(parent, eq(parent.id, studentParent.parentId))
    .innerJoin(user, or(eq(user.id, parent.userId), sql`lower(${user.email}) = lower(${parent.email})`))
    .innerJoin(
      schoolMembership,
      and(
        eq(schoolMembership.userId, user.id),
        eq(schoolMembership.schoolId, schoolId),
        eq(schoolMembership.role, 'PARENT'),
        isNull(schoolMembership.deletedAt),
      ),
    )
    .where(and(eq(parent.schoolId, schoolId), isNull(parent.deletedAt), inArray(studentParent.studentId, studentIds)))
  const out = new Map<string, string[]>()
  for (const r of rows) out.set(r.studentId, [...(out.get(r.studentId) ?? []), r.userId])
  return out
}
