import type { Metadata } from 'next'
import { createOccurrence } from '@/app/actions/occurrences'
import { ActionForm } from '@/components/school/action-form'
import { BackLink, Checkbox, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { nowSaoPauloTime, OCCURRENCE_MEASURES, OCCURRENCE_SEVERITY, todayISO } from '@/lib/occurrences'
import { disciplineScope, listDisciplineStudents, listOccurrenceTypes } from '@/lib/occurrence-queries'
import { UUID_RE } from '@/lib/school-action'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Registrar ocorrência' }

export default async function NewOccurrencePage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>
}) {
  const { ctx, schoolId, role } = await requireSchoolPage('school:manage_discipline')
  const scope = await disciplineScope(schoolId, role, ctx.user.id, ctx.user.email)
  const { student: preselect } = await searchParams
  const [types, students] = await Promise.all([
    listOccurrenceTypes(schoolId, { activeOnly: true }),
    listDisciplineStudents(schoolId, scope),
  ])
  const selected = preselect && UUID_RE.test(preselect) && students.some((s) => s.studentId === preselect) ? preselect : ''

  return (
    <>
      <BackLink href="/school/occurrences">Ocorrências</BackLink>
      <PageTitle title="Registrar ocorrência" description="O fato fica isolado nesta escola. Marque como interna se não deve aparecer para a família." />

      {students.length === 0 ? (
        <Card>
          <EmptyState
            title={scope.all ? 'Nenhum aluno matriculado' : 'Cadastro de professor não encontrado'}
            description={
              scope.all
                ? 'Matricule alunos no ano letivo vigente para registrar ocorrências.'
                : 'Peça à secretaria para cadastrar você como professor e associar às turmas.'
            }
          />
        </Card>
      ) : (
        <Card>
          <CardHeader title="Fato" />
          <ActionForm
            action={createOccurrence}
            submitLabel="Registrar ocorrência"
            className="p-4"
            fieldLabels={{
              studentId: 'Aluno',
              typeId: 'Tipo',
              occurredOn: 'Data',
              occurredTime: 'Horário',
              severity: 'Gravidade',
              description: 'Descrição',
            }}
          >
            <Field label="Aluno" htmlFor="studentId">
              <Select id="studentId" name="studentId" required defaultValue={selected}>
                <option value="">Selecione</option>
                {students.map((s) => (
                  <option key={s.studentId} value={s.studentId}>
                    {s.socialName || s.fullName}
                    {s.className ? ` · ${s.className}` : ''}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tipo" htmlFor="typeId">
                <Select id="typeId" name="typeId" required>
                  <option value="">Selecione</option>
                  {types.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.isPositive ? ' (mérito)' : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Gravidade" htmlFor="severity">
                <Select id="severity" name="severity" required defaultValue="MILD">
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
                <Input id="occurredOn" name="occurredOn" type="date" required defaultValue={todayISO()} />
              </Field>
              <Field label="Horário" htmlFor="occurredTime">
                <Input id="occurredTime" name="occurredTime" type="time" required defaultValue={nowSaoPauloTime()} />
              </Field>
            </div>
            <Field label="Descrição do fato" htmlFor="description">
              <Textarea id="description" name="description" required minLength={10} maxLength={4000} />
            </Field>
            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-semibold">Encaminhamentos</legend>
              {Object.entries(OCCURRENCE_MEASURES).map(([k, v]) => (
                <Checkbox key={k} id={`m-${k}`} name="measures" value={k} label={v} />
              ))}
            </fieldset>
            <Field label="Detalhe das medidas (opcional)" htmlFor="measuresNote">
              <Input id="measuresNote" name="measuresNote" maxLength={500} />
            </Field>
            <Checkbox id="visibleToFamily" name="visibleToFamily" label="Visível para os responsáveis" defaultChecked />
            <p className="text-sm text-muted-foreground">
              Desmarque para manter o registro interno (equipe pedagógica e direção). A família só vê o que estiver marcado.
            </p>
          </ActionForm>
        </Card>
      )}
    </>
  )
}
