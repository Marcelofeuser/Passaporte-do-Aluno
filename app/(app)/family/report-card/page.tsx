import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { allowedAbsences, formatRate } from '@/lib/attendance'
import { getFamilyStudents, getCurrentEnrollments } from '@/lib/attendance-queries'
import { getReportCard } from '@/lib/report-card'
import { requireSchoolPage } from '@/lib/school-page'
import { formatScore, GRADE_STATUS_LABEL } from '@/lib/grades'

export const metadata: Metadata = { title: 'Boletim' }

const STATUS_TONE: Record<string, string> = {
  APPROVED: 'bg-primary/10 text-primary',
  RECOVERY: 'bg-accent text-accent-foreground',
  FAILED: 'bg-destructive/10 text-destructive',
  PENDING: 'bg-muted text-muted-foreground',
}

export default async function FamilyReportCardPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const sp = await searchParams
  const isStudent = role === 'STUDENT'
  const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)

  if (students.length === 0) {
    return (
      <>
        <PageTitle title="Boletim" />
        <Card>
          <EmptyState
            title="Nenhum aluno vinculado"
            description="Peça à secretaria para vincular seus filhos usando o mesmo e-mail da sua conta."
          />
        </Card>
      </>
    )
  }

  const selected = students.find((s) => s.id === sp.student) ?? students[0]
  const [enr] = await getCurrentEnrollments(schoolId, [selected.id])
  const card = enr?.classId ? await getReportCard(schoolId, selected.id, enr.classId) : null

  return (
    <>
      <PageTitle title="Boletim" description="Notas, frequência e situação por disciplina no ano letivo." />

      {students.length > 1 ? (
        <nav aria-label="Escolher aluno" className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/family/report-card?student=${s.id}`}
              aria-current={s.id === selected.id ? 'page' : undefined}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {s.socialName || s.fullName}
            </Link>
          ))}
        </nav>
      ) : null}

      {!card || card.rows.length === 0 ? (
        <Card>
          <EmptyState
            title={card ? 'Sem disciplinas no momento' : 'Sem matrícula ativa'}
            description="O boletim aparece aqui assim que a secretaria lançar avaliações e notas."
          />
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader
              title={`${card.socialName || card.studentName} · ${card.classGrade ?? ''} ${card.className ?? ''}`.trim()}
              description={`Ano ${card.year ?? '—'} · Média para aprovação: ${formatScore(card.passingGrade)} · Frequência mínima: ${card.minAttendance}%`}
            />
            <div className="flex flex-wrap items-center gap-2 px-4 pb-4 text-sm">
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[card.overall.status] ?? ''}`}>
                {GRADE_STATUS_LABEL[card.overall.status]}
              </span>
              <span className="text-muted-foreground">
                Média geral: <strong className="text-foreground">{formatScore(card.overall.final)}</strong>
              </span>
              <span className="text-muted-foreground">
                Frequência: <strong className="text-foreground">{formatRate(card.attendance.given ? ((card.attendance.given - card.attendance.absent) / card.attendance.given) * 100 : null)}</strong>
              </span>
              <Link
                href={`/print/report-card/${selected.id}`}
                target="_blank"
                className="ml-auto rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
              >
                Imprimir / PDF
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader title="Notas por disciplina" description="Média ponderada das avaliações; recuperação substitui a média quando maior." />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th scope="col" className="px-4 py-2 font-semibold">Disciplina</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Média</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Recup.</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Final</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Faltas</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Frequência</th>
                    <th scope="col" className="px-4 py-2 text-right font-semibold">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {card.rows.map((row) => {
                    const rate = row.attendance.given ? ((row.attendance.given - row.attendance.absent) / row.attendance.given) * 100 : null
                    const allowed = allowedAbsences(row.workloadHours, card.minAttendance)
                    return (
                      <tr key={row.subjectId} className="border-b border-border last:border-0">
                        <td className="px-4 py-2.5">
                          <p className="font-medium">{row.subjectName}</p>
                          {row.teacherName ? <p className="text-xs text-muted-foreground">{row.teacherName}</p> : null}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatScore(row.result.average)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatScore(row.result.recovery)}</td>
                        <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{formatScore(row.result.final)}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {row.attendance.absent}
                          {allowed !== null ? <span className="text-xs text-muted-foreground"> / {allowed}</span> : null}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{formatRate(rate)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${STATUS_TONE[row.result.status] ?? ''}`}>
                            {GRADE_STATUS_LABEL[row.result.status]}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </>
  )
}
