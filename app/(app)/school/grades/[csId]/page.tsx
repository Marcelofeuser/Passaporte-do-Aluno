import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAssessment } from '@/app/actions/grades'
import { ActionForm } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { getClassSubjectForGrading, getPassingGrade, getScores, gradeScope, listAssessments } from '@/lib/grade-queries'
import { computeResult, formatScore, GRADE_STATUS_LABEL } from '@/lib/grades'
import { UUID_RE } from '@/lib/school-action'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { getClassRoster } from '@/lib/school-queries'
import { ASSESSMENT_KINDS } from '@/lib/validation'

export const metadata: Metadata = { title: 'Diário da disciplina' }

const STATUS_TONE: Record<string, string> = {
  APPROVED: 'text-primary',
  RECOVERY: 'text-accent-foreground',
  FAILED: 'text-destructive',
  PENDING: 'text-muted-foreground',
}

export default async function GradebookPage({ params }: { params: Promise<{ csId: string }> }) {
  const { csId } = await params
  if (!UUID_RE.test(csId)) notFound()
  const { ctx, schoolId, role } = await requireSchoolPage('school:manage_grades')
  const scope = await gradeScope(schoolId, role, ctx.user.id, ctx.user.email)
  const cs = await getClassSubjectForGrading(schoolId, csId, scope)
  if (!cs) notFound()

  const [assessments, roster, passingGrade] = await Promise.all([
    listAssessments(schoolId, csId),
    getClassRoster(schoolId, cs.classId),
    getPassingGrade(schoolId),
  ])
  const scores = await getScores(schoolId, assessments.map((a) => a.id))
  const scoreKey = (assessmentId: string, studentId: string) => `${assessmentId}:${studentId}`
  const byKey = new Map(scores.map((s) => [scoreKey(s.assessmentId, s.studentId), s.score]))

  const results = roster.map((r) => ({
    ...r,
    result: computeResult(
      assessments.map((a) => ({
        kind: a.kind,
        weight: a.weight,
        maxScore: a.maxScore,
        score: byKey.get(scoreKey(a.id, r.studentId)) ?? null,
      })),
      passingGrade,
    ),
  }))

  return (
    <>
      <BackLink href="/school/grades">Diário e notas</BackLink>
      <PageTitle
        title={cs.subjectName}
        description={`${cs.className} · ${cs.grade} · ${cs.year}${cs.teacherName ? ` · ${cs.teacherName}` : ''}${cs.workloadHours ? ` · ${cs.workloadHours} h/ano` : ''}`}
      />

      <Card>
        <CardHeader title="Avaliações" description="Abra uma avaliação para lançar ou corrigir notas." />
        {assessments.length === 0 ? (
          <EmptyState title="Nenhuma avaliação" description="Crie a primeira avaliação abaixo." />
        ) : (
          <ul className="divide-y divide-border">
            {assessments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/school/grades/${csId}/${a.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{a.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {ASSESSMENT_KINDS[a.kind as keyof typeof ASSESSMENT_KINDS] ?? a.kind} · {a.term}º bimestre ·{' '}
                      {formatDate(a.heldOn)} · peso {formatScore(a.weight)} · vale {formatScore(a.maxScore)}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-primary">Lançar notas</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <details className="border-t border-border">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Nova avaliação</summary>
          <ActionForm action={createAssessment} submitLabel="Criar avaliação" className="border-t border-border p-4">
            <input type="hidden" name="classSubjectId" value={csId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título" htmlFor="title">
                <Input id="title" name="title" required maxLength={120} placeholder="Prova 1" />
              </Field>
              <Field label="Tipo" htmlFor="kind">
                <Select id="kind" name="kind" required defaultValue="EXAM">
                  {Object.entries(ASSESSMENT_KINDS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Bimestre" htmlFor="term">
                <Select id="term" name="term" required defaultValue="1">
                  {[1, 2, 3, 4].map((t) => (
                    <option key={t} value={t}>
                      {t}º bimestre
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Data" htmlFor="heldOn">
                <Input id="heldOn" name="heldOn" type="date" required />
              </Field>
              <Field label="Peso" htmlFor="weight">
                <Input id="weight" name="weight" inputMode="decimal" required defaultValue="1" />
              </Field>
              <Field label="Nota máxima" htmlFor="maxScore">
                <Input id="maxScore" name="maxScore" inputMode="decimal" required defaultValue="10" />
              </Field>
            </div>
          </ActionForm>
        </details>
      </Card>

      <Card>
        <CardHeader
          title="Médias da turma"
          description={`Média ponderada (0 a 10). A recuperação substitui a média quando maior. Aprovação: ${formatScore(passingGrade)}.`}
        />
        {results.length === 0 ? (
          <EmptyState title="Sem alunos" description="Não há alunos com matrícula ativa nesta turma." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Aluno</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Média</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Recup.</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Final</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {results.map((r) => (
                  <tr key={r.enrollmentId}>
                    <th scope="row" className="px-4 py-2 text-left font-medium">
                      {r.socialName ?? r.fullName}
                    </th>
                    <td className="px-4 py-2 text-right tabular-nums">{formatScore(r.result.average)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatScore(r.result.recovery)}</td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatScore(r.result.final)}</td>
                    <td className={`px-4 py-2 font-semibold ${STATUS_TONE[r.result.status]}`}>
                      {GRADE_STATUS_LABEL[r.result.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
