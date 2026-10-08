import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { academicYear, school } from '@/lib/db/schema'
import { getAttendanceConsolidatedReport, getGradesConsolidatedReport, getStudentRosterReport } from '@/lib/reports'
import { requirePageContext } from '@/lib/session'
import { can } from '@/lib/rbac'
import { formatScore } from '@/lib/grades'

export const metadata: Metadata = { title: 'Relatório para impressão' }

const TITLES: Record<string, string> = {
  roster: 'Relatório de Matrículas',
  grades: 'Relatório de Notas Consolidadas',
  attendance: 'Relatório de Assiduidade',
}

/** Impressão/PDF dos relatórios administrativos (equipe com school:view_academic). */
export default async function ReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ report: string }>
  searchParams: Promise<{ yearId?: string }>
}) {
  const { report } = await params
  const sp = await searchParams
  const ctx = await requirePageContext()
  const schoolId = ctx.active?.schoolId
  const role = ctx.active?.role
  if (!schoolId || !role || !can(role, 'school:view_academic')) notFound()
  if (!(report in TITLES)) notFound()

  const yearId = sp.yearId
  if (!yearId) notFound()
  const [yearRow] = await db
    .select({ year: academicYear.year })
    .from(academicYear)
    .where(and(eq(academicYear.schoolId, schoolId), eq(academicYear.id, yearId), isNull(academicYear.deletedAt)))
    .limit(1)
  if (!yearRow) notFound()
  const [schoolRow] = await db.select({ name: school.name }).from(school).where(eq(school.id, schoolId)).limit(1)

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-black print:p-0">
      <header className="border-b border-black/30 pb-4">
        <h1 className="text-lg font-bold uppercase">{schoolRow?.name}</h1>
        <p className="text-sm">
          {TITLES[report]} — Ano letivo {yearRow.year}
        </p>
        <p className="text-[10px] text-black/60">
          Emitido em {new Date().toLocaleString('pt-BR')} por usuário autenticado da secretaria.
        </p>
      </header>
      <div className="mt-6">{await ReportTable(report, schoolId, yearId)}</div>
    </div>
  )
}

async function ReportTable(report: string, schoolId: string, yearId: string) {
  if (report === 'roster') {
    const rows = await getStudentRosterReport(schoolId, yearId)
    return (
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-black/30 text-left">
            <th className="py-1.5 pr-2 font-bold">Aluno</th>
            <th className="px-2 py-1.5 font-bold">Matrícula</th>
            <th className="px-2 py-1.5 font-bold">Turma</th>
            <th className="px-2 py-1.5 font-bold">Situação</th>
            <th className="px-2 py-1.5 font-bold">Matriculado em</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-black/10">
              <td className="py-1.5 pr-2">{r.socialName || r.studentName}</td>
              <td className="px-2 py-1.5">{r.registrationCode ?? '—'}</td>
              <td className="px-2 py-1.5">{r.className ?? '—'}</td>
              <td className="px-2 py-1.5">{r.status}</td>
              <td className="px-2 py-1.5">{r.enrolledOn}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (report === 'grades') {
    const rows = await getGradesConsolidatedReport(schoolId, yearId)
    return (
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-y border-black/30 text-left">
            <th className="py-1.5 pr-2 font-bold">Turma</th>
            <th className="px-2 py-1.5 font-bold">Disciplina</th>
            <th className="px-2 py-1.5 text-right font-bold">Alunos</th>
            <th className="px-2 py-1.5 text-right font-bold">Média</th>
            <th className="px-2 py-1.5 text-right font-bold">Aprov.</th>
            <th className="px-2 py-1.5 text-right font-bold">Recup.</th>
            <th className="px-2 py-1.5 text-right font-bold">Reprov.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-black/10">
              <td className="py-1.5 pr-2">{r.className}</td>
              <td className="px-2 py-1.5">{r.subjectName}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.students}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{formatScore(r.average)}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.approved}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.recovery}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{r.failed}</td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const rows = await getAttendanceConsolidatedReport(schoolId, yearId)
  return (
    <table className="w-full border-collapse text-xs">
      <thead>
        <tr className="border-y border-black/30 text-left">
          <th className="py-1.5 pr-2 font-bold">Turma</th>
          <th className="px-2 py-1.5 font-bold">Aluno</th>
          <th className="px-2 py-1.5 text-right font-bold">Aulas</th>
          <th className="px-2 py-1.5 text-right font-bold">Faltas</th>
          <th className="px-2 py-1.5 text-right font-bold">Atrasos</th>
          <th className="px-2 py-1.5 text-right font-bold">Frequência</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-black/10">
            <td className="py-1.5 pr-2">{r.className}</td>
            <td className="px-2 py-1.5">{r.studentName}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{r.given}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{r.absent}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{r.late}</td>
            <td className="px-2 py-1.5 text-right tabular-nums">{r.pct !== null ? `${r.pct}%` : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
