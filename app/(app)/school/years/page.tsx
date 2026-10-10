import type { Metadata } from 'next'
import { createAcademicYear, setCurrentAcademicYear } from '@/app/actions/academic'
import { ActionForm } from '@/components/school/action-form'
import { BackLink, Checkbox } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle, RoleStamp } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { listAcademicYears } from '@/lib/school-queries'

export const metadata: Metadata = { title: 'Anos letivos' }

export default async function YearsPage() {
  const { schoolId, canManage } = await requireSchoolPage('school:view_academic')
  const years = await listAcademicYears(schoolId)
  const nextYear = (years[0]?.year ?? new Date().getFullYear() - 1) + 1

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle title="Anos letivos" description="O ano vigente define onde novas turmas e matrículas acontecem." />
      <Card>
        <CardHeader title="Calendário" />
        {years.length === 0 ? (
          <EmptyState
            title="Nenhum ano letivo"
            description="Este é o primeiro passo. Crie o ano letivo atual e marque-o como vigente: turmas, notas e frequência ficam ligadas a ele."
          />
        ) : (
          <ul className="divide-y divide-border">
            {years.map((y) => (
              <li key={y.id} className="flex items-center gap-3 px-4 py-3">
                <span className="font-mono text-xl font-extrabold tabular-nums">{y.year}</span>
                <span className="flex-1 text-sm text-muted-foreground">
                  {formatDate(y.startsOn)} a {formatDate(y.endsOn)}
                </span>
                {y.isCurrent ? (
                  <RoleStamp>Vigente</RoleStamp>
                ) : canManage ? (
                  <form action={setCurrentAcademicYear}>
                    <input type="hidden" name="academicYearId" value={y.id} />
                    <button type="submit" className="rounded-md px-2 py-1 text-sm font-semibold text-primary hover:bg-muted">
                      Tornar vigente
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
      {canManage ? (
        <Card>
          <CardHeader title="Novo ano letivo" />
          <ActionForm action={createAcademicYear} submitLabel="Criar ano letivo" className="p-4" fieldLabels={{ year: 'Ano', startsOn: 'Início', endsOn: 'Término' }}>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Ano" htmlFor="y-year">
                <Input id="y-year" name="year" type="number" min={2000} max={2100} required defaultValue={nextYear} />
              </Field>
              <Field label="Início" htmlFor="y-start">
                <Input id="y-start" name="startsOn" type="date" required defaultValue={`${nextYear}-02-01`} />
              </Field>
              <Field label="Término" htmlFor="y-end">
                <Input id="y-end" name="endsOn" type="date" required defaultValue={`${nextYear}-12-15`} />
              </Field>
            </div>
            <Checkbox id="y-current" name="isCurrent" label="Definir como ano vigente" defaultChecked={years.length === 0} />
          </ActionForm>
        </Card>
      ) : null}
    </>
  )
}
