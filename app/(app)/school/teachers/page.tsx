import type { Metadata } from 'next'
import { archiveTeacher, assignTeacherSubject, createTeacher, removeTeacherSubject } from '@/app/actions/academic'
import { ActionForm, ConfirmSubmit } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { requireSchoolPage } from '@/lib/school-page'
import { listSubjects, listTeachers } from '@/lib/school-queries'

export const metadata: Metadata = { title: 'Professores' }

export default async function TeachersPage() {
  const { schoolId, canManage } = await requireSchoolPage('school:view_academic')
  const [teachers, subjects] = await Promise.all([listTeachers(schoolId), listSubjects(schoolId)])

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle title="Professores" description="Corpo docente e as disciplinas que cada um leciona." />

      <Card>
        <CardHeader title={`${teachers.length} ${teachers.length === 1 ? 'professor' : 'professores'}`} />
        {teachers.length === 0 ? (
          <EmptyState title="Nenhum professor" description="Cadastre o corpo docente para montar as turmas." />
        ) : (
          <ul className="divide-y divide-border">
            {teachers.map((t) => (
              <li key={t.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{t.fullName}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {[t.email, t.phone].filter(Boolean).join(' · ') || 'Sem contato'}
                    </span>
                  </div>
                  {canManage ? (
                    <form action={archiveTeacher}>
                      <input type="hidden" name="teacherId" value={t.id} />
                      <ConfirmSubmit confirm={`Arquivar ${t.fullName}? Ele será removido das turmas.`}>Arquivar</ConfirmSubmit>
                    </form>
                  ) : null}
                </div>
                <ul className="flex flex-wrap gap-1.5" aria-label={`Disciplinas de ${t.fullName}`}>
                  {t.subjects.length === 0 ? (
                    <li className="text-sm text-muted-foreground">Nenhuma disciplina atribuída</li>
                  ) : (
                    t.subjects.map((sub) => (
                      <li key={sub.id} className="flex items-center gap-1 rounded-md bg-secondary py-0.5 pr-1 pl-2 text-xs font-semibold text-secondary-foreground">
                        {sub.name}
                        {canManage ? (
                          <form action={removeTeacherSubject}>
                            <input type="hidden" name="teacherId" value={t.id} />
                            <input type="hidden" name="subjectId" value={sub.id} />
                            <button type="submit" className="rounded px-1 hover:bg-background" aria-label={`Remover ${sub.name}`}>
                              {'×'}
                            </button>
                          </form>
                        ) : null}
                      </li>
                    ))
                  )}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Cadastrar professor" />
            <ActionForm action={createTeacher} submitLabel="Cadastrar" className="p-4" fieldLabels={{ fullName: 'Nome', email: 'E-mail' }}>
              <Field label="Nome completo" htmlFor="t-fullName">
                <Input id="t-fullName" name="fullName" required maxLength={160} />
              </Field>
              <Field label="E-mail" htmlFor="t-email">
                <Input id="t-email" name="email" type="email" maxLength={160} />
              </Field>
              <Field label="Telefone" htmlFor="t-phone">
                <Input id="t-phone" name="phone" type="tel" maxLength={20} />
              </Field>
            </ActionForm>
          </Card>
          {teachers.length > 0 && subjects.length > 0 ? (
            <Card>
              <CardHeader title="Atribuir disciplina" />
              <ActionForm action={assignTeacherSubject} submitLabel="Atribuir" className="p-4">
                <Field label="Professor" htmlFor="ts-teacher">
                  <Select id="ts-teacher" name="teacherId" required>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Disciplina" htmlFor="ts-subject">
                  <Select id="ts-subject" name="subjectId" required>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </ActionForm>
            </Card>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
