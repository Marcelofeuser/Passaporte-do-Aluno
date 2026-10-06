import type { Metadata } from 'next'
import Link from 'next/link'
import { updateAttendanceSettings } from '@/app/actions/attendance'
import { ActionForm } from '@/components/school/action-form'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { ALERT_LABEL, alertsFor, allowedAbsences, attendanceRate, formatRate } from '@/lib/attendance'
import {
  getAttendanceSettings,
  getAttendanceTotals,
  getStudentsByIds,
  groupTotals,
} from '@/lib/attendance-queries'
import { gradeScope, listGradebook } from '@/lib/grade-queries'
import { can } from '@/lib/rbac'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Chamada e frequência' }

export default async function AttendancePage() {
  const { ctx, schoolId, role } = await requireSchoolPage('school:manage_attendance')
  const scope = await gradeScope(schoolId, role, ctx.user.id, ctx.user.email)
  const [rows, settings] = await Promise.all([listGradebook(schoolId, scope), getAttendanceSettings(schoolId)])
  const csIds = new Set(rows.map((r) => r.id))

  const totals = rows.length ? (await getAttendanceTotals(schoolId, {})).filter((t) => csIds.has(t.classSubjectId)) : []
  const byStudentCs = groupTotals(totals, (t) => `${t.studentId}:${t.classSubjectId}`)
  const csById = new Map(rows.map((r) => [r.id, r]))

  const alerts = [...byStudentCs.entries()]
    .map(([key, t]) => {
      const [studentId, csId] = key.split(':')
      const cs = csById.get(csId)!
      const list = alertsFor(t, {
        minAttendance: settings.minAttendance,
        lateThreshold: settings.lateThreshold,
        allowed: allowedAbsences(cs.workloadHours, settings.minAttendance),
      })
      return { studentId, cs, t, list }
    })
    .filter((a) => a.list.length > 0)
  const students = new Map((await getStudentsByIds(schoolId, [...new Set(alerts.map((a) => a.studentId))])).map((s) => [s.id, s]))

  const canConfigure = can(role, 'school:manage_settings')

  return (
    <>
      <PageTitle
        title="Chamada e frequência"
        description={
          scope.all
            ? 'Registre a chamada de qualquer disciplina das turmas do ano vigente.'
            : 'Registre a chamada das disciplinas em que você leciona.'
        }
      />

      <Card>
        <CardHeader
          title="Alertas"
          description={`Frequência mínima ${settings.minAttendance}% · atraso recorrente a partir de ${settings.lateThreshold}.`}
        />
        {alerts.length === 0 ? (
          <EmptyState title="Nenhum alerta" description="Nenhum aluno abaixo do mínimo ou com atrasos recorrentes." />
        ) : (
          <ul className="divide-y divide-border">
            {alerts.map((a) => {
              const s = students.get(a.studentId)
              return (
                <li key={`${a.studentId}:${a.cs.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                  <Link href={`/school/students/${a.studentId}`} className="font-semibold hover:underline">
                    {s?.socialName || s?.fullName || 'Aluno'}
                  </Link>
                  <span className="text-sm text-muted-foreground">
                    {a.cs.subjectName} · {a.cs.className} · {formatRate(attendanceRate(a.t))} · {a.t.absent} falta(s) ·{' '}
                    {a.t.late} atraso(s)
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {a.list.map((k) => (
                      <span
                        key={k}
                        className={
                          k === 'BELOW_MIN'
                            ? 'rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive'
                            : 'rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground'
                        }
                      >
                        {ALERT_LABEL[k]}
                      </span>
                    ))}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Disciplinas" description="Abra uma disciplina para fazer a chamada do dia." />
        {!scope.all && !scope.teacherId ? (
          <EmptyState
            title="Cadastro de professor não encontrado"
            description="Peça à secretaria para cadastrar você como professor usando o mesmo e-mail da sua conta."
          />
        ) : rows.length === 0 ? (
          <EmptyState title="Nenhuma disciplina" description="Não há disciplinas em turmas do ano letivo vigente." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/school/attendance/${r.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{r.subjectName}</span>
                    <span className="text-sm text-muted-foreground">
                      {r.className} · {r.grade}
                      {r.teacherName ? ` · ${r.teacherName}` : ' · Sem professor'}
                      {r.workloadHours ? ` · ${r.workloadHours} h/ano` : ''}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-primary">Fazer chamada</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canConfigure ? (
        <Card>
          <CardHeader
            title="Critérios de frequência"
            description="A LDB exige 75% de frequência mínima no ensino fundamental e médio."
          />
          <ActionForm
            action={updateAttendanceSettings}
            submitLabel="Salvar critérios"
            resetOnSuccess={false}
            className="p-4"
            fieldLabels={{ minAttendance: 'Frequência mínima', lateThreshold: 'Atrasos para alerta' }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Frequência mínima (%)" htmlFor="minAttendance">
                <Input
                  id="minAttendance"
                  name="minAttendance"
                  type="number"
                  min={50}
                  max={100}
                  required
                  defaultValue={settings.minAttendance}
                />
              </Field>
              <Field label="Atrasos para alerta" htmlFor="lateThreshold">
                <Input
                  id="lateThreshold"
                  name="lateThreshold"
                  type="number"
                  min={1}
                  max={30}
                  required
                  defaultValue={settings.lateThreshold}
                />
              </Field>
            </div>
          </ActionForm>
        </Card>
      ) : null}
    </>
  )
}
