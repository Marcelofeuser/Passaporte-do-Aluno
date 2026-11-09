import type { Metadata } from 'next'
import Link from 'next/link'
import { ActionForm } from '@/components/school/action-form'
import { FileField, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { AchievementTimeline } from '@/components/school/achievement-timeline'
import { AchievementSummary } from '@/components/school/achievement-summary'
import { createAchievement } from '@/app/actions/achievements'
import { ACHIEVEMENT_CATEGORIES } from '@/lib/achievements'
import { getAchievementStats, listAchievementStudents, listStudentAchievements } from '@/lib/achievement-queries'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Passaporte de conquistas' }

export default async function SchoolAchievementsPage({
  searchParams,
}: {
  searchParams: Promise<{ student?: string; category?: string; year?: string }>
}) {
  const { ctx, schoolId, role } = await requireSchoolPage('school:manage_achievements')
  const params = await searchParams
  const students = await listAchievementStudents(schoolId, role, ctx.user.id)
  const stats = await getAchievementStats(schoolId, students.map((item) => item.id))
  const selected = students.find((item) => item.id === params.student) ?? students[0] ?? null
  const category = Object.keys(ACHIEVEMENT_CATEGORIES).includes(params.category ?? '') ? params.category : undefined
  const parsedYear = Number(params.year)
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : undefined
  const items = selected ? await listStudentAchievements(schoolId, selected.id, { category, year }) : []
  const today = new Date().toISOString().slice(0, 10)

  return (
    <>
      <PageTitle title="Passaporte de conquistas" description="Registre e acompanhe conquistas dos alunos das suas turmas." />
      <AchievementSummary stats={stats} />
      {students.length === 0 ? (
        <Card><EmptyState title="Nenhum aluno disponível" description="Alunos matriculados em suas turmas aparecerão aqui." /></Card>
      ) : (
        <>
          <Card>
            <CardHeader title="Escolher aluno" description="Professores veem apenas alunos matriculados em turmas que lecionam." />
            <form method="get" className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
              <Field label="Aluno" htmlFor="achievement-student">
                <Select id="achievement-student" name="student" defaultValue={selected?.id ?? ''}>
                  {students.map((item) => (
                    <option key={item.id} value={item.id}>{item.socialName || item.fullName}{item.registrationCode ? ` · ${item.registrationCode}` : ''}</option>
                  ))}
                </Select>
              </Field>
              <button className="h-11 rounded-lg border border-border px-4 font-semibold hover:bg-muted">Abrir passaporte</button>
            </form>
          </Card>
          {selected ? (
            <>
              <Card>
                <CardHeader title="Nova conquista" description={`Registro para ${selected.socialName || selected.fullName}.`} />
                <ActionForm action={createAchievement} submitLabel="Registrar conquista" className="p-4" fieldLabels={{ category: 'Categoria', title: 'Título', achievedOn: 'Data', description: 'Descrição', evidence: 'Evidência' }}>
                  <input type="hidden" name="studentId" value={selected.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Categoria" htmlFor="achievement-category">
                      <Select id="achievement-category" name="category" required defaultValue="ACADEMIC">
                        {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                      </Select>
                    </Field>
                    <Field label="Data da conquista" htmlFor="achievement-date">
                      <Input id="achievement-date" name="achievedOn" type="date" required defaultValue={today} max={today} />
                    </Field>
                  </div>
                  <Field label="Título" htmlFor="achievement-title">
                    <Input id="achievement-title" name="title" required minLength={3} maxLength={120} placeholder="Ex.: Medalha na olimpíada de matemática" />
                  </Field>
                  <Field label="Descrição" htmlFor="achievement-description">
                    <Textarea id="achievement-description" name="description" required minLength={3} maxLength={2000} placeholder="Conte o que o aluno realizou e por que essa conquista foi importante." />
                  </Field>
                  <FileField id="achievement-evidence" name="evidence" label="Evidência (opcional)" accept="image/png,image/jpeg,image/webp,application/pdf" hint="Imagem ou PDF, até 10 MB. O arquivo fica privado e só é exibido a pessoas autorizadas." />
                </ActionForm>
              </Card>
              <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
                <input type="hidden" name="student" value={selected.id} />
                <Field label="Categoria" htmlFor="school-achievement-filter-category">
                  <Select id="school-achievement-filter-category" name="category" defaultValue={category ?? ''}>
                    <option value="">Todas</option>
                    {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </Select>
                </Field>
                <Field label="Ano" htmlFor="school-achievement-filter-year">
                  <Select id="school-achievement-filter-year" name="year" defaultValue={year?.toString() ?? ''}>
                    <option value="">Todos</option>
                    {Array.from({ length: 7 }, (_, index) => new Date().getUTCFullYear() - index).map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </Field>
                <button className="h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">Filtrar</button>
                <Link href={`/school/achievements?student=${selected.id}`} className="text-sm text-muted-foreground underline">Limpar filtros</Link>
              </form>
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold">Linha do tempo</h2>
                <AchievementTimeline items={items} />
              </div>
            </>
          ) : null}
        </>
      )}
    </>
  )
}
