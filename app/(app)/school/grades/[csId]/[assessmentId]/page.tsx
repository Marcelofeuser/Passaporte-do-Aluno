import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { archiveAssessment, saveScores } from '@/app/actions/grades'
import { ActionForm, ConfirmSubmit } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import {
  getAssessment,
  getClassSubjectForGrading,
  getScoreHistory,
  getScores,
  gradeScope,
} from '@/lib/grade-queries'
import { formatScore } from '@/lib/grades'
import { UUID_RE } from '@/lib/school-action'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { getClassRoster } from '@/lib/school-queries'
import { ASSESSMENT_KINDS } from '@/lib/validation'

export const metadata: Metadata = { title: 'Lançar notas' }

export default async function AssessmentPage({
  params,
}: {
  params: Promise<{ csId: string; assessmentId: string }>
}) {
  const { csId, assessmentId } = await params
  if (!UUID_RE.test(csId) || !UUID_RE.test(assessmentId)) notFound()
  const { ctx, schoolId, role } = await requireSchoolPage('school:manage_grades')
  const scope = await gradeScope(schoolId, role, ctx.user.id, ctx.user.email)
  const [cs, a] = await Promise.all([
    getClassSubjectForGrading(schoolId, csId, scope),
    getAssessment(schoolId, assessmentId),
  ])
  if (!cs || !a || a.classSubjectId !== cs.id) notFound()

  const [roster, scores, history] = await Promise.all([
    getClassRoster(schoolId, cs.classId),
    getScores(schoolId, [a.id]),
    getScoreHistory(schoolId, a.id),
  ])
  const byStudent = new Map(scores.map((s) => [s.studentId, s.score]))
  const hasScores = scores.some((s) => s.score !== null)

  return (
    <>
      <BackLink href={`/school/grades/${csId}`}>{cs.subjectName}</BackLink>
      <PageTitle
        title={a.title}
        description={`${cs.className} · ${ASSESSMENT_KINDS[a.kind as keyof typeof ASSESSMENT_KINDS] ?? a.kind} · ${a.term}º bimestre · ${formatDate(a.heldOn)} · peso ${formatScore(a.weight)} · vale ${formatScore(a.maxScore)}`}
      />

      <Card>
        <CardHeader
          title="Notas"
          description={`De 0 a ${formatScore(a.maxScore)}. Deixe em branco quem não fez. Use vírgula para decimais.`}
        />
        {roster.length === 0 ? (
          <EmptyState title="Sem alunos" description="Não há alunos com matrícula ativa nesta turma." />
        ) : (
          <ActionForm action={saveScores} submitLabel="Salvar notas" className="flex flex-col gap-4 p-4">
            <input type="hidden" name="assessmentId" value={a.id} />
            <ul className="divide-y divide-border rounded-lg border border-border">
              {roster.map((r) => {
                const current = byStudent.get(r.studentId)
                const inputId = `score-${r.enrollmentId}`
                return (
                  <li key={r.enrollmentId} className="flex items-center gap-3 px-3 py-2">
                    <label htmlFor={inputId} className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{r.socialName ?? r.fullName}</span>
                      {r.registrationCode ? (
                        <span className="text-xs text-muted-foreground">Matrícula {r.registrationCode}</span>
                      ) : null}
                    </label>
                    <Input
                      id={inputId}
                      name={`score:${r.enrollmentId}`}
                      inputMode="decimal"
                      autoComplete="off"
                      defaultValue={current === null || current === undefined ? '' : String(current).replace('.', ',')}
                      className="w-24 text-right tabular-nums"
                    />
                  </li>
                )
              })}
            </ul>
            {hasScores ? (
              <Field
                label="Justificativa da alteração"
                htmlFor="reason"
                hint="Obrigatória para alterar notas já lançadas. Fica registrada no histórico."
              >
                <Input id="reason" name="reason" maxLength={300} />
              </Field>
            ) : null}
          </ActionForm>
        )}
      </Card>

      <Card>
        <CardHeader title="Histórico de alterações" description="Toda alteração de nota já lançada fica registrada." />
        {history.length === 0 ? (
          <EmptyState title="Sem alterações" description="Nenhuma nota foi alterada após o lançamento." />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <span className="font-semibold">
                  {h.studentName}: {formatScore(h.oldScore)} → {formatScore(h.newScore)}
                </span>
                <span className="text-muted-foreground">
                  {h.changedBy ?? 'Usuário removido'} · {h.createdAt.toLocaleString('pt-BR')}
                  {h.reason ? ` · ${h.reason}` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <form action={archiveAssessment} className="flex justify-end">
        <input type="hidden" name="assessmentId" value={a.id} />
        <ConfirmSubmit confirm="Excluir esta avaliação? As notas deixarão de contar na média.">Excluir avaliação</ConfirmSubmit>
      </form>
    </>
  )
}
