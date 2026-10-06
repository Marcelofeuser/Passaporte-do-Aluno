import { isISODate, todayISO } from '@/lib/attendance'

export const OCCURRENCE_SEVERITY = {
  MILD: 'Leve',
  MODERATE: 'Moderada',
  SEVERE: 'Grave',
} as const

export type OccurrenceSeverity = keyof typeof OCCURRENCE_SEVERITY

export const OCCURRENCE_STATUS = {
  PENDING: 'Pendente',
  MONITORING: 'Em acompanhamento',
  RESOLVED: 'Resolvida',
} as const

export type OccurrenceStatus = keyof typeof OCCURRENCE_STATUS

export const OCCURRENCE_MEASURES = {
  COORDINATOR_TALK: 'Conversa com a coordenação',
  PARENT_CALL: 'Chamada aos responsáveis',
  INTERNAL_SUSPENSION: 'Suspensão interna',
  PSYCH_REFERRAL: 'Encaminhamento psicológico',
  CLASS_GUIDANCE: 'Orientação em sala',
  OTHER: 'Outra medida',
} as const

export type OccurrenceMeasure = keyof typeof OCCURRENCE_MEASURES

export const DEFAULT_OCCURRENCE_TYPES = [
  { name: 'Advertência verbal', isPositive: false, sortOrder: 10 },
  { name: 'Advertência escrita', isPositive: false, sortOrder: 20 },
  { name: 'Ocorrência positiva / mérito', isPositive: true, sortOrder: 30 },
  { name: 'Indisciplina em sala', isPositive: false, sortOrder: 40 },
  { name: 'Atraso recorrente', isPositive: false, sortOrder: 50 },
  { name: 'Uso indevido de aparelhos', isPositive: false, sortOrder: 60 },
] as const

export function isSeverity(value: unknown): value is OccurrenceSeverity {
  return typeof value === 'string' && value in OCCURRENCE_SEVERITY
}

export function isOccurrenceStatus(value: unknown): value is OccurrenceStatus {
  return typeof value === 'string' && value in OCCURRENCE_STATUS
}

export function isMeasure(value: unknown): value is OccurrenceMeasure {
  return typeof value === 'string' && value in OCCURRENCE_MEASURES
}

export function parseMeasures(formData: FormData): OccurrenceMeasure[] {
  const raw = formData.getAll('measures')
  return [...new Set(raw.filter(isMeasure))]
}

/** Bimestre 1–4 a partir da posição da data no ano letivo. */
export function academicTerm(occurredOn: string, startsOn: string, endsOn: string) {
  const start = Date.parse(`${startsOn}T12:00:00Z`)
  const end = Date.parse(`${endsOn}T12:00:00Z`)
  const cur = Date.parse(`${occurredOn}T12:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(cur)) return 1
  const span = Math.max(end - start, 1)
  return Math.min(4, Math.max(1, Math.floor(((cur - start) / span) * 4) + 1))
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function isTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_RE.test(value)
}

/** Interpreta data + hora no fuso de Brasília. */
export function occurredTimestamp(occurredOn: string, time: string) {
  return new Date(`${occurredOn}T${time}:00-03:00`)
}

export function nowSaoPauloTime() {
  return timeFromDate(new Date())
}

export function timeFromDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(value)
  const hour = parts.find((p) => p.type === 'hour')?.value ?? '08'
  const minute = parts.find((p) => p.type === 'minute')?.value ?? '00'
  return `${hour}:${minute}`
}

export function formatOccurred(occurredOn: string, occurredAt: Date) {
  const time = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(occurredAt)
  const [y, m, d] = occurredOn.slice(0, 10).split('-')
  return `${d}/${m}/${y} ${time}`
}

export function formatBR(iso: string) {
  if (!isISODate(iso)) return iso
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export { isISODate, todayISO }
