import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteOccurrence, followUpOccurrence, updateOccurrence } from '@/app/actions/occurrences'
import { ActionForm } from '@/components/school/action-form'
import { BackLink, Checkbox, Textarea } from '@/components/school/form-fields'
import { SeverityBadge } from '@/components/school/severity-badge'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import {
  formatOccurred,
  OCCURRENCE_MEASURES,
  OCCURRENCE_SEVERITY,
  OCCURRENCE_STATUS,
  timeFromDate,
} from '@/lib/occurrences'
import {
  canSeeOccurrence,
  disciplineScope,
  getOccurrence,
  getOccurrenceHistory,
  listOccurrenceTypes,
} from '@/lib/occurrence-queries'
import { can } from '@/lib/rbac'
import { UUID_RE } from '@/lib/school-action'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Ocorrência' }

const CHANGE_LABEL: Record<string, string> = {
  UPDATE: 'Alteração do registro',
  STATUS: 'Acompanhamento',
  DELETE: 'Exclusão',
}

export default async function OccurrenceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const { ctx, schoolId, role } = await requireSchoolPage('school:manage_discipline')
  const scope = await disciplineScope(schoolId, role, ctx.user.id, ctx.user.email)
  const row = await getOccurrence(schoolId, id)
  if (!row || !canSeeOccurrence(row, scope, ctx.user.id)) notFound()

  const [types, history] = await Promise.all([
    listOccurrenceTypes(schoolId),
    getOccurrenceHistory(schoolId, id),
  ])
  const canMutate = can(role, 'school:manage_all_discipline') || row.recordedByUserId === ctx.user.id
  const name = row.socialName || row.studentName

  return (
    <>
      <BackLink href="/school/occurrences">Ocorrências</BackLink>
      <PageTitle title={name} description={`${row.typeName} · ${formatOccurred(row.occurredOn, row.occurredAt)}`} />

      <Card>
        <CardHeader
          title="Registro"
          action={
            <span className="flex flex-wrap gap-1.5">
              {!row.visibleToFamily ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">Interna</span>
              ) : (
                <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                  Visível à família
                </span>
              )}
              <SeverityBadge severity={row.severity} positive={row.isPositive} />
            </span>
          }
        />
        <dl className="grid gap-3 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Aluno</dt>
            <dd className="font-semibold">
              {can(role, 'school:view_students') ? (
                <Link href={`/school/students/${row.studentId}`} className="text-primary hover:underline">
                  {name}
                </Link>
              ) : (
                name
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Turma</dt>
            <dd className="font-semibold">{row.className ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Registrado por</dt>
            <dd className="font-semibold">{row.recordedBy ?? '—'}{row.teacherName ? ` (${row.teacherName})` : ''}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Situação</dt>
            <dd className="font-semibold">{OCCURRENCE_STATUS[row.status as keyof typeof OCCURRENCE_STATUS]}</dd>
          </div>
        </dl>
        <p className="border-t border-border px-4 py-4 text-sm leading-relaxed whitespace-pre-wrap">{row.description}</p>
        {row.measures.length || row.measuresNote ? (
          <ul className="border-t border-border px-4 py-3 text-sm">
            {row.measures.map((m) => (
              <li key={m}>• {OCCURRENCE_MEASURES[m as keyof typeof OCCURRENCE_MEASURES] ?? m}</li>
            ))}
            {row.measuresNote ? <li className="text-muted-foreground">{row.measuresNote}</li> : null}
          </ul>
        ) : null}
      </Card>

      {canMutate ? (
        <>
          <Card>
            <CardHeader title="Acompanhamento" description="Toda mudança de status ou encaminhamento exige justificativa." />
            <ActionForm
              action={followUpOccurrence}
              submitLabel="Registrar acompanhamento"
              resetOnSuccess={false}
              className="p-4"
              fieldLabels={{ status: 'Situação', reason: 'Justificativa' }}
            >
              <input type="hidden" name="occurrenceId" value={id} />
              <Field label="Situação" htmlFor="status">
                <Select id="status" name="status" required defaultValue={row.status}>
                  {Object.entries(OCCURRENCE_STATUS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <fieldset className="flex flex-col gap-2">
                <legend className="text-sm font-semibold">Encaminhamentos</legend>
                {Object.entries(OCCURRENCE_MEASURES).map(([k, v]) => (
                  <Checkbox key={k} id={`fm-${k}`} name="measures" value={k} label={v} defaultChecked={row.measures.includes(k)} />
                ))}
              </fieldset>
              <Field label="Detalhe das medidas" htmlFor="measuresNote">
                <Input id="measuresNote" name="measuresNote" maxLength={500} defaultValue={row.measuresNote ?? ''} />
              </Field>
              <Field label="Justificativa da alteração" htmlFor="follow-reason">
                <Textarea id="follow-reason" name="reason" required minLength={5} maxLength={500} />
              </Field>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Corrigir registro" description="Alterar data, tipo, gravidade ou texto também exige justificativa." />
            <ActionForm
              action={updateOccurrence}
              submitLabel="Salvar correção"
              resetOnSuccess={false}
              className="p-4"
              fieldLabels={{
                typeId: 'Tipo',
                occurredOn: 'Data',
                occurredTime: 'Horário',
                severity: 'Gravidade',
                description: 'Descrição',
                reason: 'Justificativa',
              }}
            >
              <input type="hidden" name="occurrenceId" value={id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tipo" htmlFor="typeId">
                  <Select id="typeId" name="typeId" required defaultValue={row.typeId}>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Gravidade" htmlFor="severity">
                  <Select id="severity" name="severity" required defaultValue={row.severity}>
                    {Object.entries(OCCURRENCE_SEVERITY).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Data" htmlFor="occurredOn">
                  <Input id="occurredOn" name="occurredOn" type="date" required defaultValue={row.occurredOn} />
                </Field>
                <Field label="Horário" htmlFor="occurredTime">
                  <Input
                    id="occurredTime"
                    name="occurredTime"
                    type="time"
                    required
                    defaultValue={timeFromDate(row.occurredAt)}
                  />
                </Field>
              </div>
              <Field label="Descrição" htmlFor="description">
                <Textarea id="description" name="description" required minLength={10} maxLength={4000} defaultValue={row.description} />
              </Field>
              <Checkbox
                id="visibleToFamily"
                name="visibleToFamily"
                label="Visível para os responsáveis"
                defaultChecked={row.visibleToFamily}
              />
              <Field label="Justificativa da correção" htmlFor="edit-reason">
                <Textarea id="edit-reason" name="reason" required minLength={5} maxLength={500} />
              </Field>
            </ActionForm>
          </Card>

          <Card>
            <CardHeader title="Excluir" description="A exclusão é lógica: o registro some das telas, mas permanece na auditoria com a justificativa." />
            <ActionForm
              action={deleteOccurrence}
              submitLabel="Excluir ocorrência"
              className="p-4"
              fieldLabels={{ reason: 'Justificativa' }}
            >
              <input type="hidden" name="occurrenceId" value={id} />
              <Field label="Justificativa da exclusão" htmlFor="del-reason">
                <Textarea id="del-reason" name="reason" required minLength={5} maxLength={500} />
              </Field>
            </ActionForm>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader title="Histórico" />
        {history.length === 0 ? (
          <EmptyState title="Sem alterações" description="Quando houver correção ou acompanhamento, a justificativa aparece aqui." />
        ) : (
          <ul className="divide-y divide-border">
            {history.map((h) => (
              <li key={h.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <span className="font-semibold">
                  {CHANGE_LABEL[h.action] ?? h.action} · {h.changedBy ?? '—'}
                </span>
                <span className="text-muted-foreground">{h.reason}</span>
                <time className="font-mono text-xs text-muted-foreground" dateTime={h.createdAt.toISOString()}>
                  {h.createdAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                </time>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
