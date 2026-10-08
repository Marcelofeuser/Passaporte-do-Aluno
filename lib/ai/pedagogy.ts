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
} from '@/lib/db/schema'
import { attendanceRate, EMPTY_TOTALS, type AttendanceTotals } from '@/lib/attendance'
import { computeResult, type GradeStatus } from '@/lib/grades'

/* Assistente Pedagógico (Fase 12). Análise determinística sobre os dados do tenant —
   sem alucinação: cada insight carrega os números que o gerou. LLM opcional só redige texto. */

export type SubjectTrend = {
  subjectName: string
  className: string
  /** Média por bimestre (term 1..4) — null = sem notas lançadas no bimestre. */
  termAverages: (number | null)[]
  average: number | null
  status: GradeStatus
  attendance: AttendanceTotals
  attendancePct: number | null
  minAttendance: number
}

export type StudentInsight = {
  studentId: string
  studentName: string
  socialName: string | null
  className: string | null
  overallFinal: number | null
  failingSubjects: string[]
  recoverySubjects: string[]
  /** Disciplinas em queda: último bimestre < bimestre anterior − 0.5. */
  decliningSubjects: string[]
  attendancePct: number | null
  absences: number
  risk: 'LOW' | 'MEDIUM' | 'HIGH'
  reasons: string[]
}

export type ClassSummary = {
  classId: string
  className: string
  grade: string
  year: number
  students: number
  average: number | null
  atRisk: number
  failing: number
}

export type PedagogyReport = {
  schoolId: string
  schoolName: string
  passingGrade: number
  minAttendance: number
  classes: ClassSummary[]
  students: StudentInsight[]
  generatedAt: string
}

const round1 = (n: number) => Math.round(n * 10) / 10

/** Analisa todos os alunos do ano letivo vigente da escola (multi-tenant: schoolId em toda query). */
export async function buildPedagogyReport(schoolId: string): Promise<PedagogyReport | null> {
  const [schoolRow] = await db
    .select({ name: school.name, passingGrade: school.passingGrade, minAttendance: school.minAttendance })
    .from(school)
    .where(eq(school.id, schoolId))
    .limit(1)
  if (!schoolRow) return null

  const [year] = await db
    .select({ id: academicYear.id, year: academicYear.year })
    .from(academicYear)
    .where(and(eq(academicYear.schoolId, schoolId), eq(academicYear.isCurrent, true), isNull(academicYear.deletedAt)))
    .limit(1)
  if (!year) {
    return {
      schoolId,
      schoolName: schoolRow.name,
      passingGrade: schoolRow.passingGrade,
      minAttendance: schoolRow.minAttendance,
      classes: [],
      students: [],
      generatedAt: new Date().toISOString(),
    }
  }

  // Turmas do ano vigente com nº de alunos ativos.
  const classes = await db
    .select({
      id: schoolClass.id,
      name: schoolClass.name,
      grade: schoolClass.grade,
      studentCount: sql<number>`(select count(*)::int from ${enrollment} where ${enrollment.classId} = ${schoolClass.id} and ${enrollment.status} = 'ACTIVE')`,
    })
    .from(schoolClass)
    .where(and(eq(schoolClass.schoolId, schoolId), eq(schoolClass.academicYearId, year.id), isNull(schoolClass.deletedAt)))
    .orderBy(asc(schoolClass.grade), asc(schoolClass.name))

  // Disciplinas por turma (para rotular tendências).
  const csRows = classes.length
    ? await db
        .select({ id: classSubject.id, classId: classSubject.classId, subjectName: subject.name })
        .from(classSubject)
        .innerJoin(subject, eq(subject.id, classSubject.subjectId))
        .where(and(eq(classSubject.schoolId, schoolId), inArray(classSubject.classId, classes.map((c) => c.id))))
    : []
  const csById = new Map(csRows.map((r) => [r.id, r]))

  // Avaliações do ano (peso, máx, termo, disciplina).
  const assessments = csRows.length
    ? await db
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
    : []
  const byCs = new Map<string, typeof assessments>()
  for (const a of assessments) {
    const list = byCs.get(a.classSubjectId) ?? []
    list.push(a)
    byCs.set(a.classSubjectId, list)
  }

  // Notas lançadas dos alunos das turmas do ano.
  const scores = assessments.length
    ? await db
        .select({
          assessmentId: assessmentScore.assessmentId,
          studentId: assessmentScore.studentId,
          score: assessmentScore.score,
        })
        .from(assessmentScore)
        .where(
          and(
            eq(assessmentScore.schoolId, schoolId),
            inArray(assessmentScore.assessmentId, assessments.map((a) => a.id)),
          ),
        )
    : []
  // studentId → assessmentId → score
  const scoresByStudent = new Map<string, Map<string, number | null>>()
  for (const s of scores) {
    const m = scoresByStudent.get(s.studentId) ?? new Map()
    m.set(s.assessmentId, s.score)
    scoresByStudent.set(s.studentId, m)
  }

  // Frequência do ano por aluno × disciplina.
  const attendanceRows = classes.length
    ? await db
        .select({
          studentId: attendanceRecord.studentId,
          classSubjectId: attendanceSession.classSubjectId,
          given: sql<number>`coalesce(sum(${attendanceSession.lessons}), 0)::int`,
          absent: sql<number>`coalesce(sum(${attendanceSession.lessons}) filter (where ${attendanceRecord.status} = 'ABSENT'), 0)::int`,
        })
        .from(attendanceRecord)
        .innerJoin(attendanceSession, eq(attendanceSession.id, attendanceRecord.sessionId))
        .where(
          and(
            eq(attendanceRecord.schoolId, schoolId),
            inArray(attendanceSession.classId, classes.map((c) => c.id)),
          ),
        )
        .groupBy(attendanceRecord.studentId, attendanceSession.classSubjectId)
    : []

  const attendanceByStudent = new Map<string, Map<string, AttendanceTotals>>()
  for (const r of attendanceRows) {
    const m = attendanceByStudent.get(r.studentId) ?? new Map()
    const t = m.get(r.classSubjectId) ?? { ...EMPTY_TOTALS }
    m.set(r.classSubjectId, { ...t, given: t.given + r.given, absent: t.absent + r.absent })
    attendanceByStudent.set(r.studentId, m)
  }

  // Alunos ativos do ano.
  const roster = await db
    .select({
      studentId: student.id,
      studentName: student.fullName,
      socialName: student.socialName,
      classId: enrollment.classId,
      className: schoolClass.name,
      grade: schoolClass.grade,
    })
    .from(enrollment)
    .innerJoin(student, and(eq(student.id, enrollment.studentId), isNull(student.deletedAt)))
    .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(
      and(
        eq(enrollment.schoolId, schoolId),
        eq(enrollment.academicYearId, year.id),
        eq(enrollment.status, 'ACTIVE'),
      ),
    )
    .orderBy(asc(student.fullName))

  const insights: StudentInsight[] = []
  const classAgg = new Map<string, { sum: number; n: number; risk: number; failing: number }>()

  for (const stu of roster) {
    const myScores = scoresByStudent.get(stu.studentId) ?? new Map()
    const myAttendance = attendanceByStudent.get(stu.studentId) ?? new Map()
    const perSubject: SubjectTrend[] = []

    for (const cs of csRows.filter((r) => r.classId === stu.classId)) {
      const items = (byCs.get(cs.id) ?? []).map((a) => ({
        kind: a.kind,
        weight: a.weight,
        maxScore: a.maxScore,
        score: myScores.get(a.id) ?? null,
      }))
      const result = computeResult(items, schoolRow.passingGrade)

      // Média por bimestre (term) para tendência.
      const terms = new Map<number, { sum: number; w: number }>()
      for (const a of byCs.get(cs.id) ?? []) {
        const sc = myScores.get(a.id)
        if (sc === null || sc === undefined || a.kind === 'RECOVERY') continue
        const t = terms.get(a.term) ?? { sum: 0, w: 0 }
        t.sum += ((sc / a.maxScore) * 10 * a.weight)
        t.w += a.weight
        terms.set(a.term, t)
      }
      const maxTerm = Math.max(0, ...[...terms.keys()])
      const termAverages: (number | null)[] = []
      for (let i = 1; i <= Math.max(4, maxTerm); i++) {
        const t = terms.get(i)
        termAverages.push(t && t.w > 0 ? round1(t.sum / t.w) : null)
      }

      const att = myAttendance.get(cs.id) ?? { ...EMPTY_TOTALS }
      perSubject.push({
        subjectName: cs.subjectName,
        className: stu.className ?? '',
        termAverages,
        average: result.average,
        status: result.status,
        attendance: att,
        attendancePct: attendanceRate(att),
        minAttendance: schoolRow.minAttendance,
      })
    }

    const finals = perSubject.map((s) => (s.status === 'PENDING' ? null : s.average)).filter((v): v is number => v !== null)
    const overall = finals.length ? round1(finals.reduce((a, v) => a + v, 0) / finals.length) : null
    const failing = perSubject.filter((s) => s.status === 'FAILED').map((s) => s.subjectName)
    const recovery = perSubject.filter((s) => s.status === 'RECOVERY').map((s) => s.subjectName)
    const declining = perSubject
      .filter((s) => {
        const ts = s.termAverages.filter((v): v is number => v !== null)
        if (ts.length < 2) return false
        return ts[ts.length - 1] < ts[ts.length - 2] - 0.5
      })
      .map((s) => s.subjectName)

    const totalAtt: AttendanceTotals = perSubject.reduce(
      (acc, s) => ({
        given: acc.given + s.attendance.given,
        absent: acc.absent + s.attendance.absent,
        late: acc.late + s.attendance.late,
        earlyLeave: acc.earlyLeave + s.attendance.earlyLeave,
      }),
      { ...EMPTY_TOTALS },
    )
    const attPct = attendanceRate(totalAtt)

    // Risco: reprovação ≥2 disciplinas ou (1 reprovação + frequência baixa) → HIGH etc.
    const reasons: string[] = []
    let risk: StudentInsight['risk'] = 'LOW'
    if (failing.length >= 2) {
      risk = 'HIGH'
      reasons.push(`Reprovado em ${failing.length} disciplinas`)
    } else if (failing.length === 1) {
      risk = attPct !== null && attPct < schoolRow.minAttendance ? 'HIGH' : 'MEDIUM'
      reasons.push(`Reprovado em ${failing[0]}`)
    } else if (recovery.length > 0) {
      risk = 'MEDIUM'
      reasons.push(`Em recuperação em ${recovery.length} disciplina(s)`)
    }
    if (attPct !== null && attPct < schoolRow.minAttendance) {
      reasons.push(`Frequência ${attPct.toFixed(1)}% abaixo do mínimo (${schoolRow.minAttendance}%)`)
      if (risk === 'LOW') risk = 'MEDIUM'
    }
    if (declining.length > 0 && risk === 'LOW') {
      risk = 'MEDIUM'
      reasons.push(`Queda de notas em ${declining.join(', ')}`)
    }

    insights.push({
      studentId: stu.studentId,
      studentName: stu.studentName,
      socialName: stu.socialName,
      className: stu.className,
      overallFinal: overall,
      failingSubjects: failing,
      recoverySubjects: recovery,
      decliningSubjects: declining,
      attendancePct: attPct,
      absences: totalAtt.absent,
      risk,
      reasons,
    })

    const agg = classAgg.get(stu.classId ?? '') ?? { sum: 0, n: 0, risk: 0, failing: 0 }
    agg.n += 1
    if (overall !== null) {
      agg.sum += overall
      agg.risk += risk !== 'LOW' ? 1 : 0
      if (failing.length > 0) agg.failing += 1
    }
    classAgg.set(stu.classId ?? '', agg)
  }

  const classSummaries: ClassSummary[] = classes.map((c) => {
    const agg = classAgg.get(c.id)
    return {
      classId: c.id,
      className: c.name,
      grade: c.grade,
      year: year.year,
      students: c.studentCount,
      average: agg && agg.n > 0 ? round1(agg.sum / agg.n) : null,
      atRisk: agg?.risk ?? 0,
      failing: agg?.failing ?? 0,
    }
  })

  return {
    schoolId,
    schoolName: schoolRow.name,
    passingGrade: schoolRow.passingGrade,
    minAttendance: schoolRow.minAttendance,
    classes: classSummaries,
    students: insights,
    generatedAt: new Date().toISOString(),
  }
}
