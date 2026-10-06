import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { saveAttendance } from '@/app/actions/attendance'
import { ActionForm } from '@/components/school/action-form'
import { AttendanceSheet } from '@/components/school/attendance-sheet'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import {
  ALERT_LABEL,
  alertsFor,
  allowedAbsences,
  ATTENDANCE_STATUS,
  attendanceRate,
  formatRate,
  isAttendanceStatus,
  isISODate,
  todayISO,
} from '@/lib/attendance'
import {
  getAttendanceHistory,
  getAttendanceSession,
  getAttendanceSettings,
  getAttendanceTotals,
  getRosterOn,
  getSessionRecords,
  groupTotals,
  listRecentSessions,
} from '@/lib/attendance-queries'
import { getClassSubjectForGrading, gradeScope } from '@/lib/grade-queries'
import { UUID_RE } from '@/lib/school-action'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { getClassRoster } from '@/lib/school-queries'

export const metadata: Metadata = { title: 'Chamada' }

function guessTerm(iso: string) {
  return Math.min(4, Math.ceil(Number(iso.slice(5, 7)) / 3))
}

export default async function AttendanceSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ csId: string }>
  searchParams: Promise<{ date?: string }>
}) {
  const { csId } = await params
  if (!UUID_RE.test(csId)) notFound()
  const { date: rawDate } = await searchParams
  const today = todayISO()
  const date = isISODate(rawDate) && rawDate <= today ? rawDate : today

  const { ctx, schoolId, role } = await requireSchoolPage('school:manage_attendance')
  const scope = await gradeScope(schoolId, role, ctx.user.id, ctx.user.email)
  const cs = await getClassSubjectForGrading(schoolId, csId, scope)
  if (!cs) notFound()

  const [session, roster, recent, settings, totalsRows, currentRoster] = await Promise.all([
    getAttendanceSession(schoolId, csId, date),
    getRosterOn(schoolId, cs.classId, date),
    listRecentSessions(schoolId, csId),
    getAttendanceSettings(schoolId),
    getAttendanceTotals(schoolId, { classSubjectId: csId }),
    getClassRoster(schoolId, cs.classId),
  ])
  const [records, history] = session
    ? await Promise.all([getSessionRecords(schoolId, session.id), getAttendanceHistory(schoolId, session.id)])
    : [[], []]
  const prevByStudent = new Map(records.map((r) => [r.studentId, r.status]))

  const totals = groupTotals(totalsRows, (t) => t.studentId)
  const allowed = allowedAbsences(cs.workloadHours, settings.minAttendance)
  const given = Math.max(0, ...[...totals.values()].map((t) => t.given))

  return (
    <>
      <BackLink href="/school/attendance">Chamada e frequência</BackLink>
      <PageTitle
        title={cs.subjectName}
        description={`${cs.className} · ${cs.grade} · ${cs.year}${cs.teacherName ? ` · ${cs.teacherName}` : ''}${cs.workloadHours ? ` · ${cs.workloadHours} h/ano` : ''}`}
      />

      <Card>
        <CardHeader
          title={session ? `Chamada de ${formatDate(date)}` : `Nova chamada — ${formatDate(date)}`}
          description={
            session
              ? 'Chamada já registrada. Alterações exigem justificativa e ficam no histórico.'
              : 'Todos começam como presentes. Marque faltas, atrasos e saídas antecipadas.'
          }
        />
        <form method="get" className="flex flex-wrap items-end gap-3 border-b border-border px-4 pb-4">
          <Field label="Data da aula" htmlFor="date">
            <Input id="date" name="date" type="date" defaultValue={date} max={today} required />
          </Field>
          <Button type="submit" variant="outline">
            Abrir data
          </Button>
        </form>

        {roster.length === 0 ? (
          <EmptyState title="Sem alunos" description="Nenhum aluno estava matriculado nesta turma na data escolhida." />
        ) : (
          <ActionForm
            key={`${date}:${session?.updatedAt?.toISOString() ?? 'new'}`}
            action={saveAttendance}
            submitLabel={session ? 'Salvar alterações' : 'Registrar chamada'}
            resetOnSuccess={false}
            className="p-4"
            fieldLabels={{
              heldOn: 'Data',
              lessons: 'Aulas',
              term: 'Bimestre',
              sessionReason: 'Justificativa',
              ...Object.fromEntries(roster.map((r) => [`reason_${r.studentId}`, r.socialName || r.fullName])),
            }}
          >
            <input type="hidden" name="classSubjectId" value={csId} />
            <input type="hidden" name="heldOn" value={date} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nº de aulas" htmlFor="lessons">
                <Select id="lessons" name="lessons" defaultValue={String(session?.lessons ?? 1)}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'aula' : 'aulas'}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Bimestre" htmlFor="term">
                <Select id="term" name="term" defaultValue={String(session?.term ?? guessTerm(date))}>
                  {[1, 2, 3, 4].map((t) => (
                    <option key={t} value={t}>
                      {t}º bimestre
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Conteúdo (opcional)" htmlFor="content">
                <Input id="content" name="content" maxLength={500} defaultValue={session?.content ?? ''} />
              </Field>
            </div>
            {session ? (
              <Field label="Justificativa se mudar aulas ou bimestre" htmlFor="sessionReason">
                <Input id="sessionReason" name="sessionReason" maxLength={300} />
              </Field>
            ) : null}
            <AttendanceSheet
              rows={roster.map((r) => {
                const prev = prevByStudent.get(r.studentId)
                return {
                  studentId: r.studentId,
                  name: r.socialName || r.fullName,
                  registrationCode: r.registrationCode,
                  previous: isAttendanceStatus(prev) ? prev : null,
                }
              })}
            />
          </ActionForm>
        )}

        {history.length > 0 ? (
          <div className="border-t border-border p-4">
            <h3 className="mb-2 text-sm font-semibold">Histórico de alterações</h3>
            <ul className="flex flex-col gap-1.5 text-sm">
              {history.map((h) => (
                <li key={h.id} className="text-muted-foreground">
                  <span className="font-medium text-foreground">{h.studentName}</span>:{' '}
                  {ATTENDANCE_STATUS[h.oldStatus as keyof typeof ATTENDANCE_STATUS] ?? h.oldStatus} →{' '}
                  {ATTENDANCE_STATUS[h.newStatus as keyof typeof ATTENDANCE_STATUS] ?? h.newStatus} · “{h.reason}” ·{' '}
                  {h.changedBy ?? 'Usuário'} · {h.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>

      <Card>
        <CardHeader
          title="Frequência na disciplina"
          description={`${given} aula(s) registrada(s)${allowed !== null ? ` · limite de ${allowed} falta(s) no ano` : ''} · mínimo ${settings.minAttendance}%`}
        />
        {currentRoster.length === 0 ? (
          <EmptyState title="Sem alunos" description="Não há alunos com matrícula ativa nesta turma." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2 font-semibold">Aluno</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Faltas</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Atrasos</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Saídas</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Frequência</th>
                  <th scope="col" className="px-4 py-2 font-semibold">Alertas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {currentRoster.map((r) => {
                  const t = totals.get(r.studentId) ?? { given: 0, absent: 0, late: 0, earlyLeave: 0 }
                  const list = alertsFor(t, { ...settings, allowed })
                  return (
                    <tr key={r.enrollmentId}>
                      <th scope="row" className="px-4 py-2 text-left font-medium">
                        {r.socialName ?? r.fullName}
                      </th>
                      <td className="px-4 py-2 text-right tabular-nums">{t.absent}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{t.late}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{t.earlyLeave}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatRate(attendanceRate(t))}</td>
                      <td className="px-4 py-2 text-xs font-semibold">
                        {list.length ? (
                          <span className={list.includes('BELOW_MIN') ? 'text-destructive' : 'text-accent-foreground'}>
                            {list.map((k) => ALERT_LABEL[k]).join(' · ')}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
        <CardHeader title="Chamadas recentes" description="Abra uma data para revisar ou corrigir." />
        {recent.length === 0 ? (
          <EmptyState title="Nenhuma chamada" description="As chamadas registradas aparecem aqui." />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/school/attendance/${csId}?date=${s.heldOn}`}
                  aria-current={s.heldOn === date ? 'page' : undefined}
                  className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none aria-[current=page]:bg-muted"
                >
                  <span className="flex-1 font-semibold">{formatDate(s.heldOn)}</span>
                  <span className="text-muted-foreground">
                    {s.term}º bim. · {s.lessons} {s.lessons === 1 ? 'aula' : 'aulas'} · {s.absents} falta(s) · {s.lates}{' '}
                    atraso(s)
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
