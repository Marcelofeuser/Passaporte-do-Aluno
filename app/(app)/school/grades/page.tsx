import type { Metadata } from 'next'
import Link from 'next/link'
import { updatePassingGrade } from '@/app/actions/grades'
import { ActionForm } from '@/components/school/action-form'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { getPassingGrade, gradeScope, listGradebook } from '@/lib/grade-queries'
import { formatScore } from '@/lib/grades'
import { can } from '@/lib/rbac'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Diário e notas' }

export default async function GradesPage() {
  const { ctx, schoolId, role } = await requireSchoolPage('school:manage_grades')
  const scope = await gradeScope(schoolId, role, ctx.user.id, ctx.user.email)
  const [rows, passingGrade] = await Promise.all([listGradebook(schoolId, scope), getPassingGrade(schoolId)])
  const canConfigure = can(role, 'school:manage_all_grades')

  return (
    <>
      <PageTitle
        title="Diário e notas"
        description={
          scope.all
            ? 'Todas as disciplinas das turmas do ano letivo vigente.'
            : 'Somente as disciplinas em que você está designado como professor.'
        }
      />

      <Card>
        <CardHeader title="Disciplinas" description={`Média para aprovação: ${formatScore(passingGrade)}`} />
        {!scope.all && !scope.teacherId ? (
          <EmptyState
            title="Cadastro de professor não encontrado"
            description="Peça à secretaria para cadastrar você como professor usando o mesmo e-mail da sua conta."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Nenhuma disciplina"
            description="Não há disciplinas em turmas do ano letivo vigente para lançar notas."
          />
        ) : (
          <ul className="divide-y divide-border">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/school/grades/${r.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="font-semibold">{r.subjectName}</span>
                    <span className="text-sm text-muted-foreground">
                      {r.className} · {r.grade}
                      {r.teacherName ? ` · ${r.teacherName}` : ' · Sem professor'}
                      {r.workloadHours ? ` · ${r.workloadHours} h` : ''}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {r.assessments} {r.assessments === 1 ? 'avaliação' : 'avaliações'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canConfigure ? (
        <Card>
          <CardHeader title="Critério de aprovação" description="Média final mínima (0 a 10) usada no cálculo de situação." />
          <ActionForm action={updatePassingGrade} submitLabel="Salvar média" className="p-4">
            <Field label="Média para aprovação" htmlFor="passingGrade">
              <Input
                id="passingGrade"
                name="passingGrade"
                inputMode="decimal"
                required
                defaultValue={String(passingGrade).replace('.', ',')}
                className="max-w-32"
              />
            </Field>
          </ActionForm>
        </Card>
      ) : null}
    </>
  )
}
