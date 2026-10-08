import type { Metadata } from 'next'
import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { localDate } from '@/lib/calendar'
import { listAgendaEntries } from '@/lib/agenda-queries'
import { getCurrentEnrollments, getFamilyStudents } from '@/lib/attendance-queries'
import { requireSchoolPage } from '@/lib/school-page'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Agenda escolar' }

const VIEWS = { day: 'Dia', week: 'Semana', month: 'Mês' } as const
type View = keyof typeof VIEWS

const KIND_TONE: Record<string, string> = {
  EXAM: 'bg-destructive/10 text-destructive',
  ASSIGNMENT: 'bg-accent text-accent-foreground',
  EVENT: 'bg-secondary text-secondary-foreground',
}

function isView(value: unknown): value is View {
  return value === 'day' || value === 'week' || value === 'month'
}

function endOfDay(d: Date) {
  const end = new Date(d)
  end.setHours(23, 59, 59, 999)
  return end
}

function rangeFor(view: View, ref: Date) {
  const start = new Date(ref)
  start.setHours(0, 0, 0, 0)
  if (view === 'day') return { from: start, to: endOfDay(start) }
  if (view === 'week') {
    const from = new Date(start)
    from.setDate(from.getDate() - from.getDay())
    const to = endOfDay(new Date(from.getTime() + 6 * 86_400_000))
    return { from, to }
  }
  const from = new Date(start.getFullYear(), start.getMonth(), 1)
  const to = endOfDay(new Date(start.getFullYear(), start.getMonth() + 1, 0))
  return { from, to }
}

function shiftRange(view: View, ref: Date, direction: 1 | -1) {
  const next = new Date(ref)
  if (view === 'day') next.setDate(next.getDate() + direction)
  else if (view === 'week') next.setDate(next.getDate() + 7 * direction)
  else next.setMonth(next.getMonth() + direction)
  return next
}

export default async function FamilyAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; view?: string; date?: string }>
}) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const sp = await searchParams
  const isStudent = role === 'STUDENT'
  const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)

  if (students.length === 0) {
    return (
      <>
        <PageTitle title="Agenda escolar" />
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
  const view: View = isView(sp.view) ? sp.view : 'week'
  const ref = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? new Date(`${sp.date}T12:00:00`) : new Date()
  const { from, to } = rangeFor(view, ref)

  // Turmas dos filhos/aluno: inclui provas e trabalhos das turmas relevantes.
  const enrollments = await getCurrentEnrollments(schoolId, students.map((s) => s.id))
  const classIds = [...new Set(enrollments.map((e) => e.classId).filter((v): v is string => Boolean(v)))]

  const entries = await listAgendaEntries(schoolId, role, from, to, classIds)
  const byDay = new Map<string, typeof entries>()
  for (const entry of entries) {
    const key = localDate(entry.startsAt)
    const list = byDay.get(key) ?? []
    list.push(entry)
    byDay.set(key, list)
  }

  const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('pt-BR', { ...opts, timeZone: 'America/Sao_Paulo' })
  const periodLabel =
    view === 'day'
      ? fmt({ dateStyle: 'full' }).format(ref)
      : view === 'week'
        ? `${fmt({ day: '2-digit', month: 'short' }).format(from)} – ${fmt({ day: '2-digit', month: 'short' }).format(to)}`
        : fmt({ month: 'long', year: 'numeric' }).format(ref)

  const qs = (over: { student?: string; view?: View; date?: string }) =>
    `/family/agenda?${new URLSearchParams({
      student: over.student ?? selected.id,
      view: over.view ?? view,
      date: over.date ?? localDate(ref),
    })}`

  return (
    <>
      <PageTitle title="Agenda escolar" description="Eventos, provas e trabalhos da escola e das turmas." />

      {students.length > 1 ? (
        <nav aria-label="Escolher aluno" className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={qs({ student: s.id })}
              aria-current={s.id === selected.id ? 'page' : undefined}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {s.socialName || s.fullName}
            </Link>
          ))}
        </nav>
      ) : null}

      <Card>
        <CardHeader title="Agenda" description={periodLabel} />
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-3">
          <nav aria-label="Navegar período" className="flex items-center gap-1.5">
            <Link href={qs({ date: localDate(shiftRange(view, ref, -1)) })} className={buttonClasses('outline', 'sm')} aria-label="Anterior">
              ←
            </Link>
            <Link href={qs({ date: localDate(new Date()) })} className={buttonClasses('outline', 'sm')}>
              Hoje
            </Link>
            <Link href={qs({ date: localDate(shiftRange(view, ref, 1)) })} className={buttonClasses('outline', 'sm')} aria-label="Próximo">
              →
            </Link>
          </nav>
          <nav aria-label="Visualização" className="flex gap-1.5">
            {(Object.keys(VIEWS) as View[]).map((v) => (
              <Link
                key={v}
                href={qs({ view: v })}
                aria-current={v === view ? 'page' : undefined}
                className="rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground"
              >
                {VIEWS[v]}
              </Link>
            ))}
          </nav>
        </div>

        {entries.length === 0 ? (
          <EmptyState title="Agenda vazia" description="Nenhum evento, prova ou trabalho neste período." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {[...byDay.entries()].map(([day, list]) => (
              <li key={day}>
                <p className="bg-muted/50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {fmt({ weekday: 'long', day: '2-digit', month: 'long' }).format(new Date(`${day}T12:00:00`))}
                </p>
                <ul className="divide-y divide-border">
                  {list.map((entry) => (
                    <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                      <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                        {fmt({ hour: '2-digit', minute: '2-digit' }).format(entry.startsAt)}
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{entry.title}</span>
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-bold',
                              KIND_TONE[entry.source === 'SCHOOL_EVENT' ? entry.kind : 'EVENT'],
                            )}
                          >
                            {entry.kindLabel}
                          </span>
                          {entry.className ? (
                            <span className="text-xs text-muted-foreground">
                              {entry.className}
                              {entry.subjectName ? ` · ${entry.subjectName}` : ''}
                            </span>
                          ) : null}
                        </div>
                        {entry.description ? <p className="mt-0.5 text-sm">{entry.description}</p> : null}
                        {entry.location ? <p className="mt-0.5 text-xs text-muted-foreground">Local: {entry.location}</p> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
