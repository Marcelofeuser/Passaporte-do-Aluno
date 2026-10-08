import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { getStudentHistory, HISTORY_RESULT_LABEL } from '@/lib/report-card'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Histórico escolar' }

export default async function FamilyHistoryPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const sp = await searchParams
  const isStudent = role === 'STUDENT'
  const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)

  if (students.length === 0) {
    return (
      <>
        <PageTitle title="Histórico escolar" />
        <Card>
          <EmptyState
            title="Nenhum aluno vinculado"
            description="Peça à secretaria para vincular seus filhos usando o mesmo e-mail da sua conta."
          />
        </Card>
      </>
    )
  }

  const selected = students.find((s) => s.id === sp.student) ?? students[0]
  const history = await getStudentHistory(schoolId, selected.id)

  return (
    <>
      <PageTitle title="Histórico escolar" description="Trajetória do aluno: anos letivos cursados e resultados." />

      {students.length > 1 ? (
        <nav aria-label="Escolher aluno" className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/family/history?student=${s.id}`}
              aria-current={s.id === selected.id ? 'page' : undefined}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {s.socialName || s.fullName}
            </Link>
          ))}
        </nav>
      ) : null}

      <Card>
        <CardHeader title="Linha do tempo" description={selected.socialName || selected.fullName} />
        {history.length === 0 ? (
          <EmptyState
            title="Nenhum registro"
            description="Anos letivos cursados nesta escola e registros importados aparecem aqui."
          />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {history.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {entry.year} · {entry.gradeLevel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {entry.institutionName ? `${entry.institutionName} · ` : ''}
                    {entry.isCurrentSchool ? 'Nesta escola' : 'Registro importado'}
                    {entry.finalAverage !== null ? ` · Média: ${entry.finalAverage.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}` : ''}
                    {entry.attendanceRate !== null ? ` · Frequência: ${entry.attendanceRate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%` : ''}
                    {entry.notes ? ` · ${entry.notes}` : ''}
                  </p>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-muted-foreground">
                  {HISTORY_RESULT_LABEL[entry.result] ?? entry.result}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
