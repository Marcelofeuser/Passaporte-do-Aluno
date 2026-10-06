'use server'

import { and, eq, inArray, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { assessment, assessmentScore, enrollment, school, scoreChange } from '@/lib/db/schema'
import { getAssessment, getClassSubjectForGrading, gradeScope } from '@/lib/grade-queries'
import { requireSchoolAction, runAction, runVoidAction, UUID_RE } from '@/lib/school-action'
import {
  assessmentInput,
  formText,
  parseScore,
  passingGradeInput,
  toFieldErrors,
  type ActionState,
} from '@/lib/validation'

const GRADES = 'school:manage_grades' as const

/** Contexto de lançamento: escola ativa + escopo (gestão vê tudo; professor só as suas disciplinas). */
async function gradingContext() {
  const { ctx, schoolId, userId } = await requireSchoolAction(GRADES)
  const scope = await gradeScope(schoolId, ctx.active?.role ?? null, userId, ctx.user.email)
  return { schoolId, userId, scope }
}

export async function createAssessment(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('assessment.create_failed', async () => {
    const { schoolId, userId, scope } = await gradingContext()
    const parsed = assessmentInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const data = parsed.data

    const cs = await getClassSubjectForGrading(schoolId, data.classSubjectId, scope)
    if (!cs) return { ok: false, message: 'Você não leciona esta disciplina nesta turma.' }

    const [row] = await db
      .insert(assessment)
      .values({
        schoolId,
        classSubjectId: cs.id,
        classId: cs.classId,
        subjectId: cs.subjectId,
        teacherId: cs.teacherId,
        kind: data.kind,
        title: data.title,
        term: data.term,
        heldOn: data.heldOn,
        weight: data.weight,
        maxScore: data.maxScore,
        notes: data.notes ?? null,
        createdBy: userId,
      })
      .returning({ id: assessment.id })

    await recordAudit({
      action: 'assessment.created',
      entityType: 'assessment',
      entityId: row.id,
      schoolId,
      actorUserId: userId,
      metadata: { classSubjectId: cs.id, kind: data.kind, title: data.title },
    })
    revalidatePath(`/school/grades/${cs.id}`)
    redirect(`/school/grades/${cs.id}/${row.id}`)
  })
}

export async function archiveAssessment(formData: FormData): Promise<void> {
  const assessmentId = String(formData.get('assessmentId') ?? '')
  if (!UUID_RE.test(assessmentId)) return
  let target: string | null = null
  await runVoidAction('assessment.archive_failed', async () => {
    const { schoolId, userId, scope } = await gradingContext()
    const a = await getAssessment(schoolId, assessmentId)
    if (!a || !(await getClassSubjectForGrading(schoolId, a.classSubjectId, scope))) return
    await db
      .update(assessment)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(assessment.id, a.id), eq(assessment.schoolId, schoolId)))
    await recordAudit({
      action: 'assessment.archived',
      entityType: 'assessment',
      entityId: a.id,
      schoolId,
      actorUserId: userId,
      metadata: { title: a.title },
    })
    target = a.classSubjectId
  })
  if (target) {
    revalidatePath(`/school/grades/${target}`)
    redirect(`/school/grades/${target}`)
  }
}

/**
 * Salva as notas de uma avaliação. Campos `score:<enrollmentId>`.
 * Alterar uma nota já lançada exige justificativa e gera histórico.
 */
export async function saveScores(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('scores.save_failed', async () => {
    const { schoolId, userId, scope } = await gradingContext()
    const assessmentId = String(formData.get('assessmentId') ?? '')
    if (!UUID_RE.test(assessmentId)) return { ok: false, message: 'Avaliação inválida.' }
    const a = await getAssessment(schoolId, assessmentId)
    if (!a || !(await getClassSubjectForGrading(schoolId, a.classSubjectId, scope))) {
      return { ok: false, message: 'Você não pode lançar notas nesta avaliação.' }
    }
    const reason = String(formData.get('reason') ?? '').trim().slice(0, 300)

    const entries: { enrollmentId: string; score: number | null }[] = []
    const fieldErrors: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('score:')) continue
      const enrollmentId = key.slice(6)
      if (!UUID_RE.test(enrollmentId)) continue
      const score = parseScore(String(value), a.maxScore)
      if (score === undefined) fieldErrors[key] = `Nota deve estar entre 0 e ${a.maxScore}`
      else entries.push({ enrollmentId, score })
    }
    if (Object.keys(fieldErrors).length) {
      return { ok: false, message: 'Corrija as notas destacadas.', fieldErrors }
    }
    if (entries.length === 0) return { ok: false, message: 'Nenhuma nota enviada.' }

    // Só alunos com matrícula ativa nesta turma e escola.
    const active = await db
      .select({ id: enrollment.id, studentId: enrollment.studentId })
      .from(enrollment)
      .where(
        and(
          eq(enrollment.schoolId, schoolId),
          eq(enrollment.classId, a.classId),
          eq(enrollment.status, 'ACTIVE'),
          inArray(enrollment.id, entries.map((e) => e.enrollmentId)),
        ),
      )
    const studentByEnrollment = new Map(active.map((e) => [e.id, e.studentId]))

    const existing = await db
      .select()
      .from(assessmentScore)
      .where(and(eq(assessmentScore.schoolId, schoolId), eq(assessmentScore.assessmentId, a.id)))
    const byStudent = new Map(existing.map((s) => [s.studentId, s]))

    const changes = entries
      .filter((e) => studentByEnrollment.has(e.enrollmentId))
      .map((e) => {
        const studentId = studentByEnrollment.get(e.enrollmentId)!
        return { ...e, studentId, prev: byStudent.get(studentId) }
      })
      .filter((c) => (c.prev ? c.prev.score !== c.score : c.score !== null))

    if (changes.length === 0) return { ok: true, message: 'Nenhuma alteração para salvar.' }

    const edits = changes.filter((c) => c.prev && c.prev.score !== null)
    if (edits.length > 0 && reason.length < 5) {
      return {
        ok: false,
        message: `${edits.length} nota(s) já lançada(s) serão alteradas. Informe a justificativa.`,
        fieldErrors: { reason: 'Justificativa obrigatória (mín. 5 caracteres)' },
      }
    }

    const now = new Date()
    for (const c of changes) {
      if (c.prev) {
        await db
          .update(assessmentScore)
          .set({ score: c.score, updatedBy: userId, updatedAt: now })
          .where(and(eq(assessmentScore.id, c.prev.id), eq(assessmentScore.schoolId, schoolId)))
        if (c.prev.score !== null) {
          await db.insert(scoreChange).values({
            schoolId,
            scoreId: c.prev.id,
            oldScore: c.prev.score,
            newScore: c.score,
            reason,
            changedBy: userId,
          })
        }
      } else {
        await db.insert(assessmentScore).values({
          schoolId,
          assessmentId: a.id,
          studentId: c.studentId,
          enrollmentId: c.enrollmentId,
          score: c.score,
          updatedBy: userId,
        })
      }
    }

    await recordAudit({
      action: 'scores.saved',
      entityType: 'assessment',
      entityId: a.id,
      schoolId,
      actorUserId: userId,
      metadata: { launched: changes.length - edits.length, edited: edits.length, reason: edits.length ? reason : null },
    })
    revalidatePath(`/school/grades/${a.classSubjectId}`)
    revalidatePath(`/school/grades/${a.classSubjectId}/${a.id}`)
    return {
      ok: true,
      message: edits.length
        ? `Notas salvas. ${edits.length} alteração(ões) registrada(s) no histórico.`
        : `${changes.length} nota(s) lançada(s).`,
    }
  })
}

export async function updatePassingGrade(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('school.passing_grade_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_all_grades')
    const parsed = passingGradeInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    await db
      .update(school)
      .set({ passingGrade: parsed.data.passingGrade, updatedAt: new Date() })
      .where(and(eq(school.id, schoolId), isNull(school.deletedAt)))
    await recordAudit({
      action: 'school.passing_grade_updated',
      entityType: 'school',
      entityId: schoolId,
      schoolId,
      actorUserId: userId,
      metadata: { passingGrade: parsed.data.passingGrade },
    })
    revalidatePath('/school/grades')
    return { ok: true, message: 'Média de aprovação atualizada.' }
  })
}
