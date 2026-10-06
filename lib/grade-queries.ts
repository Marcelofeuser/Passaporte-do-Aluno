import { and, asc, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  academicYear,
  assessment,
  assessmentScore,
  classSubject,
  school,
  schoolClass,
  scoreChange,
  student,
  subject,
  teacher,
  user,
} from '@/lib/db/schema'
import { can, type Role } from '@/lib/rbac'

/* Todas as funções recebem `schoolId` do vínculo ativo validado no servidor. */

/** Cadastro de professor da escola ligado ao usuário (por conta ou e-mail). */
export async function getTeacherIdForUser(schoolId: string, userId: string, email: string) {
  const [row] = await db
    .select({ id: teacher.id })
    .from(teacher)
    .where(
      and(
        eq(teacher.schoolId, schoolId),
        isNull(teacher.deletedAt),
        or(eq(teacher.userId, userId), sql`lower(${teacher.email}) = lower(${email})`),
      ),
    )
    .limit(1)
  return row?.id ?? null
}

/** Escopo de lançamento: `null` = todas as disciplinas (gestão); string = só as do professor. */
export async function gradeScope(schoolId: string, role: Role | null, userId: string, email: string) {
  if (can(role, 'school:manage_all_grades')) return { all: true as const, teacherId: null }
  const teacherId = await getTeacherIdForUser(schoolId, userId, email)
  return { all: false as const, teacherId }
}

export type GradeScope = Awaited<ReturnType<typeof gradeScope>>

export async function getPassingGrade(schoolId: string) {
  const [row] = await db.select({ v: school.passingGrade }).from(school).where(eq(school.id, schoolId))
  return row?.v ?? 6
}

const classSubjectFields = {
  id: classSubject.id,
  classId: classSubject.classId,
  subjectId: classSubject.subjectId,
  teacherId: classSubject.teacherId,
  workloadHours: classSubject.workloadHours,
  className: schoolClass.name,
  grade: schoolClass.grade,
  year: academicYear.year,
  isCurrentYear: academicYear.isCurrent,
  subjectName: subject.name,
  teacherName: teacher.fullName,
}

function baseClassSubjectQuery() {
  return db
    .select(classSubjectFields)
    .from(classSubject)
    .innerJoin(schoolClass, eq(schoolClass.id, classSubject.classId))
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .leftJoin(teacher, eq(teacher.id, classSubject.teacherId))
}

export async function listGradebook(schoolId: string, scope: GradeScope) {
  if (!scope.all && !scope.teacherId) return []
  const filters = [eq(classSubject.schoolId, schoolId), isNull(schoolClass.deletedAt), eq(academicYear.isCurrent, true)]
  if (!scope.all) filters.push(eq(classSubject.teacherId, scope.teacherId!))
  const rows = await baseClassSubjectQuery()
    .where(and(...filters))
    .orderBy(asc(schoolClass.grade), asc(schoolClass.name), asc(subject.name))
  if (rows.length === 0) return []
  const totals = await db
    .select({ classSubjectId: assessment.classSubjectId, n: sql<number>`count(*)::int` })
    .from(assessment)
    .where(and(eq(assessment.schoolId, schoolId), isNull(assessment.deletedAt), inArray(assessment.classSubjectId, rows.map((r) => r.id))))
    .groupBy(assessment.classSubjectId)
  const byCs = new Map(totals.map((t) => [t.classSubjectId, t.n]))
  return rows.map((r) => ({ ...r, assessments: byCs.get(r.id) ?? 0 }))
}

/** Disciplina da turma, somente se o usuário puder lançar notas nela. */
export async function getClassSubjectForGrading(schoolId: string, classSubjectId: string, scope: GradeScope) {
  if (!scope.all && !scope.teacherId) return null
  const filters = [eq(classSubject.id, classSubjectId), eq(classSubject.schoolId, schoolId), isNull(schoolClass.deletedAt)]
  if (!scope.all) filters.push(eq(classSubject.teacherId, scope.teacherId!))
  const [row] = await baseClassSubjectQuery().where(and(...filters))
  return row ?? null
}

export async function listAssessments(schoolId: string, classSubjectId: string) {
  return db
    .select()
    .from(assessment)
    .where(and(eq(assessment.schoolId, schoolId), eq(assessment.classSubjectId, classSubjectId), isNull(assessment.deletedAt)))
    .orderBy(asc(assessment.term), asc(assessment.heldOn), asc(assessment.createdAt))
}

export async function getAssessment(schoolId: string, assessmentId: string) {
  const [row] = await db
    .select()
    .from(assessment)
    .where(and(eq(assessment.id, assessmentId), eq(assessment.schoolId, schoolId), isNull(assessment.deletedAt)))
  return row ?? null
}

export async function getScores(schoolId: string, assessmentIds: string[]) {
  if (assessmentIds.length === 0) return []
  return db
    .select()
    .from(assessmentScore)
    .where(and(eq(assessmentScore.schoolId, schoolId), inArray(assessmentScore.assessmentId, assessmentIds)))
}

export async function getScoreHistory(schoolId: string, assessmentId: string) {
  return db
    .select({
      id: scoreChange.id,
      oldScore: scoreChange.oldScore,
      newScore: scoreChange.newScore,
      reason: scoreChange.reason,
      createdAt: scoreChange.createdAt,
      changedBy: user.name,
      studentName: student.fullName,
    })
    .from(scoreChange)
    .innerJoin(assessmentScore, eq(assessmentScore.id, scoreChange.scoreId))
    .innerJoin(student, eq(student.id, assessmentScore.studentId))
    .leftJoin(user, eq(user.id, scoreChange.changedBy))
    .where(and(eq(scoreChange.schoolId, schoolId), eq(assessmentScore.assessmentId, assessmentId)))
    .orderBy(sql`${scoreChange.createdAt} desc`)
    .limit(50)
}

/** Boletim do aluno na turma: avaliações e notas por disciplina. */
export async function getStudentReport(schoolId: string, studentId: string, classId: string) {
  const subjects = await db
    .select({
      id: classSubject.id,
      subjectName: subject.name,
      workloadHours: classSubject.workloadHours,
      teacherName: teacher.fullName,
    })
    .from(classSubject)
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .leftJoin(teacher, eq(teacher.id, classSubject.teacherId))
    .where(and(eq(classSubject.schoolId, schoolId), eq(classSubject.classId, classId)))
    .orderBy(asc(subject.name))
  if (subjects.length === 0) return []

  const assessments = await db
    .select({
      id: assessment.id,
      classSubjectId: assessment.classSubjectId,
      kind: assessment.kind,
      weight: assessment.weight,
      maxScore: assessment.maxScore,
    })
    .from(assessment)
    .where(and(eq(assessment.schoolId, schoolId), eq(assessment.classId, classId), isNull(assessment.deletedAt)))
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

  return subjects.map((s) => ({
    ...s,
    items: assessments
      .filter((a) => a.classSubjectId === s.id)
      .map((a) => ({ kind: a.kind, weight: a.weight, maxScore: a.maxScore, score: byAssessment.get(a.id) ?? null })),
  }))
}
