import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { getStudentBehaviorSummary, listStudentOccurrences } from '@/lib/occurrence-queries'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { OCCURRENCE_SEVERITY, OCCURRENCE_STATUS } from '@/lib/validation'

export const metadata: Metadata = { title: 'Ocorrências da família' }

export default async function FamilyOccurrencesPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>
}) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const isStudent = role === 'STUDENT'
  const sp = await searchParams

  const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)
  if (students.length === 0) {
    return (
      <>
        <PageTitle title="Ocorrências" />
        <Card>
          <EmptyState title="Nenhum aluno vinculado" description="Procure a secretaria para vincular o cadastro à sua conta." />
        </Card>
      </>
    )
  }

  const selected = students.find((s) => s.id === sp.student) ?? students[0]
  const [summary, result] = await Promise.all([
    getStudentBehaviorSummary(schoolId, selected.id),
    listStudentOccurrences(schoolId, selected.id, { visibleOnly: true, limit: 100 }),
  ])

  return (
    <>
      <PageTitle
        title={isStudent ? 'Minhas ocorrências' : 'Ocorrências da família'}
        description="Apenas ocorrências marcadas pela escola como visíveis para a família. Ocorrências internas não são exibidas aqui."
      />

      {students.length > 1 ? (
        <nav aria-label="Escolher aluno" className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/family/occurrences?student=${s.id}`}
              aria-current={s.id === selected.id ? 'page' : undefined}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {s.socialName ?? s.fullName}
            </Link>
          ))}
        </nav>
      ) : null}

      <Card>
        <CardHeader title="Resumo comportamental" description={`Aluno selecionado: ${selected.socialName ?? selected.fullName}`} />
        <dl className="grid grid-cols-2 gap-4 px-4 pb-4 sm:grid-cols-4">
          <Stat label="Mês" value={String(summary.monthTotal)} />
          <Stat label="Ano" value={String(summary.yearTotal)} />
          <Stat label="Graves (mês)" value={String(summary.month.GRAVE)} />
          <Stat label="Graves (ano)" value={String(summary.year.GRAVE)} />
        </dl>
      </Card>

      <Card>
        <CardHeader title="Histórico" />
        {result.length === 0 ? (
          <EmptyState title="Nenhuma ocorrência visível" description="Quando houver registros compartilhados pela escola, eles aparecerão aqui." />
        ) : (
          <ul className="divide-y divide-border">
            {result.map((o) => (
              <li key={o.id} className="px-4 py-3">
                <p className="font-semibold">{o.typeName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(o.occurredAt)} · {OCCURRENCE_SEVERITY[o.severity as keyof typeof OCCURRENCE_SEVERITY]} ·{' '}
                  {OCCURRENCE_STATUS[o.status as keyof typeof OCCURRENCE_STATUS]}
                </p>
                <p className="mt-1 text-sm leading-relaxed">{o.description}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-bold tabular-nums">{value}</dd>
    </div>
  )
}
