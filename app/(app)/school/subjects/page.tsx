import type { Metadata } from 'next'
import { archiveSubject, createSubject } from '@/app/actions/academic'
import { ActionForm, ConfirmSubmit } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { requireSchoolPage } from '@/lib/school-page'
import { listSubjects } from '@/lib/school-queries'

export const metadata: Metadata = { title: 'Disciplinas' }

export default async function SubjectsPage() {
  const { schoolId, canManage } = await requireSchoolPage('school:view_academic')
  const subjects = await listSubjects(schoolId)

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle title="Disciplinas" description="Componentes curriculares oferecidos pela escola." />
      <Card>
        <CardHeader title={`${subjects.length} ${subjects.length === 1 ? 'disciplina' : 'disciplinas'}`} />
        {subjects.length === 0 ? (
          <EmptyState
            title="Nenhuma disciplina cadastrada"
            description="As disciplinas formam a grade das turmas e o diário do professor. Comece por Língua Portuguesa, Matemática e Ciências no formulário abaixo."
          />
        ) : (
          <ul className="divide-y divide-border">
            {subjects.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                {s.code ? (
                  <span className="w-14 shrink-0 font-mono text-xs font-bold text-muted-foreground uppercase">{s.code}</span>
                ) : null}
                <span className="flex-1 font-semibold">{s.name}</span>
                {canManage ? (
                  <form action={archiveSubject}>
                    <input type="hidden" name="subjectId" value={s.id} />
                    <ConfirmSubmit confirm={`Arquivar ${s.name}?`}>Arquivar</ConfirmSubmit>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canManage ? (
        <Card>
          <CardHeader title="Nova disciplina" />
          <ActionForm action={createSubject} submitLabel="Criar disciplina" className="p-4" fieldLabels={{ name: 'Nome', code: 'Sigla' }}>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Nome" htmlFor="sub-name">
                <Input id="sub-name" name="name" required maxLength={80} />
              </Field>
              <Field label="Sigla" htmlFor="sub-code">
                <Input id="sub-code" name="code" maxLength={12} placeholder="MAT" />
              </Field>
            </div>
          </ActionForm>
        </Card>
      ) : null}
    </>
  )
}
