import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFamilyStudents, getCurrentEnrollments } from '@/lib/attendance-queries'
import { getReportCard } from '@/lib/report-card'
import { requirePageContext } from '@/lib/session'
import { formatScore, GRADE_STATUS_LABEL } from '@/lib/grades'
import { formatRate } from '@/lib/attendance'

export const metadata: Metadata = { title: 'Boletim para impressão' }

/**
 * Rota de impressão (Ctrl+P / Salvar como PDF) do boletim do aluno.
 * Sem chrome do app (layout raiz); acesso validado: família vinculada ou equipe da escola.
 */
export default async function ReportCardPrintPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params
  const ctx = await requirePageContext()
  const schoolId = ctx.active?.schoolId
  if (!schoolId) notFound()

  const role = ctx.active?.role
  if (!role) notFound()

  const isFamily = role === 'PARENT' || role === 'STUDENT'
  if (isFamily) {
    const students = await getFamilyStudents(schoolId, role, ctx.user.id, ctx.user.email)
    if (!students.some((s) => s.id === studentId)) notFound()
  }

  const [enr] = await getCurrentEnrollments(schoolId, [studentId])
  const card = enr?.classId ? await getReportCard(schoolId, studentId, enr.classId) : null
  if (!card) notFound()

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <header className="border-b border-black/20 pb-4">
        <h1 className="text-xl font-bold uppercase">{card.schoolName}</h1>
        <p className="text-sm">Boletim Escolar — Ano letivo {card.year ?? '—'}</p>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-1 text-sm">
        <p>
          <strong>Aluno:</strong> {card.studentName}
        </p>
        <p>
          <strong>Matrícula:</strong> {card.registrationCode ?? '—'}
        </p>
        <p>
          <strong>Turma:</strong> {card.className ?? '—'} ({card.classGrade ?? '—'})
        </p>
        <p>
          <strong>Média p/ aprovação:</strong> {formatScore(card.passingGrade)} · <strong>Frequência mín.:</strong> {card.minAttendance}%
        </p>
      </section>

      <table className="mt-6 w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-black/30 text-left">
            <th className="py-1.5 pr-2 font-bold">Disciplina</th>
            <th className="px-2 py-1.5 text-right font-bold">Média</th>
            <th className="px-2 py-1.5 text-right font-bold">Recup.</th>
            <th className="px-2 py-1.5 text-right font-bold">Final</th>
            <th className="px-2 py-1.5 text-right font-bold">Faltas</th>
            <th className="px-2 py-1.5 text-right font-bold">Freq.</th>
            <th className="px-2 py-1.5 text-right font-bold">Situação</th>
          </tr>
        </thead>
        <tbody>
          {card.rows.map((row) => {
            const rate = row.attendance.given ? ((row.attendance.given - row.attendance.absent) / row.attendance.given) * 100 : null
            return (
              <tr key={row.subjectId} className="border-b border-black/10">
                <td className="py-1.5 pr-2">{row.subjectName}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatScore(row.result.average)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatScore(row.result.recovery)}</td>
                <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{formatScore(row.result.final)}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{row.attendance.absent}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">{formatRate(rate)}</td>
                <td className="px-2 py-1.5 text-right">{GRADE_STATUS_LABEL[row.result.status]}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-black/30 font-bold">
            <td className="py-1.5 pr-2">Geral</td>
            <td className="px-2 py-1.5" />
            <td className="px-2 py-1.5" />
            <td className="px-2 py-1.5 text-right tabular-nums">{formatScore(card.overall.final)}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{card.attendance.absent}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">
              {formatRate(card.attendance.given ? ((card.attendance.given - card.attendance.absent) / card.attendance.given) * 100 : null)}
            </td>
            <td className="px-2 py-1.5 text-right">{GRADE_STATUS_LABEL[card.overall.status]}</td>
          </tr>
        </tfoot>
      </table>

      <footer className="mt-10 text-[10px] text-black/60">
        Documento gerado pelo Passaporte do Aluno em {new Date().toLocaleDateString('pt-BR')} — conferência de notas e
        frequência. Não substitui o histórico escolar oficial assinado pela secretaria.
      </footer>
    </div>
  )
}
