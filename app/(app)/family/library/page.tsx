import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { todayISO } from '@/lib/attendance'
import { getCurrentEnrollments, getFamilyStudents } from '@/lib/attendance-queries'
import { formatMoney, LOAN_STATUS, loanTiming, timingLabel, timingTone, type LoanStatus } from '@/lib/library'
import { dispatchLibraryAlertsSafe } from '@/lib/library-alerts'
import { getLibraryRules, listLoans } from '@/lib/library-queries'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Biblioteca' }

export default async function FamilyLibraryPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const sp = await searchParams
  const isStudent = role === 'STUDENT'
  const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)

  if (students.length === 0) {
    return (
      <>
        <PageTitle title="Biblioteca" />
        <Card>
          <EmptyState
            title="Nenhum aluno vinculado"
            description={
              isStudent
                ? 'Seu cadastro de aluno ainda não está ligado à sua conta. Procure a secretaria.'
                : 'Peça à secretaria para vincular seus filhos usando o mesmo e-mail da sua conta.'
            }
          />
        </Card>
      </>
    )
  }

  after(() => dispatchLibraryAlertsSafe(schoolId))

  // O aluno escolhido só vale se estiver na lista autorizada; senão usa o primeiro.
  const selected = students.find((s) => s.id === sp.student) ?? students[0]
  const today = todayISO()
  const [[enr], rules] = await Promise.all([getCurrentEnrollments(schoolId, [selected.id]), getLibraryRules(schoolId)])
  const yearFrom = enr?.startsOn ?? `${today.slice(0, 4)}-01-01`
  const [current, closed] = await Promise.all([
    listLoans(schoolId, { studentIds: [selected.id], filter: 'active', today }),
    listLoans(schoolId, { studentIds: [selected.id], filter: 'closed', today, limit: 2000 }),
  ])
  const history = closed.filter((l) => l.status !== 'CANCELLED')
  const pendingFines = closed.filter((l) => l.fineStatus === 'PENDING')
  const name = selected.socialName || selected.fullName

  return (
    <>
      <PageTitle
        title={isStudent ? 'Minha biblioteca' : `Biblioteca · ${name}`}
        description={`Prazo de ${rules.loanDays} dias por empréstimo · até ${rules.maxRenewals} renovação(ões) na biblioteca.`}
      />

      {students.length > 1 ? (
        <nav aria-label="Escolher aluno" className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/family/library?student=${s.id}`}
              aria-current={s.id === selected.id ? 'page' : undefined}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {s.socialName || s.fullName}
            </Link>
          ))}
        </nav>
      ) : null}

      <Card>
        <CardHeader title="Livros em poder do aluno" description={`${current.length} livro(s) emprestado(s) no momento.`} />
        {current.length === 0 ? (
          <EmptyState title="Nenhum livro emprestado" description="Quando houver empréstimos, eles aparecem aqui com o prazo de devolução." />
        ) : (
          <ul className="divide-y divide-border">
            {current.map((l) => {
              const t = loanTiming(l.dueOn, today, rules.dueAlertDays)
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{l.title}</span>
                    <span className="text-sm text-muted-foreground">
                      {l.authors} · emprestado em {formatDate(l.loanedOn)} · devolver até {formatDate(l.dueOn)}
                    </span>
                  </div>
                  <span className={cn('rounded-full px-3 py-1 text-sm font-semibold', timingTone(t))}>{timingLabel(t)}</span>
                </li>
              )
            })}
          </ul>
        )}
        {rules.blockOverdue && current.some((l) => l.dueOn < today) ? (
          <p className="border-t border-border px-4 py-3 text-sm text-destructive">
            Há livro(s) em atraso: novos empréstimos ficam bloqueados até a devolução.
          </p>
        ) : null}
      </Card>

      {pendingFines.length ? (
        <Card>
          <CardHeader title="Pendências" description="Procure a biblioteca para regularizar." />
          <ul className="divide-y divide-border">
            {pendingFines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="flex-1 font-medium">{l.title}</span>
                <span className="text-muted-foreground">{l.lateDays} dia(s) de atraso</span>
                <span className="font-semibold text-destructive">{formatMoney(l.fineAmount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Histórico de leituras" description={`Empréstimos encerrados desde ${formatDate(yearFrom)}.`} />
        {history.length === 0 ? (
          <EmptyState title="Sem histórico" description="Ainda não há livros devolvidos neste ano letivo." />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{l.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {l.authors} · {formatDate(l.loanedOn)} a {formatDate(l.returnedOn ?? l.dueOn)}
                  </span>
                </div>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {LOAN_STATUS[l.status as LoanStatus]}
                  {l.lateDays ? ` · ${l.lateDays}d de atraso` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
