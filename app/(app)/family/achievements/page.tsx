import type { Metadata } from 'next'
import { ActionForm } from '@/components/school/action-form'
import { FileField, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { AchievementTimeline } from '@/components/school/achievement-timeline'
import { createAchievement } from '@/app/actions/achievements'
import { ACHIEVEMENT_CATEGORIES } from '@/lib/achievements'
import { listStudentAchievements } from '@/lib/achievement-queries'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Conquistas' }

export default async function FamilyAchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>
}) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const students = await getFamilyStudents(schoolId, role === 'STUDENT' ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)
  const params = await searchParams
  const selected = students.find((item) => item.id === params.student) ?? students[0] ?? null
  const items = selected ? await listStudentAchievements(schoolId, selected.id) : []
  const canCreate = role === 'STUDENT'
  const today = new Date().toISOString().slice(0, 10)

  if (!selected) {
    return <><PageTitle title={role === 'STUDENT' ? 'Meu passaporte' : 'Conquistas dos meus filhos'} /><Card><EmptyState title="Nenhum aluno vinculado" description="Peça à secretaria para vincular o cadastro escolar à sua conta." /></Card></>
  }

  return (
    <>
      <PageTitle title={role === 'STUDENT' ? 'Meu passaporte de conquistas' : 'Conquistas'} description={selected.socialName || selected.fullName} />
      {students.length > 1 ? (
        <form method="get">
          <Field label="Aluno" htmlFor="family-achievement-student">
            <Select id="family-achievement-student" name="student" defaultValue={selected.id}>
              {students.map((item) => <option key={item.id} value={item.id}>{item.socialName || item.fullName}</option>)}
            </Select>
          </Field>
          <button className="mt-2 h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">Abrir passaporte</button>
        </form>
      ) : null}
      {canCreate ? (
        <Card>
          <CardHeader title="Registrar conquista" description="Registre uma atividade que você realizou. A escola poderá consultar o lançamento." />
          <ActionForm action={createAchievement} submitLabel="Adicionar ao passaporte" className="p-4" fieldLabels={{ category: 'Categoria', title: 'Título', achievedOn: 'Data', description: 'Descrição', evidence: 'Evidência' }}>
            <input type="hidden" name="studentId" value={selected.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Categoria" htmlFor="family-achievement-category">
                <Select id="family-achievement-category" name="category" required defaultValue="ACADEMIC">
                  {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Data da conquista" htmlFor="family-achievement-date">
                <Input id="family-achievement-date" name="achievedOn" type="date" required defaultValue={today} max={today} />
              </Field>
            </div>
            <Field label="Título" htmlFor="family-achievement-title"><Input id="family-achievement-title" name="title" required minLength={3} maxLength={120} /></Field>
            <Field label="Descrição" htmlFor="family-achievement-description"><Textarea id="family-achievement-description" name="description" required minLength={3} maxLength={2000} /></Field>
            <FileField id="family-achievement-evidence" name="evidence" label="Evidência (opcional)" accept="image/png,image/jpeg,image/webp,application/pdf" hint="Imagem ou PDF, até 10 MB." />
          </ActionForm>
        </Card>
      ) : null}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Linha do tempo</h2>
        <AchievementTimeline items={items} />
      </div>
    </>
  )
}
