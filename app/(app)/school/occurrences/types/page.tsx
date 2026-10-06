import type { Metadata } from 'next'
import { createOccurrenceType, updateOccurrenceThreshold, updateOccurrenceType, archiveOccurrenceType } from '@/app/actions/occurrences'
import { ActionForm, ConfirmSubmit } from '@/components/school/action-form'
import { BackLink, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { listOccurrenceTypes } from '@/lib/occurrence-queries'
import { requireSchoolPage } from '@/lib/school-page'
import { getSchoolProfile } from '@/lib/school-queries'

export const metadata: Metadata = { title: 'Tipos de ocorrência' }

export default async function OccurrenceTypesPage() {
  const { schoolId } = await requireSchoolPage('school:manage_academic')
  const [types, profile] = await Promise.all([listOccurrenceTypes(schoolId, true), getSchoolProfile(schoolId)])

  return (
    <>
      <BackLink href="/school/occurrences">Ocorrências</BackLink>
      <PageTitle title="Tipos de ocorrência" description="Categorias configuráveis para o registro disciplinar da escola." />

      <Card>
        <CardHeader title="Limite crítico" description="Quando o aluno atingir esse número no bimestre atual, a coordenação é notificada." />
        <ActionForm
          action={updateOccurrenceThreshold}
          submitLabel="Salvar limite"
          resetOnSuccess={false}
          className="border-t border-border p-4"
          fieldLabels={{ occurrenceAlertThreshold: 'Limite crítico' }}
        >
          <Field label="Limite de ocorrências" htmlFor="occurrenceAlertThreshold">
            <Input
              id="occurrenceAlertThreshold"
              name="occurrenceAlertThreshold"
              type="number"
              min={1}
              max={20}
              defaultValue={profile?.occurrenceAlertThreshold ?? 3}
            />
          </Field>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title="Cadastrar tipo" />
        <ActionForm action={createOccurrenceType} submitLabel="Criar tipo" className="p-4" fieldLabels={{ name: 'Nome', sortOrder: 'Ordem' }}>
          <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
            <Field label="Nome" htmlFor="name">
              <Input id="name" name="name" maxLength={80} required />
            </Field>
            <Field label="Ordem" htmlFor="sortOrder">
              <Input id="sortOrder" name="sortOrder" type="number" min={0} max={999} defaultValue={0} />
            </Field>
          </div>
          <Field label="Descrição" htmlFor="description">
            <Textarea id="description" name="description" maxLength={300} rows={3} />
          </Field>
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="active" defaultChecked />
            Tipo ativo
          </label>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title="Tipos cadastrados" />
        {types.length === 0 ? (
          <EmptyState title="Nenhum tipo cadastrado" description="Cadastre categorias para facilitar o registro das ocorrências." />
        ) : (
          <ul className="divide-y divide-border">
            {types.map((type) => (
              <li key={type.id} className="px-4 py-3">
                <ActionForm
                  action={updateOccurrenceType}
                  submitLabel="Salvar"
                  resetOnSuccess={false}
                  className="gap-3"
                  fieldLabels={{ name: 'Nome', sortOrder: 'Ordem' }}
                >
                  <input type="hidden" name="typeId" value={type.id} />
                  <div className="grid gap-3 sm:grid-cols-[1fr_10rem_auto] sm:items-end">
                    <Field label="Nome" htmlFor={`name-${type.id}`}>
                      <Input id={`name-${type.id}`} name="name" maxLength={80} required defaultValue={type.name} />
                    </Field>
                    <Field label="Ordem" htmlFor={`sort-${type.id}`}>
                      <Input id={`sort-${type.id}`} name="sortOrder" type="number" min={0} max={999} defaultValue={type.sortOrder} />
                    </Field>
                    <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
                      <input type="checkbox" name="active" defaultChecked={type.active} />
                      Ativo
                    </label>
                  </div>
                  <Field label="Descrição" htmlFor={`desc-${type.id}`}>
                    <Textarea id={`desc-${type.id}`} name="description" maxLength={300} rows={2} defaultValue={type.description ?? ''} />
                  </Field>
                </ActionForm>
                {!type.deletedAt ? (
                  <form action={archiveOccurrenceType} className="mt-2 flex justify-end">
                    <input type="hidden" name="typeId" value={type.id} />
                    <ConfirmSubmit confirm="Arquivar este tipo?">Arquivar tipo</ConfirmSubmit>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
