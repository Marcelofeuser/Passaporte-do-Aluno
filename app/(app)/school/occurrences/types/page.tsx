import type { Metadata } from 'next'
import { archiveOccurrenceType, createOccurrenceType, updateOccurrenceType } from '@/app/actions/occurrences'
import { ActionForm, ConfirmSubmit } from '@/components/school/action-form'
import { BackLink, Checkbox } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { listOccurrenceTypes } from '@/lib/occurrence-queries'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Tipos de ocorrência' }

export default async function OccurrenceTypesPage() {
  const { schoolId } = await requireSchoolPage('school:manage_all_discipline')
  const types = await listOccurrenceTypes(schoolId)

  return (
    <>
      <BackLink href="/school/occurrences">Ocorrências</BackLink>
      <PageTitle
        title="Tipos de ocorrência"
        description="Categorias desta escola. Professor só usa tipos ativos; arquivar não apaga o histórico já registrado."
      />

      <Card>
        <CardHeader title={`${types.length} tipo(s)`} />
        {types.length === 0 ? (
          <EmptyState title="Nenhum tipo" description="Crie as categorias usadas pela escola." />
        ) : (
          <ul className="divide-y divide-border">
            {types.map((t) => (
              <li key={t.id} className="flex flex-col gap-3 px-4 py-3">
                <ActionForm
                  action={updateOccurrenceType}
                  submitLabel="Salvar"
                  resetOnSuccess={false}
                  className="gap-3"
                  fieldLabels={{ name: 'Nome' }}
                >
                  <input type="hidden" name="typeId" value={t.id} />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1">
                      <Field label="Nome" htmlFor={`name-${t.id}`}>
                        <Input id={`name-${t.id}`} name="name" required maxLength={80} defaultValue={t.name} />
                      </Field>
                    </div>
                    <Checkbox id={`pos-${t.id}`} name="isPositive" label="Mérito / positiva" defaultChecked={t.isPositive} />
                    <Checkbox id={`act-${t.id}`} name="isActive" label="Ativo" defaultChecked={t.isActive} />
                  </div>
                </ActionForm>
                <form action={archiveOccurrenceType}>
                  <input type="hidden" name="typeId" value={t.id} />
                  <ConfirmSubmit confirm={`Arquivar “${t.name}”?`}>Arquivar</ConfirmSubmit>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="Novo tipo" />
        <ActionForm action={createOccurrenceType} submitLabel="Criar tipo" className="p-4" fieldLabels={{ name: 'Nome' }}>
          <Field label="Nome" htmlFor="new-type">
            <Input id="new-type" name="name" required maxLength={80} placeholder="Ex.: Advertência escrita" />
          </Field>
          <Checkbox id="new-positive" name="isPositive" label="Ocorrência positiva / mérito" />
        </ActionForm>
      </Card>
    </>
  )
}
