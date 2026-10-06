import type { Metadata } from 'next'
import Link from 'next/link'
import { createStudent } from '@/app/actions/students'
import { ActionForm } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { listStudents } from '@/lib/school-queries'
import { fileUrl } from '@/lib/storage'

export const metadata: Metadata = { title: 'Alunos' }

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { schoolId, canManage } = await requireSchoolPage('school:view_students')
  const { q = '' } = await searchParams
  const students = await listStudents(schoolId, q.slice(0, 80))

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle title="Alunos" description="Busque por nome, nome social ou matrícula." />

      <form role="search" className="flex gap-2">
        <label htmlFor="q" className="sr-only">
          Buscar aluno
        </label>
        <Input id="q" name="q" type="search" defaultValue={q} placeholder="Buscar aluno…" maxLength={80} />
        <button type="submit" className="h-11 rounded-lg bg-secondary px-4 font-semibold text-secondary-foreground">
          Buscar
        </button>
      </form>

      <Card>
        <CardHeader title={`${students.length} ${students.length === 1 ? 'aluno' : 'alunos'}${q ? ` para “${q}”` : ''}`} />
        {students.length === 0 ? (
          <EmptyState
            title={q ? 'Nenhum aluno encontrado' : 'Nenhum aluno cadastrado'}
            description={q ? 'Tente outro termo de busca.' : 'Cadastre o primeiro aluno no formulário abaixo.'}
          />
        ) : (
          <ul className="divide-y divide-border">
            {students.map((s) => (
              <li key={s.id}>
                <Link href={`/school/students/${s.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                  {s.photoPathname ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={fileUrl(s.photoPathname)} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground">
                      {(s.socialName ?? s.fullName).charAt(0)}
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-semibold">{s.socialName ?? s.fullName}</span>
                    <span className="truncate text-sm text-muted-foreground">
                      {s.registrationCode ? `Matrícula ${s.registrationCode} · ` : ''}
                      {s.birthDate ? `Nasc. ${formatDate(s.birthDate)}` : 'Sem data de nascimento'}
                    </span>
                  </div>
                  <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                    {s.className ?? 'Sem turma'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage ? (
        <Card>
          <CardHeader title="Cadastrar aluno" description="Os demais dados, responsáveis e documentos ficam na ficha do aluno." />
          <ActionForm
            action={createStudent}
            submitLabel="Cadastrar e abrir ficha"
            pendingLabel="Cadastrando…"
            className="p-4"
            fieldLabels={{ fullName: 'Nome', registrationCode: 'Matrícula', birthDate: 'Nascimento', cpf: 'CPF' }}
          >
            <Field label="Nome completo" htmlFor="new-fullName">
              <Input id="new-fullName" name="fullName" required maxLength={160} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Matrícula" htmlFor="new-registrationCode">
                <Input id="new-registrationCode" name="registrationCode" maxLength={30} />
              </Field>
              <Field label="Data de nascimento" htmlFor="new-birthDate">
                <Input id="new-birthDate" name="birthDate" type="date" />
              </Field>
              <Field label="CPF" htmlFor="new-cpf">
                <Input id="new-cpf" name="cpf" inputMode="numeric" maxLength={14} />
              </Field>
            </div>
          </ActionForm>
        </Card>
      ) : null}
    </>
  )
}
