import type { Metadata } from 'next'
import Link from 'next/link'
import { after } from 'next/server'
import { createLoan, updateLibraryRules } from '@/app/actions/library'
import { ActionForm } from '@/components/school/action-form'
import { BackLink, Checkbox, Textarea } from '@/components/school/form-fields'
import { buttonClasses } from '@/components/ui/button'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { todayISO } from '@/lib/attendance'
import { addDays, formatMoney, isLoanFilter, LOAN_FILTERS, type LoanFilter } from '@/lib/library'
import { dispatchLibraryAlertsSafe } from '@/lib/library-alerts'
import {
  getLibraryRules,
  getLibraryStats,
  listAvailableCopies,
  listBorrowerOptions,
  listLoans,
} from '@/lib/library-queries'
import { can } from '@/lib/rbac'
import { requireSchoolPage } from '@/lib/school-page'
import { LoanList } from './loan-list'

export const metadata: Metadata = { title: 'Biblioteca' }

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; q?: string }>
}) {
  const { schoolId, role } = await requireSchoolPage('school:manage_library')
  const sp = await searchParams
  const filter: LoanFilter = isLoanFilter(sp.filter) ? sp.filter : 'active'
  const q = sp.q?.trim().slice(0, 80) ?? ''
  const today = todayISO()

  // Garante os avisos de vencimento mesmo sem o cron diário configurado.
  after(() => dispatchLibraryAlertsSafe(schoolId))

  const [stats, rules, loans, copies, borrowers] = await Promise.all([
    getLibraryStats(schoolId, today),
    getLibraryRules(schoolId),
    listLoans(schoolId, { filter, q, today }),
    listAvailableCopies(schoolId),
    listBorrowerOptions(schoolId),
  ])
  const canConfigure = can(role, 'school:configure_library')
  const href = (f: LoanFilter) => `/school/library?${new URLSearchParams({ filter: f, ...(q ? { q } : {}) })}`

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title="Biblioteca" description="Empréstimos, devoluções e situação do acervo." />
        <Link href="/school/library/books" className={buttonClasses('outline', 'sm')}>
          Acervo ({stats.titles} títulos)
        </Link>
      </div>

      <Card>
        <dl className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="Exemplares" value={String(stats.copies)} />
          <Stat label="Disponíveis" value={String(stats.available)} />
          <Stat label="Emprestados" value={String(stats.loaned)} />
          <Stat label="Em andamento" value={String(stats.activeLoans)} />
          <Stat label="Em atraso" value={String(stats.overdue)} tone={stats.overdue ? 'text-destructive' : undefined} />
          <Stat label="Multas pendentes" value={formatMoney(stats.pendingFines)} />
        </dl>
      </Card>

      <Card>
        <CardHeader
          title="Novo empréstimo"
          description={`Prazo padrão de ${rules.loanDays} dias · até ${rules.maxLoans} livro(s) por pessoa${
            rules.blockOverdue ? ' · bloqueio com atraso ou multa pendente' : ''
          }.`}
        />
        <ActionForm
          action={createLoan}
          submitLabel="Registrar empréstimo"
          className="p-4"
          fieldLabels={{
            copyCode: 'Exemplar',
            borrower: 'Tomador',
            loanedOn: 'Data do empréstimo',
            dueOn: 'Devolução',
            reason: 'Justificativa',
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Exemplar (código / tombo)" htmlFor="copyCode" hint="Digite ou leia o código de barras do exemplar.">
              <Input id="copyCode" name="copyCode" list="available-copies" required autoComplete="off" maxLength={30} />
            </Field>
            <datalist id="available-copies">
              {copies.map((c) => (
                <option key={c.id} value={c.code}>
                  {c.title}
                </option>
              ))}
            </datalist>
            <Field label="Aluno ou professor" htmlFor="borrower">
              <Select id="borrower" name="borrower" required defaultValue="">
                <option value="" disabled>
                  Selecione…
                </option>
                <optgroup label="Alunos">
                  {borrowers.students.map((s) => (
                    <option key={s.id} value={`STUDENT:${s.id}`}>
                      {s.name}
                      {s.code ? ` (${s.code})` : ''}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Professores">
                  {borrowers.teachers.map((t) => (
                    <option key={t.id} value={`TEACHER:${t.id}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            <Field label="Data do empréstimo" htmlFor="loanedOn" hint="Data diferente de hoje exige justificativa.">
              <Input id="loanedOn" name="loanedOn" type="date" max={today} defaultValue={today} />
            </Field>
            <Field
              label="Devolução até"
              htmlFor="dueOn"
              hint={`Em branco = ${rules.loanDays} dias (${addDays(today, rules.loanDays).split('-').reverse().join('/')}). Outra data exige justificativa.`}
            >
              <Input id="dueOn" name="dueOn" type="date" min={addDays(today, 1)} />
            </Field>
          </div>
          <Field label="Justificativa (intervenção manual)" htmlFor="loan-reason">
            <Input id="loan-reason" name="reason" maxLength={500} />
          </Field>
          <Field label="Observações" htmlFor="loan-notes">
            <Textarea id="loan-notes" name="notes" maxLength={500} className="min-h-16" />
          </Field>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title="Empréstimos" />
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav aria-label="Filtro" className="flex flex-wrap gap-1.5">
            {(Object.keys(LOAN_FILTERS) as LoanFilter[]).map((f) => (
              <Link
                key={f}
                href={href(f)}
                aria-current={f === filter ? 'page' : undefined}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground"
              >
                {LOAN_FILTERS[f]}
              </Link>
            ))}
          </nav>
          <form className="flex gap-2" role="search">
            <input type="hidden" name="filter" value={filter} />
            <Input name="q" defaultValue={q} placeholder="Livro, tombo ou pessoa" aria-label="Buscar empréstimos" className="h-9 w-56" />
            <button type="submit" className={buttonClasses('outline', 'sm')}>
              Buscar
            </button>
          </form>
        </div>
        {loans.length === 0 ? (
          <EmptyState title="Nenhum empréstimo" description="Nenhum empréstimo encontrado com este filtro." />
        ) : (
          <LoanList loans={loans} today={today} alertDays={rules.dueAlertDays} showBorrower />
        )}
      </Card>

      {canConfigure ? (
        <Card>
          <CardHeader
            title="Regras da biblioteca"
            description="Valem para novos empréstimos, renovações e para os avisos automáticos."
          />
          <ActionForm
            action={updateLibraryRules}
            submitLabel="Salvar regras"
            resetOnSuccess={false}
            className="p-4"
            fieldLabels={{
              loanDays: 'Prazo',
              maxRenewals: 'Renovações',
              maxLoans: 'Limite por pessoa',
              finePerDay: 'Multa diária',
              dueAlertDays: 'Aviso prévio',
            }}
          >
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <Field label="Prazo (dias)" htmlFor="loanDays">
                <Input id="loanDays" name="loanDays" type="number" min={1} max={120} required defaultValue={rules.loanDays} />
              </Field>
              <Field label="Renovações" htmlFor="maxRenewals">
                <Input id="maxRenewals" name="maxRenewals" type="number" min={0} max={10} required defaultValue={rules.maxRenewals} />
              </Field>
              <Field label="Livros por pessoa" htmlFor="maxLoans">
                <Input id="maxLoans" name="maxLoans" type="number" min={1} max={20} required defaultValue={rules.maxLoans} />
              </Field>
              <Field label="Multa por dia (R$)" htmlFor="finePerDay" hint="0 = sem multa">
                <Input id="finePerDay" name="finePerDay" inputMode="decimal" required defaultValue={String(rules.finePerDay).replace('.', ',')} />
              </Field>
              <Field label="Aviso prévio (dias)" htmlFor="dueAlertDays">
                <Input id="dueAlertDays" name="dueAlertDays" type="number" min={0} max={14} required defaultValue={rules.dueAlertDays} />
              </Field>
            </div>
            <Checkbox
              id="blockOverdue"
              name="blockOverdue"
              label="Bloquear novos empréstimos de quem tem atraso ou multa pendente"
              defaultChecked={rules.blockOverdue}
            />
          </ActionForm>
        </Card>
      ) : null}
    </>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`text-2xl font-bold tabular-nums ${tone ?? ''}`}>{value}</dd>
    </div>
  )
}
