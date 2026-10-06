import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import {
  ALERT_LABEL,
  alertsFor,
  allowedAbsences,
  ATTENDANCE_STATUS,
  attendanceRate,
  formatRate,
  isPeriod,
  PERIODS,
  periodRange,
  sumTotals,
  todayISO,
  type Period,
} from '@/lib/attendance'
import {
  getAttendanceEntries,
  getAttendanceSettings,
  getAttendanceTotals,
  getClassSubjects,
  getCurrentEnrollments,
  getFamilyStudents,
  groupTotals,
} from '@/lib/attendance-queries'
import { getPassingGrade, getStudentReport } from '@/lib/grade-queries'
import { computeResult, formatScore, GRADE_STATUS_LABEL } from '@/lib/grades'
import { formatOccurred, OCCURRENCE_SEVERITY, OCCURRENCE_STATUS } from '@/lib/occurrences'
import { listStudentOccurrences, occurrenceSummary } from '@/lib/occurrence-queries'
import { cn } from '@/lib/utils'
import { formatDate, requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Acompanhamento escolar' }

const STATUS_TONE: Record<string, string> = {
  APPROVED: 'text-primary',
  RECOVERY: 'text-accent-foreground',
  FAILED: 'text-destructive',
  PENDING: 'text-muted-foreground',
}

export default async function FamilyPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; period?: string }>
}) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const sp = await searchParams
  const isStudent = role === 'STUDENT'
  const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)

  if (students.length === 0) {
    return (
      <>
        <PageTitle title={isStudent ? 'Meu boletim' : 'Meus filhos'} />
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

  // O aluno escolhido só vale se estiver na lista autorizada; senão usa o primeiro.
  const selected = students.find((s) => s.id === sp.student) ?? students[0]
  const period: Period = isPeriod(sp.period) ? sp.period : 'month'
  const today = todayISO()

  const [[enr], settings, passingGrade] = await Promise.all([
    getCurrentEnrollments(schoolId, [selected.id]),
    getAttendanceSettings(schoolId),
    getPassingGrade(schoolId),
  ])

  const yearFrom = enr?.startsOn ?? `${today.slice(0, 4)}-01-01`
  const yearTo = enr?.endsOn ?? today
  const range = periodRange(period, today)
  if (period === 'year') range.from = yearFrom

  const classId = enr?.classId
  const monthFrom = `${today.slice(0, 7)}-01`
  const [subjects, yearTotals, entries, report, yearDisc, monthDisc, discipline] = classId
    ? await Promise.all([
        getClassSubjects(schoolId, [classId]),
        getAttendanceTotals(schoolId, { studentIds: [selected.id], classId, from: yearFrom, to: yearTo }),
        getAttendanceEntries(schoolId, [selected.id], range.from, range.to),
        getStudentReport(schoolId, selected.id, classId),
        occurrenceSummary(schoolId, selected.id, yearFrom, yearTo, true),
        occurrenceSummary(schoolId, selected.id, monthFrom, today, true),
        listStudentOccurrences(schoolId, selected.id, { visibleOnly: true, limit: 20 }),
      ])
    : [[], [], [], [], { total: 0, mild: 0, moderate: 0, severe: 0 }, { total: 0, mild: 0, moderate: 0, severe: 0 }, []]

  const bySubject = groupTotals(yearTotals, (t) => t.classSubjectId)
  const overall = sumTotals([...bySubject.values()])
  const periodTotals = getPeriodSummary(entries)
  const occurrences = entries.filter((e) => e.status !== 'PRESENT')
  const name = selected.socialName || selected.fullName
  const href = (q: { student?: string; period?: string }) =>
    `/family?${new URLSearchParams({ student: q.student ?? selected.id, period: q.period ?? period })}`

  return (
    <>
      <PageTitle
        title={isStudent ? 'Meu boletim' : name}
        description={enr ? `${enr.className} · ${enr.grade}` : 'Sem matrícula ativa no ano letivo vigente.'}
      />

      {students.length > 1 ? (
        <nav aria-label="Escolher aluno" className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={href({ student: s.id })}
              aria-current={s.id === selected.id ? 'page' : undefined}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {s.socialName || s.fullName}
            </Link>
          ))}
        </nav>
      ) : null}

      <Card>
        <CardHeader
          title="Frequência no ano"
          description={`Mínimo exigido: ${settings.minAttendance}% em cada disciplina.`}
        />
        <dl className="grid grid-cols-2 gap-4 px-4 pb-4 sm:grid-cols-4">
          <Stat label="Frequência geral" value={formatRate(attendanceRate(overall))} strong />
          <Stat label="Faltas (aulas)" value={String(overall.absent)} />
          <Stat label="Atrasos" value={String(overall.late)} />
          <Stat label="Saídas antecipadas" value={String(overall.earlyLeave)} />
        </dl>
        {subjects.length === 0 ? (
          <EmptyState title="Sem disciplinas" description="A turma ainda não tem disciplinas cadastradas." />
        ) : (
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Disciplina</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Faltas</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Limite</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Frequência</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subjects.map((s) => {
                  const t = bySubject.get(s.id) ?? { given: 0, absent: 0, late: 0, earlyLeave: 0 }
                  const allowed = allowedAbsences(s.workloadHours, settings.minAttendance)
                  const list = alertsFor(t, { ...settings, allowed })
                  return (
                    <tr key={s.id}>
                      <th scope="row" className="px-4 py-2 text-left font-medium">{s.subjectName}</th>
                      <td className="px-4 py-2 text-right tabular-nums">{t.absent}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">{allowed ?? '—'}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatRate(attendanceRate(t))}</td>
                      <td className="px-4 py-2 text-xs font-semibold">
                        {list.length ? (
                          <span className={list.includes('BELOW_MIN') ? 'text-destructive' : 'text-accent-foreground'}>
                            {list.map((k) => ALERT_LABEL[k]).join(' · ')}
                          </span>
                        ) : (
                          <span className="text-primary">Regular</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Faltas e atrasos" description={`${formatDate(range.from)} a ${formatDate(range.to)}`} />
        <nav aria-label="Período" className="flex flex-wrap gap-1.5 px-4 pb-3">
          {(Object.keys(PERIODS) as Period[]).map((p) => (
            <Link
              key={p}
              href={href({ period: p })}
              aria-current={p === period ? 'page' : undefined}
              className="rounded-md px-3 py-1.5 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted aria-[current=page]:bg-secondary aria-[current=page]:text-secondary-foreground"
            >
              {PERIODS[p]}
            </Link>
          ))}
        </nav>
        <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
          {periodTotals.days} dia(s) com aula · {periodTotals.absent} falta(s) · {periodTotals.late} atraso(s) ·{' '}
          {periodTotals.earlyLeave} saída(s) antecipada(s)
        </p>
        {occurrences.length === 0 ? (
          <EmptyState title="Nenhuma falta ou atraso" description="Sem faltas, atrasos ou saídas antecipadas no período." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {occurrences.map((e) => (
              <li key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">{formatDate(e.heldOn)}</span>
                <span className="flex-1 font-medium">{e.subjectName}</span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-xs font-semibold',
                    e.status === 'ABSENT' ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground',
                  )}
                >
                  {ATTENDANCE_STATUS[e.status as keyof typeof ATTENDANCE_STATUS]}
                  {e.status === 'ABSENT' && e.lessons > 1 ? ` (${e.lessons} aulas)` : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Notas" description={`Média para aprovação: ${formatScore(passingGrade)}`} />
        {report.length === 0 ? (
          <EmptyState title="Sem notas" description="Ainda não há disciplinas com avaliações." />
        ) : (
          <ul className="divide-y divide-border">
            {report.map((s) => {
              const r = computeResult(s.items, passingGrade)
              return (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{s.subjectName}</span>
                    <span className="text-sm text-muted-foreground">
                      {s.items.filter((i) => i.score !== null).length} de {s.items.length} avaliação(ões) com nota
                    </span>
                  </div>
                  <span className="text-lg font-bold tabular-nums">{formatScore(r.final)}</span>
                  <span className={cn('w-24 text-right text-sm font-semibold', STATUS_TONE[r.status])}>
                    {GRADE_STATUS_LABEL[r.status]}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </>
  )
}

function getPeriodSummary(entries: { heldOn: string; status: string; lessons: number }[]) {
  return {
    days: new Set(entries.map((e) => e.heldOn)).size,
    absent: entries.filter((e) => e.status === 'ABSENT').reduce((n, e) => n + e.lessons, 0),
    late: entries.filter((e) => e.status === 'LATE').length,
    earlyLeave: entries.filter((e) => e.status === 'EARLY_LEAVE').length,
  }
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn('text-2xl font-bold tabular-nums', strong && 'text-primary')}>{value}</dd>
    </div>
  )
}
