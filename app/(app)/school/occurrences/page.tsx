import type { Metadata } from 'next'
import Link from 'next/link'
import {
  addOccurrenceAction,
  archiveOccurrence,
  createOccurrence,
  transitionOccurrenceStatus,
  updateOccurrence,
} from '@/app/actions/occurrences'
import { ActionForm } from '@/components/school/action-form'
import { BackLink, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { can } from '@/lib/rbac'
import { listOccurrenceActions, listOccurrences, listOccurrenceTypes } from '@/lib/occurrence-queries'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { listClasses, listStudents } from '@/lib/school-queries'
import {
  OCCURRENCE_SEVERITY,
  OCCURRENCE_STATUS,
  OCCURRENCE_VISIBILITY,
} from '@/lib/validation'

export const metadata: Metadata = { title: 'Ocorrências' }

type Params = {
  studentId?: string
  classId?: string
  typeId?: string
  severity?: string
  status?: string
  visibility?: string
  from?: string
  to?: string
  page?: string
}

export default async function OccurrencesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const { schoolId, role } = await requireSchoolPage('school:manage_attendance')
  const sp = await searchParams
  const page = Number(sp.page || '1') || 1
  const [students, classes, types, result] = await Promise.all([
    listStudents(schoolId),
    listClasses(schoolId),
    listOccurrenceTypes(schoolId),
    listOccurrences(schoolId, {
      studentId: sp.studentId,
      classId: sp.classId,
      typeId: sp.typeId,
      severity: sp.severity,
      status: sp.status,
      visibility: sp.visibility,
      from: sp.from ? new Date(`${sp.from}T00:00:00`) : undefined,
      to: sp.to ? new Date(`${sp.to}T23:59:59`) : undefined,
      page,
      pageSize: 20,
    }),
  ])

  const actionsByOccurrence = new Map<string, Awaited<ReturnType<typeof listOccurrenceActions>>>()
  for (const row of result.items.slice(0, 10)) {
    actionsByOccurrence.set(row.id, await listOccurrenceActions(schoolId, row.id))
  }

  const queryBase = {
    studentId: sp.studentId ?? '',
    classId: sp.classId ?? '',
    typeId: sp.typeId ?? '',
    severity: sp.severity ?? '',
    status: sp.status ?? '',
    visibility: sp.visibility ?? '',
    from: sp.from ?? '',
    to: sp.to ?? '',
  }

  const pageHref = (nextPage: number) => {
    const q = new URLSearchParams({ ...queryBase, page: String(nextPage) })
    return `/school/occurrences?${q}`
  }

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle title="Ocorrências e disciplina" description="Registro disciplinar com acompanhamento, auditoria e visibilidade controlada." />

      {can(role, 'school:manage_academic') ? (
        <p className="text-sm text-muted-foreground">
          <Link href="/school/occurrences/types" className="font-semibold text-primary hover:underline">
            Configurar tipos de ocorrência e limite crítico
          </Link>
        </p>
      ) : null}

      <Card>
        <CardHeader title="Filtros" />
        <form className="grid gap-3 border-t border-border p-4 sm:grid-cols-4">
          <Field label="Aluno" htmlFor="f-student">
            <Select id="f-student" name="studentId" defaultValue={sp.studentId ?? ''}>
              <option value="">Todos</option>
              {students.map((s) => (
                <option key={s.id} value={s.id}>{s.socialName ?? s.fullName}</option>
              ))}
            </Select>
          </Field>
          <Field label="Turma" htmlFor="f-class">
            <Select id="f-class" name="classId" defaultValue={sp.classId ?? ''}>
              <option value="">Todas</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tipo" htmlFor="f-type">
            <Select id="f-type" name="typeId" defaultValue={sp.typeId ?? ''}>
              <option value="">Todos</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Gravidade" htmlFor="f-sev">
            <Select id="f-sev" name="severity" defaultValue={sp.severity ?? ''}>
              <option value="">Todas</option>
              {Object.entries(OCCURRENCE_SEVERITY).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="f-status">
            <Select id="f-status" name="status" defaultValue={sp.status ?? ''}>
              <option value="">Todos</option>
              {Object.entries(OCCURRENCE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="Visibilidade" htmlFor="f-vis">
            <Select id="f-vis" name="visibility" defaultValue={sp.visibility ?? ''}>
              <option value="">Todas</option>
              {Object.entries(OCCURRENCE_VISIBILITY).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </Select>
          </Field>
          <Field label="De" htmlFor="f-from">
            <Input id="f-from" name="from" type="date" defaultValue={sp.from ?? ''} />
          </Field>
          <Field label="Até" htmlFor="f-to">
            <Input id="f-to" name="to" type="date" defaultValue={sp.to ?? ''} />
          </Field>
          <div className="sm:col-span-4">
            <button type="submit" className="h-11 rounded-lg bg-secondary px-4 font-semibold text-secondary-foreground">
              Filtrar
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <CardHeader title="Nova ocorrência" description="Alterações e arquivamentos exigem justificativa obrigatória." />
        <ActionForm action={createOccurrence} submitLabel="Registrar ocorrência" className="border-t border-border p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Aluno" htmlFor="studentId">
              <Select id="studentId" name="studentId" required defaultValue="">
                <option value="" disabled>Selecione…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.socialName ?? s.fullName}</option>
                ))}
              </Select>
            </Field>
            <Field label="Turma (opcional)" htmlFor="classId">
              <Select id="classId" name="classId" defaultValue="">
                <option value="">Sem turma</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Tipo" htmlFor="occurrenceTypeId">
              <Select id="occurrenceTypeId" name="occurrenceTypeId" required defaultValue="">
                <option value="" disabled>Selecione…</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Data/hora" htmlFor="occurredAt">
              <Input id="occurredAt" name="occurredAt" type="datetime-local" required />
            </Field>
            <Field label="Gravidade" htmlFor="severity">
              <Select id="severity" name="severity" defaultValue="LEVE">
                {Object.entries(OCCURRENCE_SEVERITY).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
            <Field label="Visibilidade" htmlFor="visibility">
              <Select id="visibility" name="visibility" defaultValue="INTERNAL">
                {Object.entries(OCCURRENCE_VISIBILITY).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue="PENDENTE">
                {Object.entries(OCCURRENCE_STATUS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Descrição" htmlFor="description">
            <Textarea id="description" name="description" rows={3} maxLength={4000} required />
          </Field>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title={`Registros (${result.total})`} />
        {result.items.length === 0 ? (
          <EmptyState title="Nenhuma ocorrência" description="Tente ajustar os filtros ou registre a primeira ocorrência." />
        ) : (
          <ul className="divide-y divide-border">
            {result.items.map((item) => {
              const actions = actionsByOccurrence.get(item.id) ?? []
              return (
                <li key={item.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="font-semibold">{item.studentName} · {item.typeName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(item.occurredAt)} · {item.className ?? 'Sem turma'} · {item.reporterName ?? 'Equipe'}
                      </p>
                      <p className="text-sm">{item.description}</p>
                    </div>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">{OCCURRENCE_SEVERITY[item.severity as keyof typeof OCCURRENCE_SEVERITY]}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{OCCURRENCE_STATUS[item.status as keyof typeof OCCURRENCE_STATUS]}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{OCCURRENCE_VISIBILITY[item.visibility as keyof typeof OCCURRENCE_VISIBILITY]}</span>
                  </div>

                  <details className="mt-3 rounded-lg border border-border">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-semibold">Editar / acompanhar</summary>
                    <div className="space-y-4 border-t border-border p-3">
                      <ActionForm action={updateOccurrence} submitLabel="Salvar alterações" resetOnSuccess={false} className="gap-3">
                        <input type="hidden" name="occurrenceId" value={item.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Aluno" htmlFor={`s-${item.id}`}>
                            <Select id={`s-${item.id}`} name="studentId" defaultValue={item.studentId}>
                              {students.map((s) => (
                                <option key={s.id} value={s.id}>{s.socialName ?? s.fullName}</option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="Turma" htmlFor={`c-${item.id}`}>
                            <Select id={`c-${item.id}`} name="classId" defaultValue={item.classId ?? ''}>
                              <option value="">Sem turma</option>
                              {classes.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </Select>
                          </Field>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-4">
                          <Field label="Tipo" htmlFor={`t-${item.id}`}>
                            <Select id={`t-${item.id}`} name="occurrenceTypeId" defaultValue={item.occurrenceTypeId}>
                              {types.map((t) => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="Data/hora" htmlFor={`d-${item.id}`}>
                            <Input id={`d-${item.id}`} name="occurredAt" type="datetime-local" defaultValue={new Date(item.occurredAt).toISOString().slice(0, 16)} />
                          </Field>
                          <Field label="Gravidade" htmlFor={`g-${item.id}`}>
                            <Select id={`g-${item.id}`} name="severity" defaultValue={item.severity}>
                              {Object.entries(OCCURRENCE_SEVERITY).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </Select>
                          </Field>
                          <Field label="Status" htmlFor={`st-${item.id}`}>
                            <Select id={`st-${item.id}`} name="status" defaultValue={item.status}>
                              {Object.entries(OCCURRENCE_STATUS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </Select>
                          </Field>
                        </div>
                        <Field label="Visibilidade" htmlFor={`v-${item.id}`}>
                          <Select id={`v-${item.id}`} name="visibility" defaultValue={item.visibility}>
                            {Object.entries(OCCURRENCE_VISIBILITY).map(([k, v]) => (
                              <option key={k} value={k}>{v}</option>
                            ))}
                          </Select>
                        </Field>
                        <Field label="Descrição" htmlFor={`desc-${item.id}`}>
                          <Textarea id={`desc-${item.id}`} name="description" rows={3} defaultValue={item.description} />
                        </Field>
                        <Field label="Justificativa obrigatória" htmlFor={`just-${item.id}`}>
                          <Input id={`just-${item.id}`} name="justification" minLength={5} maxLength={500} required />
                        </Field>
                      </ActionForm>

                      <ActionForm action={transitionOccurrenceStatus} submitLabel="Atualizar status" className="gap-2">
                        <input type="hidden" name="occurrenceId" value={item.id} />
                        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                          <Field label="Novo status" htmlFor={`status-only-${item.id}`}>
                            <Select id={`status-only-${item.id}`} name="status" defaultValue={item.status}>
                              {Object.entries(OCCURRENCE_STATUS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                              ))}
                            </Select>
                          </Field>
                        </div>
                      </ActionForm>

                      <div className="rounded-md bg-muted p-3">
                        <p className="mb-2 text-sm font-semibold">Acompanhamentos</p>
                        {actions.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Sem ações registradas.</p>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {actions.map((a) => (
                              <li key={a.id}>
                                <strong>{a.actionType}</strong> · {formatDate(a.performedAt)}
                                {a.actorName ? ` · ${a.actorName}` : ''}
                                <br />
                                <span className="text-muted-foreground">{a.description}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <ActionForm action={addOccurrenceAction} submitLabel="Adicionar acompanhamento" className="gap-3">
                        <input type="hidden" name="occurrenceId" value={item.id} />
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Tipo da ação" htmlFor={`a-type-${item.id}`}>
                            <Input id={`a-type-${item.id}`} name="actionType" maxLength={80} required />
                          </Field>
                          <Field label="Data/hora" htmlFor={`a-date-${item.id}`}>
                            <Input id={`a-date-${item.id}`} name="performedAt" type="datetime-local" />
                          </Field>
                        </div>
                        <Field label="Descrição" htmlFor={`a-desc-${item.id}`}>
                          <Textarea id={`a-desc-${item.id}`} name="description" rows={2} maxLength={1000} required />
                        </Field>
                        <Field label="Prazo (opcional)" htmlFor={`a-due-${item.id}`}>
                          <Input id={`a-due-${item.id}`} name="dueDate" type="date" />
                        </Field>
                      </ActionForm>

                      <ActionForm action={archiveOccurrence} submitLabel="Arquivar ocorrência" className="gap-2">
                        <input type="hidden" name="occurrenceId" value={item.id} />
                        <Field label="Justificativa obrigatória" htmlFor={`arc-${item.id}`}>
                          <Input id={`arc-${item.id}`} name="justification" minLength={5} maxLength={500} required />
                        </Field>
                      </ActionForm>
                    </div>
                  </details>
                </li>
              )
            })}
          </ul>
        )}
        <footer className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">Página {result.page} de {result.totalPages}</span>
          <div className="flex gap-2">
            {result.page > 1 ? (
              <Link className="rounded-md border border-border px-3 py-1.5 font-semibold hover:bg-muted" href={pageHref(result.page - 1)}>
                Anterior
              </Link>
            ) : null}
            {result.page < result.totalPages ? (
              <Link className="rounded-md border border-border px-3 py-1.5 font-semibold hover:bg-muted" href={pageHref(result.page + 1)}>
                Próxima
              </Link>
            ) : null}
          </div>
        </footer>
      </Card>
    </>
  )
}
