import type { Metadata } from 'next'
import Link from 'next/link'
import { createClass } from '@/app/actions/academic'
import { ActionForm } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { UUID_RE } from '@/lib/school-action'
import { requireSchoolPage } from '@/lib/school-page'
import { listAcademicYears, listClasses, listTeachers } from '@/lib/school-queries'
import { SHIFTS } from '@/lib/validation'

export const metadata: Metadata = { title: 'Turmas' }

export default async function ClassesPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { schoolId, canManage } = await requireSchoolPage('school:view_academic')
  const years = await listAcademicYears(schoolId)
  const { year } = await searchParams
  const selected =
    years.find((y) => y.id === year && UUID_RE.test(year)) ?? years.find((y) => y.isCurrent) ?? years[0] ?? null

  const [classes, teachers] = await Promise.all([
    selected ? listClasses(schoolId, selected.id) : Promise.resolve([]),
    canManage ? listTeachers(schoolId) : Promise.resolve([]),
  ])

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle title="Turmas" description="Organize as turmas de cada ano letivo." />

      {years.length === 0 ? (
        <Card>
          <EmptyState title="Crie um ano letivo primeiro" description="As turmas pertencem a um ano letivo." />
          <div className="flex justify-center pb-6">
            <Link href="/school/years" className="font-semibold text-primary hover:underline">
              Ir para anos letivos
            </Link>
          </div>
        </Card>
      ) : (
        <>
          <nav aria-label="Ano letivo" className="flex flex-wrap gap-2">
            {years.map((y) => (
              <Link
                key={y.id}
                href={`/school/classes?year=${y.id}`}
                aria-current={y.id === selected?.id ? 'page' : undefined}
                className={
                  y.id === selected?.id
                    ? 'rounded-lg bg-primary px-3 py-1.5 font-mono font-bold text-primary-foreground'
                    : 'rounded-lg bg-card px-3 py-1.5 font-mono font-bold text-foreground ring-1 ring-border hover:bg-muted'
                }
              >
                {y.year}
              </Link>
            ))}
          </nav>

          <Card>
            <CardHeader title={`${classes.length} ${classes.length === 1 ? 'turma' : 'turmas'} em ${selected?.year}`} />
            {classes.length === 0 ? (
              <EmptyState title="Nenhuma turma" description="Crie a primeira turma deste ano letivo." />
            ) : (
              <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
                {classes.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/school/classes/${c.id}`}
                      className="flex h-full flex-col gap-1 rounded-lg border border-border p-3 hover:border-primary focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className="text-lg font-extrabold">{c.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {c.grade} · {SHIFTS[c.shift as keyof typeof SHIFTS] ?? c.shift}
                      </span>
                      <span className="mt-auto pt-2 text-sm">
                        <strong className="font-mono tabular-nums">{c.enrolled}</strong>
                        {c.capacity ? `/${c.capacity}` : ''} alunos
                        {c.homeroomTeacher ? ` · ${c.homeroomTeacher}` : ''}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {canManage && selected ? (
            <Card>
              <CardHeader title="Nova turma" description={`Será criada em ${selected.year}.`} />
              <ActionForm
                action={createClass}
                submitLabel="Criar turma"
                className="p-4"
                fieldLabels={{ name: 'Nome', grade: 'Série', shift: 'Turno', capacity: 'Capacidade' }}
              >
                <input type="hidden" name="academicYearId" value={selected.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome da turma" htmlFor="c-name">
                    <Input id="c-name" name="name" required maxLength={60} placeholder="6º A" />
                  </Field>
                  <Field label="Série / ano" htmlFor="c-grade">
                    <Input id="c-grade" name="grade" required maxLength={60} placeholder="6º ano" />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Turno" htmlFor="c-shift">
                    <Select id="c-shift" name="shift" defaultValue="MORNING">
                      {Object.entries(SHIFTS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Capacidade" htmlFor="c-capacity">
                    <Input id="c-capacity" name="capacity" type="number" min={1} max={200} />
                  </Field>
                  <Field label="Professor regente" htmlFor="c-teacher">
                    <Select id="c-teacher" name="homeroomTeacherId" defaultValue="">
                      <option value="">Nenhum</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </ActionForm>
            </Card>
          ) : null}
        </>
      )}
    </>
  )
}
