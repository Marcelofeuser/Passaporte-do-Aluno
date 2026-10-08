import type { Metadata } from 'next'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { buildPedagogyReport } from '@/lib/ai/pedagogy'
import { interventionsFor, RISK_LABEL } from '@/lib/ai/insights'
import { formatScore } from '@/lib/grades'
import { formatRate } from '@/lib/attendance'
import { requireSchoolPage } from '@/lib/school-page'
import { ClassSummaryButton } from './class-summary-button'

export const metadata: Metadata = { title: 'Assistente Pedagógico' }

const RISK_TONE: Record<string, string> = {
  HIGH: 'bg-destructive/10 text-destructive',
  MEDIUM: 'bg-accent text-accent-foreground',
  LOW: 'bg-primary/10 text-primary',
}

export default async function SchoolAiPage() {
  const { schoolId } = await requireSchoolPage('school:view_academic')
  const report = await buildPedagogyReport(schoolId)

  if (!report) {
    return (
      <>
        <BackLink href="/school">Escola</BackLink>
        <PageTitle title="Assistente Pedagógico" />
        <Card>
          <EmptyState title="Escola não encontrada" description="Verifique seu vínculo ativo com a escola." />
        </Card>
      </>
    )
  }

  const atRisk = report.students.filter((s) => s.risk !== 'LOW')

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle
        title="Assistente Pedagógico"
        description="Análise automática de notas, faltas e risco — baseada nos dados reais do ano letivo vigente."
      />

      <Card title="Resumo por turma" description={`Média geral da turma, alunos em risco e resumo para reunião de pais. Gerado em ${new Date(report.generatedAt).toLocaleString('pt-BR')}.`}>
        {report.classes.length === 0 ? (
          <EmptyState title="Nenhuma turma no ano vigente" description="Crie turmas no ano letivo atual para analisar." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {report.classes.map((c) => (
              <li key={c.classId} className="px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {c.grade} · {c.className} <span className="text-xs text-muted-foreground">({c.students} alunos)</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Média {formatScore(c.average)} · {c.atRisk} em risco · {c.failing} com reprovação
                    </p>
                  </div>
                  <ClassSummaryButton classId={c.classId} className={c.className} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Alunos em risco"
          description={`Critérios: reprovação, recuperação, frequência < ${report.minAttendance}% ou queda de notas entre bimestres.`}
        />
        {atRisk.length === 0 ? (
          <EmptyState title="Nenhum alerta" description="Todas as turmas estão sem risco no momento." />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {atRisk
              .sort((a, b) => (a.risk === 'HIGH' ? -1 : b.risk === 'HIGH' ? 1 : 0))
              .map((s) => (
                <li key={s.studentId} className="px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {s.socialName || s.studentName}
                        {s.className ? <span className="text-xs text-muted-foreground"> · {s.className}</span> : null}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.overallFinal !== null ? `Média ${formatScore(s.overallFinal)} · ` : ''}
                        {formatRate(s.attendancePct)} de frequência · {s.absences} faltas
                      </p>
                      {s.reasons.length > 0 ? <p className="mt-1 text-xs text-muted-foreground">{s.reasons.join(' · ')}</p> : null}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${RISK_TONE[s.risk] ?? ''}`}>
                      {RISK_LABEL[s.risk]}
                    </span>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs font-semibold text-primary">Sugestões de intervenção</summary>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
                      {interventionsFor(s, report.minAttendance).map((tip, i) => (
                        <li key={i}>{tip}</li>
                      ))}
                    </ul>
                  </details>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <p className="text-xs text-muted-foreground">
        Análise gerada sobre os dados reais do sistema (notas, chamadas e matrículas) — nada é inventado. A narração
        assistida por IA generativa é opcional e pode ser ativada pela administração (variáveis AI_API_URL/AI_API_KEY).
      </p>
    </>
  )
}
