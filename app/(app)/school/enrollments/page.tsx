import type { Metadata } from 'next'
import Link from 'next/link'
import { db } from '@/lib/db'
import { academicYear, schoolClass, schoolEnrollment, student } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { BackLink } from '@/components/school/form-fields'
import { formatDate, requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Gestão de Matrículas' }

interface PageProps {
  searchParams: Promise<{ schoolId?: string }>
}

export default async function SchoolEnrollmentsPage({ searchParams }: PageProps) {
  const { schoolId: defaultSchoolId } = await requireSchoolPage('school:view_students')
  const params = await searchParams
  const schoolId = params.schoolId || defaultSchoolId

  const enrollments = schoolId
    ? await db
        .select({
          id: schoolEnrollment.id,
          status: schoolEnrollment.status,
          enrollmentType: schoolEnrollment.enrollmentType,
          contractAccepted: schoolEnrollment.contractAccepted,
          financialCleared: schoolEnrollment.financialCleared,
          documentsCleared: schoolEnrollment.documentsCleared,
          createdAt: schoolEnrollment.createdAt,
          studentName: student.fullName,
          studentId: student.id,
          className: schoolClass.name,
          year: academicYear.year,
        })
        .from(schoolEnrollment)
        .leftJoin(student, eq(schoolEnrollment.studentId, student.id))
        .leftJoin(schoolClass, eq(schoolEnrollment.classId, schoolClass.id))
        .leftJoin(academicYear, eq(schoolEnrollment.academicYearId, academicYear.id))
        .where(eq(schoolEnrollment.schoolId, schoolId))
        .orderBy(desc(schoolEnrollment.createdAt))
    : []

  const pendingCount = enrollments.filter((e) => e.status === 'pending').length
  const activeCount = enrollments.filter((e) => e.status === 'active').length

  return (
    <div className="space-y-6">
      <BackLink href="/school">Escola</BackLink>

      <PageTitle
        title="Gestão de Matrículas"
        description="Acompanhe ingressos, rematrículas, contratos, pendências financeiras e documentais."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader title="Total de Matrículas" description="Registros no sistema" />
          <div className="p-4 pt-2">
            <span className="font-mono text-3xl font-bold tabular-nums">{enrollments.length}</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Pendentes" description="Aguardando validação" />
          <div className="p-4 pt-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-amber-600">{pendingCount}</span>
          </div>
        </Card>

        <Card>
          <CardHeader title="Ativas" description="Matrículas confirmadas" />
          <div className="p-4 pt-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-emerald-600">{activeCount}</span>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Alunos Matriculados e Solicitantes"
          description={`${enrollments.length} ${enrollments.length === 1 ? 'registro encontrado' : 'registros encontrados'}`}
        />
        {enrollments.length === 0 ? (
          <EmptyState
            title="Nenhuma matrícula registrada"
            description="As solicitações de ingresso ou rematrícula aparecerão aqui."
          />
        ) : (
          <ul className="divide-y divide-border">
            {enrollments.map((item) => (
              <li key={item.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {item.studentId ? (
                      <Link
                        href={`/school/students/${item.studentId}`}
                        className="font-bold hover:underline focus-visible:outline-2 focus-visible:outline-ring"
                      >
                        {item.studentName || 'Aluno sem nome'}
                      </Link>
                    ) : (
                      <span className="font-bold">{item.studentName || 'Aluno não identificado'}</span>
                    )}
                    {item.className ? (
                      <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                        {item.className}
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="capitalize">Tipo: {item.enrollmentType}</span>
                    <span>•</span>
                    <span>Criado em: {formatDate(item.createdAt)}</span>
                    {item.contractAccepted ? (
                      <>
                        <span>•</span>
                        <span className="text-emerald-600">Contrato assinado</span>
                      </>
                    ) : (
                      <>
                        <span>•</span>
                        <span className="text-amber-600">Contrato pendente</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                      item.status === 'active'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : item.status === 'pending'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {item.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}