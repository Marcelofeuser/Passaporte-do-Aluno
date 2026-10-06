export const ATTENDANCE_STATUS = {
  PRESENT: 'Presente',
  ABSENT: 'Falta',
  LATE: 'Atraso',
  EARLY_LEAVE: 'Saída antecipada',
} as const

export type AttendanceStatus = keyof typeof ATTENDANCE_STATUS

export const ATTENDANCE_SHORT: Record<AttendanceStatus, string> = {
  PRESENT: 'P',
  ABSENT: 'F',
  LATE: 'A',
  EARLY_LEAVE: 'S',
}

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === 'string' && value in ATTENDANCE_STATUS
}

export type AttendanceTotals = {
  /** Aulas registradas (soma do nº de aulas das chamadas). */
  given: number
  /** Aulas com falta. Atraso e saída antecipada contam como presença. */
  absent: number
  late: number
  earlyLeave: number
}

export const EMPTY_TOTALS: AttendanceTotals = { given: 0, absent: 0, late: 0, earlyLeave: 0 }

export function sumTotals(list: AttendanceTotals[]): AttendanceTotals {
  return list.reduce(
    (acc, t) => ({
      given: acc.given + t.given,
      absent: acc.absent + t.absent,
      late: acc.late + t.late,
      earlyLeave: acc.earlyLeave + t.earlyLeave,
    }),
    EMPTY_TOTALS,
  )
}

/** Percentual de presença sobre as aulas já registradas. `null` quando ainda não há aulas. */
export function attendanceRate(t: AttendanceTotals): number | null {
  if (t.given === 0) return null
  return ((t.given - t.absent) / t.given) * 100
}

/** Faltas permitidas no ano pela carga horária (1 aula = 1 hora-aula). */
export function allowedAbsences(workloadHours: number | null | undefined, minAttendance: number) {
  if (!workloadHours) return null
  return Math.floor(workloadHours * (1 - minAttendance / 100))
}

export function formatRate(rate: number | null) {
  if (rate === null) return '—'
  return `${rate.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export type AttendanceAlert = 'BELOW_MIN' | 'NEAR_LIMIT' | 'RECURRING_LATE'

export const ALERT_LABEL: Record<AttendanceAlert, string> = {
  BELOW_MIN: 'Frequência abaixo do mínimo',
  NEAR_LIMIT: 'Perto do limite de faltas',
  RECURRING_LATE: 'Atraso recorrente',
}

/** Alertas de um aluno numa disciplina (ou no total). */
export function alertsFor(
  t: AttendanceTotals,
  opts: { minAttendance: number; lateThreshold: number; allowed?: number | null },
): AttendanceAlert[] {
  const out: AttendanceAlert[] = []
  const rate = attendanceRate(t)
  if (rate !== null && rate < opts.minAttendance) out.push('BELOW_MIN')
  else if (opts.allowed && t.absent >= Math.ceil(opts.allowed * 0.8)) out.push('NEAR_LIMIT')
  if (t.late >= opts.lateThreshold) out.push('RECURRING_LATE')
  return out
}

/** Datas em ISO (YYYY-MM-DD) no fuso de São Paulo. */
export function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const PERIODS = { today: 'Hoje', week: 'Esta semana', month: 'Este mês', year: 'Este ano' } as const
export type Period = keyof typeof PERIODS

export function isPeriod(value: unknown): value is Period {
  return typeof value === 'string' && value in PERIODS
}

/** Intervalo [from, to] do período. Para "ano", o chamador usa o ano letivo. */
export function periodRange(period: Period, today = todayISO()): { from: string; to: string } {
  if (period === 'today') return { from: today, to: today }
  if (period === 'week') {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay()
    const offset = weekday === 0 ? 6 : weekday - 1
    return { from: shift(today, -offset), to: today }
  }
  if (period === 'month') return { from: `${today.slice(0, 7)}-01`, to: today }
  return { from: `${today.slice(0, 4)}-01-01`, to: today }
}

export function isISODate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}
