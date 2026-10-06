import type { Metadata } from 'next'
import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { submitQuickAttendanceAction } from '@/app/actions/attendance'
import { BackLink } from '@/components/school/form-fields'
import { Card, EmptyState, PageTitle } from '@/components/ui/card'
import { db } from '@/lib/db'
import { enrollment, schoolClass, student, studentAttendance } from '@/lib/db/schema'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { todayISO } from '@/lib/attendance'

export const metadata: Metadata = { title: 'Frequência e Chamada Diária' }

interface PageProps {
  searchParams: Promise<{
    schoolId?: string
    classId?: string
    date?: string
  }>
}

const STATUS_LABELS: Record<string, { label: string; badgeClass: string }> = {
  present: {
    label: 'Presente',
    badgeClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  },
  absent: {
    label: 'Falta',
    badgeClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300',
  },
  justified: {
    label: 'Justificada',
    badgeClass: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
  },
  late: {
    label: 'Atraso',
    badgeClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  },
}

export default async function AttendanceManagementPage({ searchParams }: PageProps) {
  const { schoolId: defaultSchoolId } = await requireSchoolPage('school:manage_attendance')
  const params = await searchParams
  const schoolId = params.schoolId || defaultSchoolId
  const selectedClassId = params.classId || ''
  const selectedDate = params.date || ''

  // Busca as turmas da escola para o filtro e lançamento
  const classes = await db
    .select({
      id: schoolClass.id,
      name: schoolClass.name,
      shift: schoolClass.shift,
    })
    .from(schoolClass)
    .where(eq(schoolClass.schoolId, schoolId))
    .orderBy(schoolClass.name)

  // Filtros aplicados na listagem de registros
  const conditions = [eq(studentAttendance.schoolId, schoolId)]
  if (selectedClassId) {
    conditions.push(eq(studentAttendance.classId, selectedClassId))
  }
  if (selectedDate) {
    conditions.push(eq(studentAttendance.date, selectedDate))
  }

  // Registros de frequência recentes
  const records = await db
    .select({
      id: studentAttendance.id,
      date: studentAttendance.date,
      status: studentAttendance.status,
      notes: studentAttendance.notes,
      createdAt: studentAttendance.createdAt,
      studentId: studentAttendance.studentId,
      studentName: student.fullName,
      className: schoolClass.name,
    })
    .from(studentAttendance)
    .leftJoin(student, eq(studentAttendance.studentId, student.id))
    .leftJoin(schoolClass, eq(studentAttendance.classId, schoolClass.id))
    .where(and(...conditions))
    .orderBy(desc(studentAttendance.date), desc(studentAttendance.createdAt))
    .limit(100)

  // Alunos disponíveis para lançamento rápido (caso uma turma esteja selecionada ou todos)
  const availableStudents = selectedClassId
    ? await db
        .select({
          id: student.id,
          name: student.fullName,
        })
        .from(enrollment)
        .innerJoin(student, eq(enrollment.studentId, student.id))
        .where(
          and(
            eq(enrollment.schoolId, schoolId),
            eq(enrollment.classId, selectedClassId),
            eq(enrollment.status, 'ACTIVE'),
          ),
        )
        .orderBy(student.fullName)
    : await db
        .select({
          id: student.id,
          name: student.fullName,
        })
        .from(student)
        .where(eq(student.schoolId, schoolId))
        .orderBy(student.fullName)
        .limit(50)

  // Cálculos estatísticos
  const totalRecords = records.length
  const presentCount = records.filter((r) => r.status === 'present').length
  const absentCount = records.filter((r) => r.status === 'absent').length
  const justifiedCount = records.filter((r) => r.status === 'justified').length
  const lateCount = records.filter((r) => r.status === 'late').length
  const attendanceRate =
    totalRecords > 0 ? Math.round(((presentCount + lateCount) / totalRecords) * 100) : 100

  return (
    <div className="space-y-6">
      <BackLink href="/school">Escola</BackLink>

      <PageTitle
        title="Frequência e Chamada Diária"
        description="Painel de controle de assiduidade escolar, faltas, justificativas e lançamento de chamadas."
      />

      {/* 1. Resumo Estatístico em Cartões com a propriedade title */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card title="Total de Registros" description="No período filtrado">
          <div className="p-4 pt-2">
            <span className="font-mono text-3xl font-bold tabular-nums">{totalRecords}</span>
          </div>
        </Card>

        <Card title="Taxa de Assiduidade" description="Presenças e atrasos">
          <div className="p-4 pt-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-emerald-600">
              {attendanceRate}%
            </span>
          </div>
        </Card>

        <Card title="Faltas Registradas" description="Ausências não justificadas">
          <div className="p-4 pt-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-rose-600">
              {absentCount}
            </span>
          </div>
        </Card>

        <Card title="Justificadas e Atrasos" description="Atestados e pontualidade">
          <div className="p-4 pt-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-amber-600">
              {justifiedCount + lateCount}
            </span>
          </div>
        </Card>
      </div>

      {/* 2. Filtros de Busca */}
      <form
        method="GET"
        className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4 shadow-xs"
      >
        {params.schoolId ? <input type="hidden" name="schoolId" value={params.schoolId} /> : null}

        <div className="flex flex-1 min-w-48 flex-col gap-1.5">
          <label htmlFor="classId" className="text-sm font-semibold">
            Turma
          </label>
          <select
            id="classId"
            name="classId"
            defaultValue={selectedClassId}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
          >
            <option value="">Todas as turmas</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} {c.shift ? `(${c.shift})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="flex min-w-40 flex-col gap-1.5">
          <label htmlFor="date" className="text-sm font-semibold">
            Data da Chamada
          </label>
          <input
            id="date"
            name="date"
            type="date"
            defaultValue={selectedDate}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            className="h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Filtrar
          </button>
          {selectedClassId || selectedDate ? (
            <Link
              href="/school/attendance"
              className="flex h-10 items-center rounded-lg border border-border px-4 text-sm font-semibold hover:bg-muted"
            >
              Limpar
            </Link>
          ) : null}
        </div>
      </form>

      {/* 3. Lançamento Rápido de Chamada */}
      <Card title="Lançamento Rápido de Presença" description="Registre ou altere a frequência diária de um aluno">
        <form action={submitQuickAttendanceAction} className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <input type="hidden" name="schoolId" value={schoolId} />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="formStudentId" className="text-sm font-semibold">
              Aluno *
            </label>
            <select
              id="formStudentId"
              name="studentId"
              required
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Selecione o aluno...</option>
              {availableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="formClassId" className="text-sm font-semibold">
              Turma (opcional)
            </label>
            <select
              id="formClassId"
              name="classId"
              defaultValue={selectedClassId}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="">Sem turma específica</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="formDate" className="text-sm font-semibold">
              Data *
            </label>
            <input
              id="formDate"
              name="date"
              type="date"
              required
              defaultValue={selectedDate || todayISO()}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="formStatus" className="text-sm font-semibold">
              Situação *
            </label>
            <select
              id="formStatus"
              name="status"
              required
              defaultValue="present"
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-medium"
            >
              <option value="present">Presente</option>
              <option value="absent">Falta</option>
              <option value="justified">Falta Justificada</option>
              <option value="late">Atraso</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 flex flex-col gap-1.5">
            <label htmlFor="formNotes" className="text-sm font-semibold">
              Observação / Justificativa (opcional)
            </label>
            <input
              id="formNotes"
              name="notes"
              type="text"
              placeholder="Ex: Apresentou atestado médico / Consulta odontológica"
              maxLength={255}
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>

          <div className="flex items-end sm:col-span-2 lg:col-span-1">
            <button
              type="submit"
              className="h-10 w-full rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Salvar Registro
            </button>
          </div>
        </form>
      </Card>

      {/* 4. Listagem dos Registros Recentes */}
      <Card
        title="Registros Recentes de Frequência"
        description={`${records.length} ${records.length === 1 ? 'registro encontrado' : 'registros encontrados'}`}
      >
        {records.length === 0 ? (
          <EmptyState
            title="Nenhum registro de frequência"
            description="Utilize o formulário acima para registrar presenças ou altere os filtros de busca."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Aluno</th>
                  <th className="px-4 py-3">Turma</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Observação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {records.map((item) => {
                  const statusInfo = STATUS_LABELS[item.status] ?? {
                    label: item.status,
                    badgeClass: 'bg-muted text-muted-foreground',
                  }
                  return (
                    <tr key={item.id} className="hover:bg-muted/40 transition-colors">
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {formatDate(item.date)}
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        {item.studentId ? (
                          <Link
                            href={`/school/students/${item.studentId}`}
                            className="hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                          >
                            {item.studentName || 'Aluno sem nome'}
                          </Link>
                        ) : (
                          item.studentName || 'Aluno não identificado'
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.className || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${statusInfo.badgeClass}`}
                        >
                          {statusInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {item.notes || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
