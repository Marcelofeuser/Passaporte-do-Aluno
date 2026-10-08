import type { Metadata } from 'next'
import Link from 'next/link'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { academicYear } from '@/lib/db/schema'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { requireSchoolPage } from '@/lib/school-page'
import { CsvDownloadButton } from './csv-download-button'

export const metadata: Metadata = { title: 'Relatórios' }

const REPORTS = [
  {
    type: 'roster',
    title: 'Matrículas (roster)',
    description: 'Lista completa de alunos por ano letivo: turma, situação, matrícula e contato.',
  },
  {
    type: 'grades',
    title: 'Notas consolidadas',
    description: 'Médias por turma × disciplina com contagem de aprovados, recuperação e reprovados.',
  },
  {
    type: 'attendance',
    title: 'Assiduidade consolidada',
    description: 'Aulas registradas, faltas, atrasos e frequência por aluno no ano letivo.',
  },
] as const

export default async function SchoolReportsPage() {
  const { schoolId } = await requireSchoolPage('school:view_academic')
  const years = await db
    .select({ id: academicYear.id, year: academicYear.year, isCurrent: academicYear.isCurrent })
    .from(academicYear)
    .where(and(eq(academicYear.schoolId, schoolId), isNull(academicYear.deletedAt)))
    .orderBy(asc(academicYear.year))

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle
        title="Relatórios e exportações"
        description="Dados consolidados da instituição para auditoria, prestação de contas e reuniões."
      />

      {years.length === 0 ? (
        <Card>
          <EmptyState title="Nenhum ano letivo" description="Crie o ano letivo para habilitar os relatórios." />
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {REPORTS.map((r) => (
            <Card key={r.type}>
              <CardHeader title={r.title} description={r.description} />
              <div className="space-y-3 p-4">
                <p className="text-xs font-medium text-muted-foreground">Exportar CSV por ano letivo:</p>
                <div className="flex flex-wrap gap-2">
                  {years.map((y) => (
                    <CsvDownloadButton
                      key={y.id}
                      reportType={r.type}
                      yearId={y.id}
                      yearLabel={String(y.year)}
                      label="CSV"
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  CSV com separador “;” e BOM — abre direto no Excel e Google Sheets. Cada exportação fica registrada na
                  auditoria.
                </p>
                <Link
                  href={`/print/report/${r.type}?yearId=${years[years.length - 1].id}`}
                  className="inline-block rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
                >
                  Versão para impressão (PDF)
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
