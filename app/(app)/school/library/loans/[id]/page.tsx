import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cancelLoan, markLoanLost, renewLoan, returnLoan, settleFine } from '@/app/actions/library'
import { ActionForm } from '@/components/school/action-form'
import { BackLink, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, PageTitle } from '@/components/ui/card'
import { Field, FormMessage, Input, Select } from '@/components/ui/field'
import { todayISO } from '@/lib/attendance'
import {
  addDays,
  computeFine,
  COPY_CONDITIONS,
  FINE_STATUS,
  formatMoney,
  LOAN_EVENTS,
  LOAN_STATUS,
  loanTiming,
  timingLabel,
  timingTone,
  type CopyCondition,
  type FineStatus,
  type LoanEventKind,
  type LoanStatus,
} from '@/lib/library'
import { getLibraryRules, getLoan, getLoanEvents } from '@/lib/library-queries'
import { UUID_RE } from '@/lib/school-action'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Empréstimo' }

export default async function LoanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ done?: string }>
}) {
  const { schoolId } = await requireSchoolPage('school:manage_library')
  const [{ id }, { done }] = await Promise.all([params, searchParams])
  if (!UUID_RE.test(id)) notFound()
  const [loan, events, rules] = await Promise.all([getLoan(schoolId, id), getLoanEvents(schoolId, id), getLibraryRules(schoolId)])
  if (!loan) notFound()
  const today = todayISO()
  const active = loan.status === 'ACTIVE'
  const timing = active ? loanTiming(loan.dueOn, today, rules.dueAlertDays) : null
  const estimatedFine = timing?.kind === 'OVERDUE' ? computeFine(timing.days, rules.finePerDay) : 0
  const renewTo = addDays(timing?.kind === 'OVERDUE' ? today : loan.dueOn, rules.loanDays)
  const renewalNeedsReason = timing?.kind === 'OVERDUE' || loan.renewals >= rules.maxRenewals
  const doneMessage = confirmation(done, loan)

  return (
    <>
      <BackLink href="/school/library">Biblioteca</BackLink>
      <PageTitle
        title={loan.title}
        description={`${loan.borrowerName} (${loan.borrowerType === 'STUDENT' ? 'aluno' : 'professor'}) · tombo ${loan.copyCode}`}
      />
      {doneMessage ? <FormMessage tone="success">{doneMessage}</FormMessage> : null}

      <Card>
        <dl className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
          <Item label="Situação">
            {timing ? (
              <span className={cn('rounded-full px-2 py-0.5 text-sm font-semibold', timingTone(timing))}>{timingLabel(timing)}</span>
            ) : (
              LOAN_STATUS[loan.status as LoanStatus]
            )}
          </Item>
          <Item label="Emprestado em">{formatDate(loan.loanedOn)}</Item>
          <Item label="Devolução até">{formatDate(loan.dueOn)}</Item>
          <Item label={loan.returnedOn ? 'Devolvido em' : 'Renovações'}>
            {loan.returnedOn ? formatDate(loan.returnedOn) : `${loan.renewals} de ${rules.maxRenewals}`}
          </Item>
          {loan.status === 'RETURNED' ? (
            <>
              <Item label="Atraso">{loan.lateDays ? `${loan.lateDays} dia(s)` : 'No prazo'}</Item>
              <Item label="Conservação na devolução">
                {loan.returnCondition ? COPY_CONDITIONS[loan.returnCondition as CopyCondition] : '—'}
              </Item>
            </>
          ) : null}
          {loan.fineStatus !== 'NONE' ? (
            <Item label="Multa">
              {formatMoney(loan.fineAmount)} · {FINE_STATUS[loan.fineStatus as FineStatus]}
            </Item>
          ) : null}
          {estimatedFine > 0 ? <Item label="Multa estimada hoje">{formatMoney(estimatedFine)}</Item> : null}
        </dl>
        {loan.notes ? <p className="border-t border-border px-4 py-3 text-sm whitespace-pre-line text-muted-foreground">{loan.notes}</p> : null}
        <p className="border-t border-border px-4 py-3 text-sm">
          <Link href={`/school/library/books/${loan.bookId}`} className="font-semibold text-primary hover:underline">
            Ver título no acervo
          </Link>
          {loan.studentId ? (
            <>
              {' · '}
              <Link href={`/school/students/${loan.studentId}`} className="font-semibold text-primary hover:underline">
                Ver cadastro do aluno
              </Link>
            </>
          ) : null}
        </p>
      </Card>

      {active ? (
        <>
          <Card>
            <CardHeader
              title="Registrar devolução"
              description={
                timing?.kind === 'OVERDUE'
                  ? `Em atraso: ${timingLabel(timing)}${estimatedFine ? ` · multa de ${formatMoney(estimatedFine)}` : ''}.`
                  : 'Devolução dentro do prazo.'
              }
            />
            <ActionForm
              action={returnLoan}
              submitLabel="Registrar devolução"
              resetOnSuccess={false}
              className="p-4"
              fieldLabels={{ returnedOn: 'Data', condition: 'Conservação', reason: 'Justificativa' }}
            >
              <input type="hidden" name="loanId" value={loan.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data da devolução" htmlFor="returnedOn" hint="Data diferente de hoje exige justificativa.">
                  <Input id="returnedOn" name="returnedOn" type="date" min={loan.loanedOn} max={today} defaultValue={today} />
                </Field>
                <Field label="Estado de conservação" htmlFor="return-condition" hint="Danificado envia o exemplar para manutenção.">
                  <Select id="return-condition" name="condition" defaultValue="GOOD">
                    {Object.entries(COPY_CONDITIONS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field label="Observações" htmlFor="return-notes">
                <Input id="return-notes" name="notes" maxLength={500} />
              </Field>
              <Field label="Justificativa (intervenção manual)" htmlFor="return-reason">
                <Input id="return-reason" name="reason" maxLength={500} />
              </Field>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader
              title="Renovar prazo"
              description={`Renovação padrão: +${rules.loanDays} dias (até ${formatDate(renewTo)}).${
                renewalNeedsReason ? ' Este caso exige justificativa (atraso ou limite de renovações atingido).' : ''
              }`}
            />
            <ActionForm
              action={renewLoan}
              submitLabel="Renovar"
              className="p-4"
              fieldLabels={{ dueOn: 'Nova data', reason: 'Justificativa' }}
            >
              <input type="hidden" name="loanId" value={loan.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nova data (opcional)" htmlFor="renew-dueOn" hint="Data diferente da regra exige justificativa.">
                  <Input id="renew-dueOn" name="dueOn" type="date" min={addDays(today, 1)} />
                </Field>
                <Field label="Justificativa" htmlFor="renew-reason">
                  <Input id="renew-reason" name="reason" maxLength={500} required={renewalNeedsReason} />
                </Field>
              </div>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Intervenções excepcionais" description="Anulação devolve o exemplar ao acervo; extravio marca o exemplar como extraviado." />
            <div className="grid gap-4 p-4 sm:grid-cols-2">
              <ActionForm action={cancelLoan} submitLabel="Anular empréstimo" fieldLabels={{ reason: 'Justificativa' }}>
                <input type="hidden" name="loanId" value={loan.id} />
                <Field label="Justificativa da anulação" htmlFor="cancel-reason" hint="Ex.: registro feito por engano.">
                  <Textarea id="cancel-reason" name="reason" required minLength={5} maxLength={500} className="min-h-16" />
                </Field>
              </ActionForm>
              <ActionForm action={markLoanLost} submitLabel="Registrar extravio" fieldLabels={{ reason: 'Justificativa' }}>
                <input type="hidden" name="loanId" value={loan.id} />
                <Field label="Justificativa do extravio" htmlFor="lost-reason">
                  <Textarea id="lost-reason" name="reason" required minLength={5} maxLength={500} className="min-h-16" />
                </Field>
              </ActionForm>
            </div>
          </Card>
        </>
      ) : null}

      {loan.fineStatus === 'PENDING' ? (
        <Card>
          <CardHeader title="Baixa da multa" description={`Valor pendente: ${formatMoney(loan.fineAmount)}.`} />
          <ActionForm action={settleFine} submitLabel="Registrar baixa" className="p-4" fieldLabels={{ outcome: 'Baixa', reason: 'Justificativa' }}>
            <input type="hidden" name="loanId" value={loan.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo de baixa" htmlFor="fine-outcome">
                <Select id="fine-outcome" name="outcome" defaultValue="PAID">
                  <option value="PAID">Quitada</option>
                  <option value="WAIVED">Dispensada</option>
                </Select>
              </Field>
              <Field label="Justificativa (obrigatória para dispensa)" htmlFor="fine-reason">
                <Input id="fine-reason" name="reason" maxLength={500} />
              </Field>
            </div>
          </ActionForm>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Histórico e auditoria" description="Todas as movimentações deste empréstimo." />
        <ol className="divide-y divide-border">
          {events.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold">{LOAN_EVENTS[e.kind as LoanEventKind] ?? e.kind}</span>
                <span className="text-muted-foreground">
                  {e.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                  {e.actorName ? ` · ${e.actorName}` : ''}
                </span>
              </div>
              {e.oldDueOn && e.newDueOn ? (
                <span>
                  Prazo: {formatDate(e.oldDueOn)} → {formatDate(e.newDueOn)}
                </span>
              ) : e.newDueOn ? (
                <span>Devolução até {formatDate(e.newDueOn)}</span>
              ) : null}
              {eventDetail(e.kind, e.metadata)}
              {e.reason ? <span className="text-muted-foreground">Justificativa: {e.reason}</span> : null}
            </li>
          ))}
        </ol>
      </Card>
    </>
  )
}

function confirmation(
  done: string | undefined,
  loan: { status: string; lateDays: number; fineAmount: number; fineStatus: string },
) {
  if (done === 'returned' && loan.status === 'RETURNED') {
    if (!loan.lateDays) return 'Devolução registrada no prazo.'
    return `Devolução registrada com ${loan.lateDays} dia(s) de atraso${loan.fineAmount ? ` · multa de ${formatMoney(loan.fineAmount)}` : ''}.`
  }
  if (done === 'cancelled' && loan.status === 'CANCELLED') return 'Empréstimo anulado. O exemplar voltou ao acervo.'
  if (done === 'lost' && loan.status === 'LOST') return 'Extravio registrado. O exemplar foi marcado como extraviado.'
  if (done === 'fine' && (loan.fineStatus === 'PAID' || loan.fineStatus === 'WAIVED')) {
    return loan.fineStatus === 'PAID' ? 'Multa quitada.' : 'Multa dispensada.'
  }
  return null
}

function eventDetail(kind: string, m: Record<string, unknown>) {
  if (kind === 'RETURNED') {
    const late = Number(m.lateDays ?? 0)
    const fine = Number(m.fine ?? 0)
    return (
      <span>
        Devolvido em {formatDate(String(m.returnedOn ?? ''))} · {late ? `${late} dia(s) de atraso` : 'no prazo'}
        {fine ? ` · multa ${formatMoney(fine)}` : ''}
      </span>
    )
  }
  if (kind === 'FINE_PAID' || kind === 'FINE_WAIVED') return <span>Valor: {formatMoney(Number(m.amount ?? 0))}</span>
  return null
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  )
}
