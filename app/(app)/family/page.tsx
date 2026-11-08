import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, BookOpen, CalendarDays, ClipboardList, GraduationCap } from 'lucide-react'
import { buttonClasses } from '@/components/ui/button'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { calendarDateTime } from '@/lib/calendar'
import { listCalendarEvents } from '@/lib/calendar-queries'
import { attendanceRate, formatRate, sumTotals, todayISO } from '@/lib/attendance'
import {
  getAttendanceSettings,
  getAttendanceTotals,
  getClassSubjects,
  getCurrentEnrollments,
  getFamilyStudents,
} from '@/lib/attendance-queries'
import { getPassingGrade, getStudentReport } from '@/lib/grade-queries'
import { computeResult, formatScore, GRADE_STATUS_LABEL } from '@/lib/grades'
import { getLibraryRules, listLoans } from '@/lib/library-queries'
import { listStudentOccurrences, occurrenceSummary } from '@/lib/occurrence-queries'
import { formatOccurred, OCCURRENCE_SEVERITY } from '@/lib/occurrences'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Painel da família' }

const STATUS_TONE: Record<string, string> = {
  APPROVED: 'text-primary',
  RECOVERY: 'text-accent-foreground',
  FAILED: 'text-destructive',
  PENDING: 'text-muted-foreground',
}

export default async function FamilyDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>
}) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const sp = await searchParams
  const isStudent = role === 'STUDENT'
  const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)

  if (students.length === 0) {
    return (
      <>
        <PageTitle title={isStudent ? 'Meu painel' : 'Painel da família'} />
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
  const today = todayISO()

  const [[enr], settings, passingGrade] = await Promise.all([
    getCurrentEnrollments(schoolId, [selected.id]),
    getAttendanceSettings(schoolId),
    getPassingGrade(schoolId),
  ])

  const classId = enr?.classId
  const eventsFrom = new Date()
  const eventsTo = new Date(Date.now() + 30 * 86_400_000)

  const [subjects, yearTotals, events, report, yearDisc, loans] = classId
    ? await Promise.all([
        getClassSubjects(schoolId, [classId]),
        getAttendanceTotals(schoolId, { studentIds: [selected.id], classId, from: enr?.startsOn ?? today, to: enr?.endsOn ?? today }),
        listCalendarEvents(schoolId, role, eventsFrom, eventsTo),
        getStudentReport(schoolId, selected.id, classId),
        occurrenceSummary(schoolId, selected.id, enr?.startsOn ?? today, enr?.endsOn ?? today, true),
        listLoans(schoolId, { filter: 'active', studentIds: [selected.id], today, limit: 5 }),
      ])
    : [[], [], [], [], { total: 0, mild: 0, moderate: 0, severe: 0 }, []]

  const overall = sumTotals(yearTotals)
  const name = selected.socialName || selected.fullName
  const detailHref = `/family/acompanhamento${sp.student ? `?student=${selected.id}` : ''}`
  const nextEvents = events.slice(0, 3)
  const recentOccurrences = classId
    ? await listStudentOccurrences(schoolId, selected.id, { visibleOnly: true, limit: 5 })
    : []
  const libraryRules = await getLibraryRules(schoolId)

  return (
    <>
      <PageTitle
        title={isStudent ? 'Meu painel' : 'Painel da família'}
        description={
          enr
            ? `${name} · ${enr.className} · ${enr.grade}`
            : `${name} · sem matrícula ativa no ano letivo vigente.`
        }
      />

      {students.length > 1 ? (
        <nav aria-label="Escolher aluno" className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/family?student=${s.id}`}
              aria-current={s.id === selected.id ? 'page' : undefined}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {s.socialName || s.fullName}
            </Link>
          ))}
        </nav>
      ) : null}

      {/* Frequência rápida */}
      <Card>
        <CardHeader
          title="Frequência"
          description={`Mínimo exigido: ${settings.minAttendance}% em cada disciplina.`}
          action={
            <Link href={detailHref} className={buttonClasses('outline', 'sm')}>
              Ver detalhes <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        />
        <dl className="grid grid-cols-2 gap-4 px-4 pb-4 sm:grid-cols-4">
          <Stat label="Frequência no ano" value={formatRate(attendanceRate(overall))} strong />
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
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Frequência</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Situação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {subjects.map((s) => {
                  const t = yearTotals.find((x) => x.classSubjectId === s.id) ?? { given: 0, absent: 0, late: 0, earlyLeave: 0 }
                  return (
                    <tr key={s.id}>
                      <th scope="row" className="px-4 py-2 text-left font-medium">{s.subjectName}</th>
                      <td className="px-4 py-2 text-right tabular-nums">{t.absent}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatRate(attendanceRate(t))}</td>
                      <td className="px-4 py-2 text-xs font-semibold">
                        <span className={cn(t.absent > 0 ? 'text-accent-foreground' : 'text-primary')}>
                          {t.absent > 0 ? 'Atenção' : 'Regular'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Notas + boletim resumido */}
      <Card>
        <CardHeader
          title="Notas"
          description={`Média para aprovação: ${formatScore(passingGrade)}`}
          action={
            <Link href={detailHref} className={buttonClasses('outline', 'sm')}>
              Ver boletim <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        />
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

      {/* Agenda */}
      <Card>
        <CardHeader
          title="Agenda"
          description="Próximos eventos e comunicados para a família."
          action={
            <Link href="/family/agenda" className={buttonClasses('outline', 'sm')}>
              Agenda completa <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        />
        {nextEvents.length === 0 ? (
          <EmptyState title="Agenda vazia" description="Não há eventos publicados para os próximos dias." />
        ) : (
          <ul className="divide-y divide-border">
            {nextEvents.map((event) => (
              <li key={event.id} className="px-4 py-3">
                <strong>{event.title}</strong>
                <p className="text-sm text-muted-foreground">
                  {event.typeName} · {calendarDateTime(event.startsAt)}
                  {event.location ? ` · ${event.location}` : ''}
                </p>
                {event.description ? <p className="mt-1 text-sm">{event.description}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Atividades: ocorrências visíveis à família */}
      <Card>
        <CardHeader
          title="Atividades e ocorrências"
          description={`Registro do ano letivo${yearDisc.total ? ` · ${yearDisc.total} ocorrência(s)` : ''}`}
        />
        {recentOccurrences.length === 0 ? (
          <EmptyState title="Nenhuma ocorrência" description="Sem registros disciplinares visíveis à família." />
        ) : (
          <ul className="divide-y divide-border">
            {recentOccurrences.map((o) => (
              <li key={o.id} className="flex items-start gap-3 px-4 py-3">
                <span
                  className={cn(
                    'mt-0.5 size-2 shrink-0 rounded-full',
                    o.isPositive ? 'bg-primary' : o.severity === 'SEVERE' ? 'bg-destructive' : 'bg-accent',
                  )}
                  aria-hidden="true"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{o.typeName}</span>
                  <span className="text-sm text-muted-foreground">
                    {formatOccurred(o.occurredOn, o.occurredAt)} ·{' '}
                    {OCCURRENCE_SEVERITY[o.severity as keyof typeof OCCURRENCE_SEVERITY]}
                  </span>
                  {o.description ? <p className="mt-1 text-sm">{o.description}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Biblioteca */}
      <Card>
        <CardHeader
          title="Biblioteca"
          description={libraryRules.maxLoans ? `Limite de ${libraryRules.maxLoans} empréstimo(s) por aluno.` : undefined}
          action={
            <Link href="/family/library" className={buttonClasses('outline', 'sm')}>
              Ver biblioteca <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        />
        {loans.length === 0 ? (
          <EmptyState
            title="Nenhum empréstimo ativo"
            description="Quando houver livros emprestados, aparecem aqui com a data de devolução."
          />
        ) : (
          <ul className="divide-y divide-border">
            {loans.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                <BookOpen className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold">{l.title}</span>
                  <span className="text-sm text-muted-foreground">Devolução: {formatDate(l.dueOn)}</span>
                  {l.dueOn < today ? <span className="text-sm font-semibold text-destructive">Em atraso</span> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Atalhos rápidos */}
      <Card>
        <CardHeader title="Atalhos" />
        <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
          <ShortcutLink href="/family/agenda" label="Agenda" icon={CalendarDays} />
          <ShortcutLink href="/family/appointments" label="Atendimentos" icon={ClipboardList} />
          <ShortcutLink href="/family/library" label="Biblioteca" icon={BookOpen} />
          <ShortcutLink href="/notifications" label="Avisos" icon={GraduationCap} />
        </div>
      </Card>
    </>
  )
}

function ShortcutLink({ href, label, icon: Icon }: { href: string; label: string; icon: typeof CalendarDays }) {
  return (
    <Link
      href={href}
      className="flex min-h-20 flex-col justify-between gap-2 rounded-xl border border-border bg-card p-3 text-sm font-semibold hover:bg-muted"
    >
      <Icon className="size-5 text-muted-foreground" aria-hidden="true" />
      {label}
    </Link>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn('text-2xl font-bold tabular-nums', strong && 'text-primary')}>{value}</dd>
    </div>
  )
}
