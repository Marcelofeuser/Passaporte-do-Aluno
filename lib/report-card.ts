import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  academicHistory,
  academicYear,
  assessment,
  assessmentScore,
  classSubject,
  enrollment,
  school,
  schoolClass,
  student,
  subject,
  teacher,
} from '@/lib/db/schema'
import type { AttendanceTotals } from '@/lib/attendance'
import { EMPTY_TOTALS } from '@/lib/attendance'
import type { GradeItem, GradeResult } from '@/lib/grades'
import { computeResult } from '@/lib/grades'

/* Boletim consolidado (Fase 9). Todas as consultas recebem `schoolId` validado no servidor. */

export type ReportCardRow = {
  subjectId: string
  subjectName: string
  teacherName: string | null
  workloadHours: number | null
  result: GradeResult
  /** Aulas dadas / faltas no recorte (para frequência do boletim). */
  attendance: AttendanceTotals
}

export type ReportCard = {
  studentId: string
  studentName: string
  socialName: string | null
  registrationCode: string | null
  className: string | null
  classGrade: string | null
  year: number | null
  schoolName: string
  passingGrade: number
  minAttendance: number
  rows: ReportCardRow[]
  overall: GradeResult
  attendance: AttendanceTotals
}

/**
 * Boletim do aluno na turma, agregando avaliações de TODOS os bimestres do ano
 * (o termo da avaliação separa os períodos; a média final é anual, como no modelo
 * de 4 bimestres com recuperação). `from`/`to` filtram o recorte de faltas.
 */
export async function getReportCard(
  schoolId: string,
  studentId: string,
  classId: string,
  opts: { from?: string; to?: string } = {},
): Promise<ReportCard | null> {
  const [head] = await db
    .select({
      studentName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
      className: schoolClass.name,
      classGrade: schoolClass.grade,
      year: academicYear.year,
      schoolName: school.name,
      passingGrade: school.passingGrade,
      minAttendance: school.minAttendance,
    })
    .from(student)
    .innerJoin(school, eq(school.id, schoolId))
    .leftJoin(enrollment, and(eq(enrollment.studentId, student.id), eq(enrollment.classId, classId)))
    .leftJoin(schoolClass, eq(schoolClass.id, classId))
    .leftJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .where(and(eq(student.schoolId, schoolId), eq(student.id, studentId), isNull(student.deletedAt)))
    .limit(1)
  if (!head) return null

  const subjects = await db
    .select({
      id: classSubject.id,
      subjectId: subject.id,
      subjectName: subject.name,
      teacherName: teacher.fullName,
      workloadHours: classSubject.workloadHours,
    })
    .from(classSubject)
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .leftJoin(teacher, eq(teacher.id, classSubject.teacherId))
    .where(and(eq(classSubject.schoolId, schoolId), eq(classSubject.classId, classId)))
    .orderBy(asc(subject.name))
  if (subjects.length === 0) {
    return {
      studentId,
      studentName: head.studentName,
      socialName: head.socialName,
      registrationCode: head.registrationCode,
      className: head.className,
      classGrade: head.classGrade,
      year: head.year,
      schoolName: head.schoolName,
      passingGrade: head.passingGrade,
      minAttendance: head.minAttendance,
      rows: [],
      overall: { average: null, recovery: null, final: null, status: 'PENDING' },
      attendance: { ...EMPTY_TOTALS },
    }
  }

  const [assessments, totals] = await Promise.all([
    db
      .select({
        id: assessment.id,
        classSubjectId: assessment.classSubjectId,
        kind: assessment.kind,
        weight: assessment.weight,
        maxScore: assessment.maxScore,
      })
      .from(assessment)
      .where(and(eq(assessment.schoolId, schoolId), eq(assessment.classId, classId), isNull(assessment.deletedAt))),
    getAttendanceTotalsForCard(schoolId, studentId, classId, subjects.map((s) => s.id), opts),
  ])
  const scores = assessments.length
    ? await db
        .select({ assessmentId: assessmentScore.assessmentId, score: assessmentScore.score })
        .from(assessmentScore)
        .where(
          and(
            eq(assessmentScore.schoolId, schoolId),
            eq(assessmentScore.studentId, studentId),
            inArray(assessmentScore.assessmentId, assessments.map((a) => a.id)),
          ),
        )
    : []
  const byAssessment = new Map(scores.map((s) => [s.assessmentId, s.score]))

  const rows: ReportCardRow[] = subjects.map((s) => {
    const items: GradeItem[] = assessments
      .filter((a) => a.classSubjectId === s.id)
      .map((a) => ({ kind: a.kind, weight: a.weight, maxScore: a.maxScore, score: byAssessment.get(a.id) ?? null }))
    return {
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      teacherName: s.teacherName,
      workloadHours: s.workloadHours,
      result: computeResult(items, head.passingGrade),
      attendance: totals.get(s.id) ?? { ...EMPTY_TOTALS },
    }
  })

  const finals = rows.map((r) => r.result.final).filter((v): v is number => v !== null)
  const attendance = rows.reduce((acc, r) => ({
    given: acc.given + r.attendance.given,
    absent: acc.absent + r.attendance.absent,
    late: acc.late + r.attendance.late,
    earlyLeave: acc.earlyLeave + r.attendance.earlyLeave,
  }), { ...EMPTY_TOTALS })

  return {
    studentId,
    studentName: head.studentName,
    socialName: head.socialName,
    registrationCode: head.registrationCode,
    className: head.className,
    classGrade: head.classGrade,
    year: head.year,
    schoolName: head.schoolName,
    passingGrade: head.passingGrade,
    minAttendance: head.minAttendance,
    rows,
    overall: {
      average: null,
      recovery: null,
      final: finals.length ? Math.round((finals.reduce((a, v) => a + v, 0) / finals.length) * 10) / 10 : null,
      status: finals.length === 0 ? 'PENDING' : finals.every((f) => f >= head.passingGrade) ? 'APPROVED' : 'FAILED',
    },
    attendance,
  }
}

/** Totais de frequência do aluno por disciplina no recorte, apenas das aulas já registradas. */
async function getAttendanceTotalsForCard(
  schoolId: string,
  studentId: string,
  classId: string,
  _subjectIds: string[],
  opts: { from?: string; to?: string },
): Promise<Map<string, AttendanceTotals>> {
  const { getAttendanceTotals } = await import('@/lib/attendance-queries')
  const rows = await getAttendanceTotals(schoolId, { classId, studentIds: [studentId], from: opts.from, to: opts.to })
  const out = new Map<string, AttendanceTotals>()
  for (const r of rows) {
    const t = out.get(r.classSubjectId) ?? { ...EMPTY_TOTALS }
    out.set(r.classSubjectId, {
      given: t.given + r.given,
      absent: t.absent + r.absent,
      late: t.late + r.late,
      earlyLeave: t.earlyLeave + r.earlyLeave,
    })
  }
  return out
}

export type HistoryEntry = {
  id: string
  year: number
  gradeLevel: string
  result: string
  finalAverage: number | null
  attendanceRate: number | null
  institutionName: string | null
  notes: string | null
  isCurrentSchool: boolean
}

/** Histórico escolar do aluno: anos anteriores nesta escola + registros importados. */
export async function getStudentHistory(schoolId: string, studentId: string): Promise<HistoryEntry[]> {
  const [imported, inSchool] = await Promise.all([
    db
      .select({
        id: academicHistory.id,
        year: academicYear.year,
        gradeLevel: academicHistory.gradeLevel,
        result: academicHistory.result,
        finalAverage: academicHistory.finalAverage,
        attendanceRate: academicHistory.attendanceRate,
        institutionName: academicHistory.institutionName,
        notes: academicHistory.notes,
      })
      .from(academicHistory)
      .innerJoin(academicYear, eq(academicYear.id, academicHistory.academicYearId))
      .where(and(eq(academicHistory.schoolId, schoolId), eq(academicHistory.studentId, studentId)))
      .orderBy(asc(academicYear.year)),
    db
      .select({
        id: enrollment.id,
        year: academicYear.year,
        gradeLevel: enrollment.grade,
        result: enrollment.status,
        className: schoolClass.name,
      })
      .from(enrollment)
      .innerJoin(academicYear, eq(academicYear.id, enrollment.academicYearId))
      .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
      .where(and(eq(enrollment.schoolId, schoolId), eq(enrollment.studentId, studentId)))
      .orderBy(asc(academicYear.year)),
  ])

  const byYear = new Map<number, HistoryEntry>()
  for (const r of imported) {
    byYear.set(r.year, {
      id: r.id,
      year: r.year,
      gradeLevel: r.gradeLevel,
      result: r.result,
      finalAverage: r.finalAverage === null ? null : Number(r.finalAverage),
      attendanceRate: r.attendanceRate === null ? null : Number(r.attendanceRate),
      institutionName: r.institutionName,
      notes: r.notes,
      isCurrentSchool: false,
    })
  }
  for (const r of inSchool) {
    const existing = byYear.get(r.year)
    if (existing) {
      if (r.className) existing.gradeLevel = `${r.gradeLevel} — ${r.className}`
      existing.isCurrentSchool = true
    } else {
      byYear.set(r.year, {
        id: `enrollment-${r.id}`,
        year: r.year,
        gradeLevel: r.className ? `${r.gradeLevel} — ${r.className}` : r.gradeLevel,
        result: r.result,
        finalAverage: null,
        attendanceRate: null,
        institutionName: null,
        notes: null,
        isCurrentSchool: true,
      })
    }
  }
  return [...byYear.values()].sort((a, b) => a.year - b.year)
}

export const HISTORY_RESULT_LABEL: Record<string, string> = {
  ACTIVE: 'Cursando',
  TRANSFERRED: 'Transferido',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  APPROVED: 'Aprovado',
  RETAKEN: 'Retido',
}
