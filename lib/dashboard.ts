import { and, eq, gte, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  academicYear,
  attendanceRecord,
  attendanceSession,
  bookCopy,
  bookLoan,
  enrollment,
  occurrence,
  school,
  schoolClass,
} from '@/lib/db/schema'
import { attendanceRate, EMPTY_TOTALS, type AttendanceTotals } from '@/lib/attendance'
import { buildPedagogyReport, type StudentInsight } from '@/lib/ai/pedagogy'

/* Dashboard Executivo (Fase 13). Consolidação real dos indicadores do tenant —
   nenhum número fixo: tudo calculado sobre notas, chamadas, ocorrências e biblioteca. */

export type DashboardMetrics = {
  schoolName: string
  passingGrade: number
  minAttendance: number
  /** Ano letivo vigente (null = escola sem ano configurado). */
  year: number | null
  students: number
  teachers: number
  classes: number
  /** Frequência consolidada do ANO (aulas registradas vs faltas). */
  attendanceYear: { pct: number | null; totals: AttendanceTotals }
  /** Frequência de HOJE (chamadas lançadas hoje). */
  attendanceToday: { pct: number | null; sessions: number }
  /** Média geral consolidada (média das médias por aluno, herdada do motor da Fase 12). */
  generalAverage: number | null
  /** Distribuição de situação consolidada por aluno (para o gráfico de barras). */
  statusCounts: { approved: number; recovery: number; failed: number; pending: number }
  risk: { high: number; medium: number; low: number; students: StudentInsight[] }
  occurrences: { total30d: number; severe30d: number }
  library: { activeLoans: number; overdue: number; availableCopies: number }
}

export async function getSchoolDashboardMetrics(schoolId: string): Promise<DashboardMetrics | null> {
  const [schoolRow] = await db
    .select({ name: school.name, passingGrade: school.passingGrade, minAttendance: school.minAttendance })
    .from(school)
    .where(eq(school.id, schoolId))
    .limit(1)
  if (!schoolRow) return null

  const [year] = await db
    .select({ id: academicYear.id, year: academicYear.year })
    .from(academicYear)
    .where(and(eq(academicYear.schoolId, schoolId), eq(academicYear.isCurrent, true), isNull(academicYear.deletedAt)))
    .limit(1)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayISO = today.toISOString().slice(0, 10)

  // ---- Contagens estruturais (alunos ativos do ano, professores, turmas) ----
  const [counts] = year
    ? await db
        .select({
          students: sql<number>`(select count(*)::int from ${enrollment} where ${enrollment.academicYearId} = ${year.id} and ${enrollment.status} = 'ACTIVE')`,
          classes: sql<number>`(select count(*)::int from ${schoolClass} where ${schoolClass.academicYearId} = ${year.id} and ${schoolClass.deletedAt} is null)`,
          teachers: sql<number>`(select count(distinct ${schoolClass.homeroomTeacherId})::int from ${schoolClass} where ${schoolClass.academicYearId} = ${year.id} and ${schoolClass.homeroomTeacherId} is not null)`,
        })
        .from(school)
        .where(eq(school.id, schoolId))
    : [{ students: 0, classes: 0, teachers: 0 }]

  // ---- Frequência do ano + de hoje (chamadas) ----
  const classIds = year
    ? (await db.select({ id: schoolClass.id }).from(schoolClass).where(eq(schoolClass.academicYearId, year.id))).map((r) => r.id)
    : []
  const attWhere = classIds.length
    ? and(eq(attendanceRecord.schoolId, schoolId), inArray(attendanceSession.classId, classIds))
    : undefined
  const [yearAtt] = attWhere
    ? await db
        .select({
          given: sql<number>`coalesce(sum(${attendanceSession.lessons}) filter (where ${attendanceSession.heldOn} <= ${todayISO}), 0)::int`,
          absent: sql<number>`coalesce(sum(${attendanceSession.lessons}) filter (where ${attendanceRecord.status} = 'ABSENT' and ${attendanceSession.heldOn} <= ${todayISO}), 0)::int`,
        })
        .from(attendanceRecord)
        .innerJoin(attendanceSession, eq(attendanceSession.id, attendanceRecord.sessionId))
        .where(attWhere)
    : [{ given: 0, absent: 0 }]
  const [todayAtt] = attWhere
    ? await db
        .select({
          given: sql<number>`coalesce(sum(${attendanceSession.lessons}), 0)::int`,
          absent: sql<number>`coalesce(sum(${attendanceSession.lessons}) filter (where ${attendanceRecord.status} = 'ABSENT'), 0)::int`,
          sessions: sql<number>`count(distinct ${attendanceSession.id})::int`,
        })
        .from(attendanceRecord)
        .innerJoin(attendanceSession, eq(attendanceSession.id, attendanceRecord.sessionId))
        .where(and(attWhere, gte(attendanceSession.heldOn, todayISO)))
    : [{ given: 0, absent: 0, sessions: 0 }]

  const totalsYear: AttendanceTotals = { ...EMPTY_TOTALS, given: yearAtt?.given ?? 0, absent: yearAtt?.absent ?? 0 }

  // ---- Média geral + distribuição de situação (motor da Fase 12) ----
  const report = year ? await buildPedagogyReport(schoolId) : null
  const finals = (report?.students ?? []).map((s) => s.overallFinal).filter((v): v is number => v !== null)
  const generalAverage = finals.length ? Math.round((finals.reduce((a, v) => a + v, 0) / finals.length) * 10) / 10 : null
  const statusCounts = { approved: 0, recovery: 0, failed: 0, pending: 0 }
  for (const s of report?.students ?? []) {
    if (s.overallFinal === null) statusCounts.pending += 1
    else if (s.failingSubjects.length > 0) statusCounts.failed += 1
    else if (s.recoverySubjects.length > 0) statusCounts.recovery += 1
    else statusCounts.approved += 1
  }

  // ---- Ocorrências (30 dias) ----
  const since = new Date(Date.now() - 30 * 86_400_000)
  const [occ30] = await db
    .select({
      total: sql<number>`count(*)::int`,
      severe: sql<number>`count(*) filter (where ${occurrence.severity} in ('SEVERE','CRITICAL'))::int`,
    })
    .from(occurrence)
    .where(and(eq(occurrence.schoolId, schoolId), isNull(occurrence.deletedAt), gte(occurrence.occurredAt, since)))

  // ---- Biblioteca ----
  const [lib] = await db
    .select({
      activeLoans: sql<number>`count(*) filter (where ${bookLoan.returnedOn} is null and ${bookLoan.status} = 'ACTIVE')::int`,
      overdue: sql<number>`count(*) filter (where ${bookLoan.returnedOn} is null and ${bookLoan.dueOn} < ${todayISO})::int`,
    })
    .from(bookLoan)
    .where(eq(bookLoan.schoolId, schoolId))
  const [copies] = await db
    .select({ available: sql<number>`count(*) filter (where ${bookCopy.status} = 'AVAILABLE')::int` })
    .from(bookCopy)
    .where(and(eq(bookCopy.schoolId, schoolId), isNull(bookCopy.deletedAt)))

  return {
    schoolName: schoolRow.name,
    passingGrade: schoolRow.passingGrade,
    minAttendance: schoolRow.minAttendance,
    year: year?.year ?? null,
    students: counts?.students ?? 0,
    teachers: counts?.teachers ?? 0,
    classes: counts?.classes ?? 0,
    attendanceYear: { pct: attendanceRate(totalsYear), totals: totalsYear },
    attendanceToday: {
      pct: todayAtt?.given ? Math.round(((todayAtt.given - todayAtt.absent) / todayAtt.given) * 1000) / 10 : null,
      sessions: todayAtt?.sessions ?? 0,
    },
    generalAverage,
    statusCounts,
    risk: {
      high: report?.students.filter((s) => s.risk === 'HIGH').length ?? 0,
      medium: report?.students.filter((s) => s.risk === 'MEDIUM').length ?? 0,
      low: report?.students.filter((s) => s.risk === 'LOW').length ?? 0,
      students: (report?.students ?? []).filter((s) => s.risk !== 'LOW').slice(0, 8),
    },
    occurrences: { total30d: occ30?.total ?? 0, severe30d: occ30?.severe ?? 0 },
    library: { activeLoans: lib?.activeLoans ?? 0, overdue: lib?.overdue ?? 0, availableCopies: copies?.available ?? 0 },
  }
}

/** Atalhos derivados dos dados (ações críticas que merecem atenção agora). */
export function criticalActions(m: DashboardMetrics): { href: string; label: string; hint: string }[] {
  const out = [{ href: '/school/grades', label: 'Lançar notas', hint: 'Diário e avaliações' }]
  if (m.risk.high > 0) out.push({ href: '/school/ai', label: 'Conselho de classe', hint: `${m.risk.high} aluno(s) em risco crítico` })
  if (m.attendanceToday.sessions === 0) out.push({ href: '/school/attendance', label: 'Registrar chamada de hoje', hint: 'Nenhuma chamada lançada hoje' })
  if (m.library.overdue > 0) out.push({ href: '/school/library', label: 'Devoluções atrasadas', hint: `${m.library.overdue} empréstimo(s) vencido(s)` })
  return out
}
