import type { Metadata } from 'next'
import Link from 'next/link'
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
  searchParams: Promise<{ student?: string; category?: string; year?: string }>
}) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const students = await getFamilyStudents(schoolId, role === 'STUDENT' ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)
  const params = await searchParams
  const selected = students.find((item) => item.id === params.student) ?? students[0] ?? null
  const category = Object.keys(ACHIEVEMENT_CATEGORIES).includes(params.category ?? '') ? params.category : undefined
  const parsedYear = Number(params.year)
  const year = Number.isInteger(parsedYear) && parsedYear >= 2000 && parsedYear <= 2100 ? parsedYear : undefined
  const items = selected ? await listStudentAchievements(schoolId, selected.id, { category, year }) : []
  const canCreate = role === 'STUDENT'
  const today = new Date().toISOString().slice(0, 10)

  if (!selected) {
    return <><PageTitle title={role === 'STUDENT' ? 'Meu passaporte' : 'Conquistas dos meus filhos'} /><Card><EmptyState title="Nenhum aluno vinculado" description="Peça à secretaria para vincular o cadastro escolar à sua conta." /></Card></>
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <PageTitle title={role === 'STUDENT' ? 'Meu passaporte de conquistas' : 'Conquistas'} description={selected.socialName || selected.fullName} />
        <Link href={`/family/achievements/print?student=${selected.id}`} className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground">Imprimir ou salvar em PDF</Link>
      </div>
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
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <input type="hidden" name="student" value={selected.id} />
        <Field label="Categoria" htmlFor="family-achievement-filter-category">
          <Select id="family-achievement-filter-category" name="category" defaultValue={category ?? ''}>
            <option value="">Todas</option>
            {Object.entries(ACHIEVEMENT_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Ano" htmlFor="family-achievement-filter-year">
          <Select id="family-achievement-filter-year" name="year" defaultValue={year?.toString() ?? ''}>
            <option value="">Todos</option>
            {Array.from({ length: 7 }, (_, index) => new Date().getUTCFullYear() - index).map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </Field>
        <button className="h-10 rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted">Filtrar</button>
        <Link href="/family/achievements?student={selected.id}" className="text-sm text-muted-foreground underline">Limpar filtros</Link>
      </form>
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold">Linha do tempo</h2>
        <AchievementTimeline items={items} />
      </div>
    </>
  )
}
