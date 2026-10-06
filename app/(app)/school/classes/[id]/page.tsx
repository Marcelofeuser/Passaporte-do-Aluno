import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { addClassSubject, archiveClass, removeClassSubject } from '@/app/actions/academic'
import { endEnrollment } from '@/app/actions/students'
import { ActionForm, ConfirmSubmit } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { can } from '@/lib/rbac'
import { UUID_RE } from '@/lib/school-action'
import { requireSchoolPage } from '@/lib/school-page'
import { getClass, getClassRoster, getClassSubjects, listSubjects, listTeachers } from '@/lib/school-queries'
import { SHIFTS } from '@/lib/validation'

export const metadata: Metadata = { title: 'Turma' }

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!UUID_RE.test(id)) notFound()
  const { schoolId, canManage, role } = await requireSchoolPage('school:view_academic')
  const cls = await getClass(schoolId, id)
  if (!cls) notFound()

  const canSeeStudents = can(role, 'school:view_students')
  const canGrade = can(role, 'school:manage_all_grades')
  const [subjects, roster, allSubjects, teachers] = await Promise.all([
    getClassSubjects(schoolId, id),
    getClassRoster(schoolId, id),
    canManage ? listSubjects(schoolId) : Promise.resolve([]),
    canManage ? listTeachers(schoolId) : Promise.resolve([]),
  ])

  return (
    <>
      <BackLink href={`/school/classes?year=${cls.academicYearId}`}>Turmas de {cls.year}</BackLink>
      <PageTitle
        title={cls.name}
        description={`${cls.grade} · ${SHIFTS[cls.shift as keyof typeof SHIFTS] ?? cls.shift} · ${roster.length}${cls.capacity ? `/${cls.capacity}` : ''} alunos${cls.homeroomTeacher ? ` · Regente: ${cls.homeroomTeacher}` : ''}`}
      />

      <Card>
        <CardHeader title="Disciplinas e professores" />
        {subjects.length === 0 ? (
          <EmptyState title="Grade vazia" description="Adicione as disciplinas desta turma." />
        ) : (
          <ul className="divide-y divide-border">
            {subjects.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex flex-1 flex-col">
                  <span className="font-semibold">{s.subjectName}</span>
                  <span className="text-sm text-muted-foreground">
                    {s.teacherName ?? 'Sem professor'}
                    {s.workloadHours ? ` · ${s.workloadHours} h/ano` : ''}
                  </span>
                </div>
                {canGrade ? (
                  <Link href={`/school/grades/${s.id}`} className="text-sm font-semibold text-primary hover:underline">
                    Diário
                  </Link>
                ) : null}
                {canManage ? (
                  <form action={removeClassSubject}>
                    <input type="hidden" name="classId" value={id} />
                    <input type="hidden" name="classSubjectId" value={s.id} />
                    <ConfirmSubmit confirm={`Remover ${s.subjectName} da turma?`}>Remover</ConfirmSubmit>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {canManage && allSubjects.length > 0 ? (
          <ActionForm action={addClassSubject} submitLabel="Adicionar / atualizar" className="border-t border-border p-4">
            <input type="hidden" name="classId" value={id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Disciplina" htmlFor="cs-subject">
                <Select id="cs-subject" name="subjectId" required>
                  {allSubjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Professor" htmlFor="cs-teacher">
                <Select id="cs-teacher" name="teacherId" defaultValue="">
                  <option value="">A definir</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Carga horária (h/ano)" htmlFor="cs-hours">
                <Input id="cs-hours" name="workloadHours" type="number" min={1} max={2000} inputMode="numeric" />
              </Field>
            </div>
          </ActionForm>
        ) : canManage ? (
          <p className="border-t border-border p-4 text-sm text-muted-foreground">
            <Link href="/school/subjects" className="font-semibold text-primary hover:underline">
              Cadastre disciplinas
            </Link>{' '}
            para montar a grade.
          </p>
        ) : null}
      </Card>

      {canSeeStudents ? (
        <Card>
          <CardHeader title={`Alunos (${roster.length})`} description="Para matricular, abra a ficha do aluno." />
          {roster.length === 0 ? (
            <EmptyState title="Nenhum aluno matriculado" description="Matricule alunos pela ficha de cada um." />
          ) : (
            <ol className="divide-y divide-border">
              {roster.map((r, i) => (
                <li key={r.enrollmentId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-6 text-right font-mono text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                  <Link href={`/school/students/${r.studentId}`} className="flex-1 font-semibold hover:underline">
                    {r.socialName ?? r.fullName}
                  </Link>
                  {r.registrationCode ? <span className="font-mono text-xs text-muted-foreground">{r.registrationCode}</span> : null}
                  {canManage ? (
                    <form action={endEnrollment}>
                      <input type="hidden" name="enrollmentId" value={r.enrollmentId} />
                      <input type="hidden" name="returnTo" value={`/school/classes/${id}`} />
                      <ConfirmSubmit confirm="Retirar aluno da turma?">Retirar</ConfirmSubmit>
                    </form>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
        </Card>
      ) : null}

      {canManage ? (
        <form action={archiveClass} className="flex justify-end">
          <input type="hidden" name="classId" value={id} />
          <ConfirmSubmit confirm="Arquivar esta turma?">Arquivar turma</ConfirmSubmit>
        </form>
      ) : null}
    </>
  )
}
