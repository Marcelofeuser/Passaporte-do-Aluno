'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { academicYear } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { runAction, requireSchoolAction, UUID_RE } from '@/lib/school-action'
import { getAttendanceConsolidatedReport, getGradesConsolidatedReport, getStudentRosterReport, toCsv } from '@/lib/reports'
import { ENROLLMENT_STATUS } from '@/lib/validation'
import type { ActionState } from '@/lib/validation'

export const REPORT_TYPES = ['roster', 'grades', 'attendance'] as const
export type ReportType = (typeof REPORT_TYPES)[number]

export function isReportType(v: unknown): v is ReportType {
  return typeof v === 'string' && (REPORT_TYPES as readonly string[]).includes(v)
}

export const REPORT_LABELS: Record<ReportType, string> = {
  roster: 'Matrículas (roster)',
  grades: 'Notas consolidadas',
  attendance: 'Assiduidade',
}

export type ReportExportState = ActionState & { csv?: string; filename?: string }

/** Gera o CSV do relatório (retornado na resposta para download pelo client). Auditado. */
export async function exportReportCsv(_prev: ReportExportState, formData: FormData): Promise<ReportExportState> {
  return runAction('report.export_csv', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:view_academic')
    const reportType = String(formData.get('reportType') ?? '')
    const yearId = String(formData.get('yearId') ?? '')
    if (!isReportType(reportType)) return { ok: false, message: 'Tipo de relatório inválido.' }
    if (!UUID_RE.test(yearId)) return { ok: false, message: 'Ano letivo inválido.' }

    const [year] = await db
      .select({ year: academicYear.year })
      .from(academicYear)
      .where(and(eq(academicYear.schoolId, schoolId), eq(academicYear.id, yearId), isNull(academicYear.deletedAt)))
      .limit(1)
    if (!year) return { ok: false, message: 'Ano letivo não encontrado.' }

    let csv: string
    let filename: string
    if (reportType === 'roster') {
      const rows = await getStudentRosterReport(schoolId, yearId)
      csv = toCsv(
        ['Aluno', 'Nome social', 'Matrícula', 'E-mail', 'Turma', 'Ano escolar', 'Situação', 'Matriculado em'],
        rows.map((r) => [
          r.studentName,
          r.socialName,
          r.registrationCode,
          r.email,
          r.className ?? '—',
          r.classGrade ?? '—',
          ENROLLMENT_STATUS[r.status as keyof typeof ENROLLMENT_STATUS] ?? r.status,
          r.enrolledOn,
        ]),
      )
      filename = `matriculas-${year.year}.csv`
    } else if (reportType === 'grades') {
      const rows = await getGradesConsolidatedReport(schoolId, yearId)
      csv = toCsv(
        ['Turma', 'Disciplina', 'Professor', 'Alunos', 'Com nota', 'Média', 'Aprovados', 'Recuperação', 'Reprovados'],
        rows.map((r) => [r.className, r.subjectName, r.teacherName ?? '—', r.students, r.scored, r.average ?? '—', r.approved, r.recovery, r.failed]),
      )
      filename = `notas-consolidadas-${year.year}.csv`
    } else {
      const rows = await getAttendanceConsolidatedReport(schoolId, yearId)
      csv = toCsv(
        ['Turma', 'Aluno', 'Aulas', 'Faltas', 'Atrasos', 'Frequência %'],
        rows.map((r) => [r.className, r.studentName, r.given, r.absent, r.late, r.pct ?? '—']),
      )
      filename = `assiduidade-${year.year}.csv`
    }

    await recordAudit({
      action: 'report.exported_csv',
      entityType: 'report',
      entityId: reportType,
      schoolId,
      actorUserId: userId,
      metadata: { reportType, yearId, rows: csv.split('\n').length - 1 },
    })
    return { ok: true, message: `Relatório gerado (${filename}).`, csv, filename }
  })
}
