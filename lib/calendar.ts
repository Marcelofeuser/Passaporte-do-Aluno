export const CALENDAR_AUDIENCES = {
  ALL: 'Toda a comunidade',
  STAFF: 'Equipe escolar',
  FAMILY: 'Famílias e alunos',
} as const

export type CalendarAudience = keyof typeof CALENDAR_AUDIENCES

export function isCalendarAudience(value: unknown): value is CalendarAudience {
  return typeof value === 'string' && value in CALENDAR_AUDIENCES
}

export function isoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function localDate(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date)
}

export function calendarDate(value: Date | string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(
    typeof value === 'string' ? new Date(value) : value,
  )
}

export function calendarDateTime(value: Date | string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(
    typeof value === 'string' ? new Date(value) : value,
  )
}