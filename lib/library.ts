/* Regras e rótulos da biblioteca (sem acesso a banco). */

export const COPY_CONDITIONS = {
  NEW: 'Novo',
  GOOD: 'Bom',
  FAIR: 'Regular',
  POOR: 'Desgastado',
  DAMAGED: 'Danificado',
} as const
export type CopyCondition = keyof typeof COPY_CONDITIONS

export const COPY_STATUS = {
  AVAILABLE: 'Disponível',
  LOANED: 'Emprestado',
  MAINTENANCE: 'Em manutenção',
  LOST: 'Extraviado',
  WITHDRAWN: 'Baixado do acervo',
} as const
export type CopyStatus = keyof typeof COPY_STATUS

/** Situações que a equipe pode definir manualmente (LOANED só via empréstimo). */
export const MANUAL_COPY_STATUS = ['AVAILABLE', 'MAINTENANCE', 'LOST', 'WITHDRAWN'] as const

export const LOAN_STATUS = {
  ACTIVE: 'Em andamento',
  RETURNED: 'Devolvido',
  LOST: 'Extraviado',
  CANCELLED: 'Anulado',
} as const
export type LoanStatus = keyof typeof LOAN_STATUS

export const FINE_STATUS = {
  NONE: 'Sem pendência',
  PENDING: 'Multa pendente',
  PAID: 'Multa quitada',
  WAIVED: 'Multa dispensada',
} as const
export type FineStatus = keyof typeof FINE_STATUS

export const LOAN_EVENTS = {
  CREATED: 'Empréstimo registrado',
  RENEWED: 'Prazo renovado',
  RETURNED: 'Devolução registrada',
  LOST: 'Extravio registrado',
  CANCELLED: 'Empréstimo anulado',
  FINE_PAID: 'Multa quitada',
  FINE_WAIVED: 'Multa dispensada',
} as const
export type LoanEventKind = keyof typeof LOAN_EVENTS

export const BORROWER_TYPES = { STUDENT: 'Aluno', TEACHER: 'Professor' } as const
export type BorrowerType = keyof typeof BORROWER_TYPES

export const LOAN_FILTERS = {
  active: 'Em andamento',
  overdue: 'Em atraso',
  fines: 'Multas pendentes',
  closed: 'Encerrados',
  all: 'Todos',
} as const
export type LoanFilter = keyof typeof LOAN_FILTERS

export function isLoanFilter(value: unknown): value is LoanFilter {
  return typeof value === 'string' && value in LOAN_FILTERS
}

export const MIN_REASON = 5

export type LibraryRules = {
  loanDays: number
  maxRenewals: number
  maxLoans: number
  finePerDay: number
  blockOverdue: boolean
  dueAlertDays: number
}

export const DEFAULT_RULES: LibraryRules = {
  loanDays: 14,
  maxRenewals: 2,
  maxLoans: 3,
  finePerDay: 0,
  blockOverdue: true,
  dueAlertDays: 2,
}

export function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Dias corridos de `from` até `to` (negativo se `to` for anterior). */
export function daysBetween(from: string, to: string) {
  const a = Date.parse(`${from}T12:00:00Z`)
  const b = Date.parse(`${to}T12:00:00Z`)
  return Math.round((b - a) / 86_400_000)
}

export type LoanTiming = { kind: 'OVERDUE' | 'DUE_TODAY' | 'DUE_SOON' | 'OK'; days: number }

/** Situação do prazo de um empréstimo ativo. `days` = dias restantes (ou de atraso, se OVERDUE). */
export function loanTiming(dueOn: string, today: string, alertDays: number): LoanTiming {
  const left = daysBetween(today, dueOn)
  if (left < 0) return { kind: 'OVERDUE', days: -left }
  if (left === 0) return { kind: 'DUE_TODAY', days: 0 }
  if (left <= alertDays) return { kind: 'DUE_SOON', days: left }
  return { kind: 'OK', days: left }
}

export function timingLabel(t: LoanTiming) {
  if (t.kind === 'OVERDUE') return `${t.days} ${t.days === 1 ? 'dia' : 'dias'} de atraso`
  if (t.kind === 'DUE_TODAY') return 'Devolver hoje'
  return `${t.days} ${t.days === 1 ? 'dia restante' : 'dias restantes'}`
}

export function timingTone(t: LoanTiming) {
  if (t.kind === 'OVERDUE') return 'bg-destructive/10 text-destructive'
  if (t.kind === 'DUE_TODAY' || t.kind === 'DUE_SOON') return 'bg-accent text-accent-foreground'
  return 'bg-secondary text-secondary-foreground'
}

/** Multa por atraso, arredondada em centavos. */
export function computeFine(lateDays: number, finePerDay: number) {
  if (lateDays <= 0 || finePerDay <= 0) return 0
  return Math.round(lateDays * finePerDay * 100) / 100
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
export function formatMoney(value: number) {
  return money.format(value)
}

/** Normaliza ISBN (somente dígitos e X final). Retorna `undefined` se inválido. */
export function normalizeIsbn(raw: string | null | undefined): string | null | undefined {
  if (!raw) return null
  const v = raw.replace(/[\s-]/g, '').toUpperCase()
  if (/^\d{13}$/.test(v) || /^\d{9}[\dX]$/.test(v)) return v
  return undefined
}

/** Valor do campo "tomador" no formulário: `STUDENT:<uuid>` ou `TEACHER:<uuid>`. */
export function parseBorrower(raw: unknown): { type: BorrowerType; id: string } | null {
  if (typeof raw !== 'string') return null
  const m = /^(STUDENT|TEACHER):([0-9a-f-]{36})$/i.exec(raw)
  if (!m) return null
  return { type: m[1].toUpperCase() as BorrowerType, id: m[2].toLowerCase() }
}
