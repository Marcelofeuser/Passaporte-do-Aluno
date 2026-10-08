import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  academicYear,
  assessment,
  assessmentScore,
  attendanceRecord,
  attendanceSession,
  classSubject,
  enrollment,
  school,
  schoolClass,
  student,
  subject,
  teacher,
} from '@/lib/db/schema'
import { computeResult } from '@/lib/grades'

/* Relatórios administrativos (Fase 14). Consultas por tenant + ano letivo,
   saída estruturada para CSV (Excel/Sheets) e impressão PDF. */

export type RosterRow = {
  studentName: string
  socialName: string | null
  registrationCode: string | null
  email: string | null
  className: string | null
  classGrade: string | null
  status: string
  enrolledOn: string
}

/** Roster completo de matrículas do ano letivo (todas as situações). */
export async function getStudentRosterReport(schoolId: string, academicYearId: string): Promise<RosterRow[]> {
  return db
    .select({
      studentName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
      email: student.email,
      className: schoolClass.name,
      classGrade: schoolClass.grade,
      status: enrollment.status,
      enrolledOn: enrollment.enrolledOn,
    })
    .from(enrollment)
    .innerJoin(student, and(eq(student.id, enrollment.studentId), isNull(student.deletedAt)))
    .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(and(eq(enrollment.schoolId, schoolId), eq(enrollment.academicYearId, academicYearId)))
    .orderBy(asc(schoolClass.name), asc(student.fullName))
}

export type GradeConsolidatedRow = {
  className: string
  subjectName: string
  teacherName: string | null
  students: number
  scored: number
  average: number | null
  approved: number
  recovery: number
  failed: number
}

/** Consolidação de notas por turma × disciplina (médias e situação final). */
export async function getGradesConsolidatedReport(schoolId: string, academicYearId: string): Promise<GradeConsolidatedRow[]> {
  const csRows = await db
    .select({
      id: classSubject.id,
      className: schoolClass.name,
      classGrade: schoolClass.grade,
      subjectName: subject.name,
      teacherName: teacher.fullName,
    })
    .from(classSubject)
    .innerJoin(schoolClass, and(eq(schoolClass.id, classSubject.classId), isNull(schoolClass.deletedAt)))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .leftJoin(teacher, eq(teacher.id, classSubject.teacherId))
    .where(and(eq(classSubject.schoolId, schoolId), eq(schoolClass.academicYearId, academicYearId)))
    .orderBy(asc(schoolClass.name), asc(subject.name))
  if (csRows.length === 0) return []

  const assessments = await db
    .select({
      id: assessment.id,
      classSubjectId: assessment.classSubjectId,
      term: assessment.term,
      weight: assessment.weight,
      maxScore: assessment.maxScore,
      kind: assessment.kind,
    })
    .from(assessment)
    .where(
      and(
        eq(assessment.schoolId, schoolId),
        isNull(assessment.deletedAt),
        inArray(assessment.classSubjectId, csRows.map((r) => r.id)),
      ),
    )
  const byCs = new Map<string, typeof assessments>()
  for (const a of assessments) {
    const list = byCs.get(a.classSubjectId) ?? []
    list.push(a)
    byCs.set(a.classSubjectId, list)
  }

  const scores = assessments.length
    ? await db
        .select({ assessmentId: assessmentScore.assessmentId, studentId: assessmentScore.studentId, score: assessmentScore.score })
        .from(assessmentScore)
        .where(and(eq(assessmentScore.schoolId, schoolId), inArray(assessmentScore.assessmentId, assessments.map((a) => a.id))))
    : []
  const scoresByStudentCs = new Map<string, Map<string, number | null>>()
  const csOfAssessment = new Map(assessments.map((a) => [a.id, a.classSubjectId]))
  for (const s of scores) {
    const csId = csOfAssessment.get(s.assessmentId)
    if (!csId) continue
    const m = scoresByStudentCs.get(s.studentId) ?? new Map()
    m.set(csId, s.score)
    scoresByStudentCs.set(s.studentId, m)
  }

  const [pg] = await db.select({ passingGrade: school.passingGrade }).from(school).where(eq(school.id, schoolId)).limit(1)
  const passingGrade = pg?.passingGrade ?? 6

  return csRows.map((cs) => {
    const items = byCs.get(cs.id) ?? []
    const studentsInCs = new Set(scores.filter((s) => csOfAssessment.get(s.assessmentId) === cs.id).map((s) => s.studentId))
    let sum = 0
    let n = 0
    let approved = 0
    let recovery = 0
    let failed = 0
    for (const studentId of studentsInCs) {
      const gradeItems = items.map((a) => ({
        kind: a.kind,
        weight: a.weight,
        maxScore: a.maxScore,
        score: scoresByStudentCs.get(studentId)?.get(cs.id) ?? null,
      }))
      const result = computeResult(gradeItems, passingGrade)
      if (result.final !== null) {
        sum += result.final
        n += 1
      }
      if (result.status === 'APPROVED') approved += 1
      else if (result.status === 'RECOVERY') recovery += 1
      else if (result.status === 'FAILED') failed += 1
    }
    return {
      className: `${cs.classGrade} ${cs.className}`,
      subjectName: cs.subjectName,
      teacherName: cs.teacherName,
      students: studentsInCs.size,
      scored: n,
      average: n ? Math.round((sum / n) * 10) / 10 : null,
      approved,
      recovery,
      failed,
    }
  })
}

export type AttendanceConsolidatedRow = {
  className: string
  studentName: string
  given: number
  absent: number
  late: number
  pct: number | null
}

/** Assiduidade consolidada por aluno (ano letivo). */
export async function getAttendanceConsolidatedReport(schoolId: string, academicYearId: string): Promise<AttendanceConsolidatedRow[]> {
  const classIds = (
    await db.select({ id: schoolClass.id }).from(schoolClass).where(eq(schoolClass.academicYearId, academicYearId))
  ).map((r) => r.id)
  if (classIds.length === 0) return []
  const rows = await db
    .select({
      className: schoolClass.name,
      studentName: student.fullName,
      given: sql<number>`coalesce(sum(${attendanceSession.lessons}), 0)::int`,
      absent: sql<number>`coalesce(sum(${attendanceSession.lessons}) filter (where ${attendanceRecord.status} = 'ABSENT'), 0)::int`,
      late: sql<number>`count(*) filter (where ${attendanceRecord.status} = 'LATE')::int`,
    })
    .from(attendanceRecord)
    .innerJoin(attendanceSession, eq(attendanceSession.id, attendanceRecord.sessionId))
    .innerJoin(student, eq(student.id, attendanceRecord.studentId))
    .innerJoin(schoolClass, eq(schoolClass.id, attendanceSession.classId))
    .where(and(eq(attendanceRecord.schoolId, schoolId), inArray(attendanceSession.classId, classIds)))
    .groupBy(schoolClass.name, student.fullName)
    .orderBy(asc(schoolClass.name), asc(student.fullName))
  return rows.map((r) => ({ ...r, pct: r.given ? Math.round(((r.given - r.absent) / r.given) * 1000) / 10 : null }))
}

/** CSV com BOM (UTF-8 compatível com Excel) e escaping RFC 4180. */
export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? '' : String(v)
    return `"${s.replace(/"/g, '""')}"`
  }
  const lines = [headers.map(esc).join(';')]
  for (const row of rows) lines.push(row.map(esc).join(';'))
  return `\uFEFF${lines.join('\r\n')}`
}
