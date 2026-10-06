import Link from 'next/link'
import { formatMoney, LOAN_STATUS, loanTiming, timingLabel, timingTone, type LoanStatus } from '@/lib/library'
import type { LoanRow } from '@/lib/library-queries'
import { formatDate } from '@/lib/school-page'
import { cn } from '@/lib/utils'

export function LoanList({
  loans,
  today,
  alertDays,
  showBorrower,
}: {
  loans: LoanRow[]
  today: string
  alertDays: number
  showBorrower?: boolean
}) {
  return (
    <ul className="divide-y divide-border border-t border-border">
      {loans.map((l) => {
        const timing = l.status === 'ACTIVE' ? loanTiming(l.dueOn, today, alertDays) : null
        return (
          <li key={l.id}>
            <Link
              href={`/school/library/loans/${l.id}`}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">{l.title}</span>
                <span className="text-sm text-muted-foreground">
                  {showBorrower ? `${l.borrowerName} (${l.borrowerType === 'STUDENT' ? 'aluno' : 'professor'}) · ` : ''}
                  Tombo {l.copyCode} · {formatDate(l.loanedOn)} → {formatDate(l.returnedOn ?? l.dueOn)}
                  {l.renewals ? ` · ${l.renewals} renovação(ões)` : ''}
                </span>
              </div>
              {l.fineStatus === 'PENDING' ? (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                  Multa {formatMoney(l.fineAmount)}
                </span>
              ) : null}
              {timing ? (
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', timingTone(timing))}>{timingLabel(timing)}</span>
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                  {LOAN_STATUS[l.status as LoanStatus] ?? l.status}
                  {l.status === 'RETURNED' && l.lateDays ? ` · ${l.lateDays}d de atraso` : ''}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
