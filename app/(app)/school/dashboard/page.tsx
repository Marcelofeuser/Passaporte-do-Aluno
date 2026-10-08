import type { Metadata } from 'next'
import Link from 'next/link'
import { BackLink } from '@/components/school/form-fields'
import { Card, EmptyState, PageTitle } from '@/components/ui/card'
import { criticalActions, getSchoolDashboardMetrics } from '@/lib/dashboard'
import { formatScore } from '@/lib/grades'
import { formatRate } from '@/lib/attendance'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Dashboard Executivo' }

export default async function SchoolDashboardPage() {
  const { schoolId } = await requireSchoolPage('school:view_academic')
  const m = await getSchoolDashboardMetrics(schoolId)

  if (!m) {
    return (
      <>
        <BackLink href="/school">Escola</BackLink>
        <PageTitle title="Dashboard Executivo" />
        <Card>
          <EmptyState title="Escola não encontrada" description="Verifique seu vínculo ativo com a escola." />
        </Card>
      </>
    )
  }

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle
        title="Dashboard Executivo"
        description={`Visão geral em tempo real dos indicadores${m.year ? ` do ano letivo ${m.year}` : ''}.`}
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Alunos ativos" value={String(m.students)} hint={`${m.classes} turmas · ${m.teachers} professores`} />
        <KpiCard
          label="Frequência do ano"
          value={formatRate(m.attendanceYear.pct)}
          hint={`Mínimo exigido: ${m.minAttendance}%`}
          tone={m.attendanceYear.pct !== null && m.attendanceYear.pct < m.minAttendance ? 'warn' : 'ok'}
        />
        <KpiCard
          label="Frequência de hoje"
          value={m.attendanceToday.sessions ? formatRate(m.attendanceToday.pct) : '—'}
          hint={m.attendanceToday.sessions ? `${m.attendanceToday.sessions} chamada(s) lançada(s) hoje` : 'Nenhuma chamada hoje'}
          tone={m.attendanceToday.sessions === 0 ? 'warn' : 'ok'}
        />
        <KpiCard
          label="Média geral"
          value={formatScore(m.generalAverage)}
          hint={`Média para aprovação: ${formatScore(m.passingGrade)}`}
          tone={m.generalAverage !== null && m.generalAverage >= m.passingGrade ? 'ok' : 'warn'}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Desempenho acadêmico" description="Situação consolidada dos alunos (por média final do ano).">
          <div className="space-y-3 p-4">
            <Bar label="Aprovados" value={m.statusCounts.approved} total={m.students} tone="bg-primary" />
            <Bar label="Em recuperação" value={m.statusCounts.recovery} total={m.students} tone="bg-accent" />
            <Bar label="Com reprovação" value={m.statusCounts.failed} total={m.students} tone="bg-destructive" />
            <Bar label="Sem notas lançadas" value={m.statusCounts.pending} total={m.students} tone="bg-muted-foreground/40" />
          </div>
        </Card>

        <Card title="Risco pedagógico" description="Herdado do Assistente Pedagógico (Fase 12).">
          <div className="flex gap-4 px-4 pt-1 text-sm">
            <span className="rounded-full bg-destructive/10 px-3 py-1 font-bold text-destructive">{m.risk.high} críticos</span>
            <span className="rounded-full bg-accent px-3 py-1 font-bold text-accent-foreground">{m.risk.medium} em atenção</span>
            <span className="rounded-full bg-primary/10 px-3 py-1 font-bold text-primary">{m.risk.low} sem risco</span>
          </div>
          {m.risk.students.length > 0 ? (
            <ul className="mt-3 divide-y divide-border border-t border-border">
              {m.risk.students.map((s) => (
                <li key={s.studentId} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
                  <span className="truncate font-medium">{s.socialName || s.studentName}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {s.className ?? ''} · {s.reasons[0] ?? ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">Nenhum aluno em risco no momento.</p>
          )}
        </Card>

        <Card title="Alertas operacionais" description="Últimos 30 dias.">
          <div className="space-y-2 p-4 text-sm">
            <p>
              Ocorrências registradas: <strong>{m.occurrences.total30d}</strong>
              {m.occurrences.severe30d > 0 ? (
                <span className="text-destructive"> · {m.occurrences.severe30d} graves</span>
              ) : null}
            </p>
            <p>
              Biblioteca: <strong>{m.library.activeLoans}</strong> empréstimos ativos
              {m.library.overdue > 0 ? (
                <span className="text-destructive"> · {m.library.overdue} atrasados</span>
              ) : (
                ' · nenhum atraso'
              )}
            </p>
            <p className="text-xs text-muted-foreground">Exemplares disponíveis no acervo: {m.library.availableCopies}</p>
          </div>
        </Card>

        <Card title="Ações críticas agora" description="Baseadas nos indicadores acima.">
          <div className="flex flex-wrap gap-2 p-4">
            {criticalActions(m).map((a) => (
              <Link
                key={a.href + a.label}
                href={a.href}
                className="rounded-lg border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-muted"
              >
                {a.label}
                <span className="block text-[10px] font-normal text-muted-foreground">{a.hint}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </>
  )
}

function KpiCard({ label, value, hint, tone = 'ok' }: { label: string; value: string; hint: string; tone?: 'ok' | 'warn' }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === 'warn' ? 'text-accent-foreground' : ''}`}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function Bar({ label, value, total, tone }: { label: string; value: number; total: number; tone: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {value} ({pct}%)
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
