import type { Metadata } from 'next'
import Link from 'next/link'
import { updateOccurrenceSettings } from '@/app/actions/occurrences'
import { ActionForm } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { academicTerm, formatOccurred, OCCURRENCE_SEVERITY, OCCURRENCE_STATUS, todayISO } from '@/lib/occurrences'
import {
  disciplineScope,
  getOccurrenceSettings,
  listCriticalAlerts,
  listOccurrences,
  listOccurrenceTypes,
} from '@/lib/occurrence-queries'
import { can } from '@/lib/rbac'
import { UUID_RE } from '@/lib/school-action'
import { requireSchoolPage } from '@/lib/school-page'
import { getCurrentYear, listClasses } from '@/lib/school-queries'
import { cn } from '@/lib/utils'
import { SeverityBadge } from '@/components/school/severity-badge'

export const metadata: Metadata = { title: 'Ocorrências' }

export default async function OccurrencesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; severity?: string; typeId?: string; student?: string; classId?: string }>
}) {
  const { ctx, schoolId, role } = await requireSchoolPage('school:manage_discipline')
  const scope = await disciplineScope(schoolId, role, ctx.user.id, ctx.user.email)
  const sp = await searchParams
  const filter = {
    status: sp.status && sp.status in OCCURRENCE_STATUS ? sp.status : undefined,
    severity: sp.severity && sp.severity in OCCURRENCE_SEVERITY ? sp.severity : undefined,
    typeId: sp.typeId && UUID_RE.test(sp.typeId) ? sp.typeId : undefined,
    studentId: sp.student && UUID_RE.test(sp.student) ? sp.student : undefined,
    classId: sp.classId && UUID_RE.test(sp.classId) ? sp.classId : undefined,
  }

  const [types, settings, year, rows] = await Promise.all([
    listOccurrenceTypes(schoolId, { activeOnly: false }),
    getOccurrenceSettings(schoolId),
    getCurrentYear(schoolId),
    listOccurrences(schoolId, scope, ctx.user.id, filter),
  ])

  const term = year ? academicTerm(todayISO(), year.startsOn, year.endsOn) : 1
  const alerts =
    scope.all && year ? await listCriticalAlerts(schoolId, settings.threshold, year.id, term) : []
  const classes = year ? await listClasses(schoolId, year.id) : []
  const canTypes = can(role, 'school:manage_all_discipline')
  const canConfigure = can(role, 'school:manage_settings')

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle
          title="Ocorrências"
          description={
            scope.all
              ? 'Registro disciplinar da escola, acompanhamento e avisos à família.'
              : 'Registre ocorrências dos alunos das turmas em que você leciona. Internas de outros professores ficam ocultas.'
          }
        />
        <div className="flex flex-wrap gap-2">
          {canTypes ? (
            <Link
              href="/school/occurrences/types"
              className="inline-flex h-11 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
            >
              Tipos
            </Link>
          ) : null}
          <Link
            href="/school/occurrences/new"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Registrar
          </Link>
        </div>
      </div>

      {scope.all ? (
        <Card>
          <CardHeader
            title={`Alertas no ${term}º bimestre`}
            description={`Coordenação é avisada ao atingir ${settings.threshold} ocorrência(s) disciplinares no bimestre.`}
          />
          {alerts.length === 0 ? (
            <EmptyState title="Nenhum alerta" description="Nenhum aluno atingiu o limite neste bimestre." />
          ) : (
            <ul className="divide-y divide-border">
              {alerts.map((a) => (
                <li key={a.studentId}>
                  <Link
                    href={`/school/occurrences?student=${a.studentId}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted"
                  >
                    <span className="font-semibold">{a.socialName || a.studentName}</span>
                    <span className="text-sm text-muted-foreground">{a.className ?? 'Sem turma'}</span>
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                      {a.n} no bimestre
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Filtros" />
        <form className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Situação" htmlFor="status">
            <Select id="status" name="status" defaultValue={filter.status ?? ''}>
              <option value="">Todas</option>
              {Object.entries(OCCURRENCE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Gravidade" htmlFor="severity">
            <Select id="severity" name="severity" defaultValue={filter.severity ?? ''}>
              <option value="">Todas</option>
              {Object.entries(OCCURRENCE_SEVERITY).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo" htmlFor="typeId">
            <Select id="typeId" name="typeId" defaultValue={filter.typeId ?? ''}>
              <option value="">Todos</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Turma" htmlFor="classId">
            <Select id="classId" name="classId" defaultValue={filter.classId ?? ''}>
              <option value="">Todas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex items-end">
            <button type="submit" className="h-11 w-full rounded-lg bg-secondary px-4 font-semibold text-secondary-foreground">
              Filtrar
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title={`${rows.length} registro(s)`} />
        {rows.length === 0 ? (
          <EmptyState title="Nenhuma ocorrência" description="Ajuste os filtros ou registre o primeiro fato." />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/school/occurrences/${r.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-muted sm:flex-row sm:items-center sm:gap-3">
                  <span className="w-36 shrink-0 text-sm tabular-nums text-muted-foreground">
                    {formatOccurred(r.occurredOn, r.occurredAt)}
                  </span>
                  <span className="min-w-0 flex-1 font-semibold">{r.socialName || r.studentName}</span>
                  <span className="text-sm text-muted-foreground">
                    {r.className ?? '—'} · {r.typeName}
                  </span>
                  <span className="flex flex-wrap gap-1.5">
                    {!r.visibleToFamily ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Interna</span>
                    ) : null}
                    <SeverityBadge severity={r.severity} positive={r.isPositive} />
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        r.status === 'RESOLVED'
                          ? 'bg-secondary text-secondary-foreground'
                          : r.status === 'MONITORING'
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {OCCURRENCE_STATUS[r.status as keyof typeof OCCURRENCE_STATUS] ?? r.status}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canConfigure ? (
        <Card>
          <CardHeader title="Alerta automático" description="Aviso interno para a coordenação quando o aluno acumula ocorrências disciplinares no bimestre." />
          <ActionForm
            action={updateOccurrenceSettings}
            submitLabel="Salvar limite"
            resetOnSuccess={false}
            className="p-4"
            fieldLabels={{ threshold: 'Limite no bimestre' }}
          >
            <Field label="Ocorrências no bimestre para alertar" htmlFor="threshold" hint="Méritos positivos não entram na conta.">
              <Input id="threshold" name="threshold" type="number" min={1} max={20} required defaultValue={settings.threshold} />
            </Field>
          </ActionForm>
        </Card>
      ) : null}
    </>
  )
}