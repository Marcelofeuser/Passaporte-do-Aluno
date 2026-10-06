import { and, eq, gte, inArray, isNull, lt, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bookLoan, notification, schoolMembership, student, teacher, user } from '@/lib/db/schema'
import { todayISO } from '@/lib/attendance'
import { getGuardianRecipients } from '@/lib/attendance-queries'
import { addDays, computeFine, formatMoney, loanTiming, timingLabel } from '@/lib/library'
import { getLibraryRules, listActiveLoansDueBy } from '@/lib/library-queries'
import { logger } from '@/lib/logger'

export type LoanBorrower = { borrowerType: string; studentId: string | null; teacherId: string | null }

export function formatBR(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Contas do próprio aluno com vínculo de Aluno ativo nesta escola. */
async function getStudentUsers(schoolId: string, studentIds: string[]) {
  if (studentIds.length === 0) return new Map<string, string[]>()
  const rows = await db
    .selectDistinct({ studentId: student.id, userId: user.id })
    .from(student)
    .innerJoin(user, or(eq(user.id, student.userId), sql`lower(${user.email}) = lower(${student.email})`))
    .innerJoin(
      schoolMembership,
      and(
        eq(schoolMembership.userId, user.id),
        eq(schoolMembership.schoolId, schoolId),
        eq(schoolMembership.role, 'STUDENT'),
        isNull(schoolMembership.deletedAt),
      ),
    )
    .where(and(eq(student.schoolId, schoolId), isNull(student.deletedAt), inArray(student.id, studentIds)))
  const out = new Map<string, string[]>()
  for (const r of rows) out.set(r.studentId, [...(out.get(r.studentId) ?? []), r.userId])
  return out
}

/** Contas do professor com vínculo ativo nesta escola. */
async function getTeacherUsers(schoolId: string, teacherIds: string[]) {
  if (teacherIds.length === 0) return new Map<string, string[]>()
  const rows = await db
    .selectDistinct({ teacherId: teacher.id, userId: user.id })
    .from(teacher)
    .innerJoin(user, or(eq(user.id, teacher.userId), sql`lower(${user.email}) = lower(${teacher.email})`))
    .innerJoin(
      schoolMembership,
      and(eq(schoolMembership.userId, user.id), eq(schoolMembership.schoolId, schoolId), isNull(schoolMembership.deletedAt)),
    )
    .where(and(eq(teacher.schoolId, schoolId), isNull(teacher.deletedAt), inArray(teacher.id, teacherIds)))
  const out = new Map<string, string[]>()
  for (const r of rows) out.set(r.teacherId, [...(out.get(r.teacherId) ?? []), r.userId])
  return out
}

/** Destinatários de avisos por empréstimo: aluno + responsáveis, ou o professor. */
async function resolveRecipients(schoolId: string, loans: LoanBorrower[]) {
  const studentIds = [...new Set(loans.map((l) => l.studentId).filter((v): v is string => Boolean(v)))]
  const teacherIds = [...new Set(loans.map((l) => l.teacherId).filter((v): v is string => Boolean(v)))]
  const [guardians, studentUsers, teacherUsers] = await Promise.all([
    getGuardianRecipients(schoolId, studentIds),
    getStudentUsers(schoolId, studentIds),
    getTeacherUsers(schoolId, teacherIds),
  ])
  return (l: LoanBorrower) => {
    if (l.borrowerType === 'STUDENT' && l.studentId) {
      const ids = new Set([...(guardians.get(l.studentId) ?? []), ...(studentUsers.get(l.studentId) ?? [])])
      return { userIds: [...ids], href: `/family/library?student=${l.studentId}` }
    }
    if (l.teacherId) return { userIds: teacherUsers.get(l.teacherId) ?? [], href: null }
    return { userIds: [] as string[], href: null }
  }
}

/** Aviso interno ao tomador (e responsáveis) sobre um empréstimo. Nunca lança erro. */
export async function notifyBorrower(schoolId: string, loan: LoanBorrower, title: string, body: string) {
  try {
    const recipientsOf = await resolveRecipients(schoolId, [loan])
    const { userIds, href } = recipientsOf(loan)
    if (userIds.length) await db.insert(notification).values(userIds.map((userId) => ({ userId, schoolId, title, body, href })))
  } catch (error) {
    logger.error('library.notify_failed', { error })
  }
}

/**
 * Gera os avisos de devolução próxima e de atraso da escola. Idempotente: cada
 * empréstimo é "reservado" com um UPDATE condicional antes do envio, então
 * execuções concorrentes (cron + acesso às páginas) não duplicam avisos.
 */
export async function dispatchLibraryAlerts(schoolId: string, today = todayISO()) {
  const rules = await getLibraryRules(schoolId)
  const until = addDays(today, rules.dueAlertDays)
  const now = new Date()

  const [dueSoon, overdue] = await Promise.all([
    db
      .update(bookLoan)
      .set({ dueAlertSentAt: now })
      .where(
        and(
          eq(bookLoan.schoolId, schoolId),
          eq(bookLoan.status, 'ACTIVE'),
          isNull(bookLoan.dueAlertSentAt),
          gte(bookLoan.dueOn, today),
          lte(bookLoan.dueOn, until),
        ),
      )
      .returning({ id: bookLoan.id }),
    db
      .update(bookLoan)
      .set({ overdueAlertSentAt: now })
      .where(
        and(
          eq(bookLoan.schoolId, schoolId),
          eq(bookLoan.status, 'ACTIVE'),
          isNull(bookLoan.overdueAlertSentAt),
          lt(bookLoan.dueOn, today),
        ),
      )
      .returning({ id: bookLoan.id }),
  ])
  if (dueSoon.length === 0 && overdue.length === 0) return 0

  const claimedDue = new Set(dueSoon.map((r) => r.id))
  const claimedOverdue = new Set(overdue.map((r) => r.id))
  const loans = (await listActiveLoansDueBy(schoolId, until)).filter((l) => claimedDue.has(l.id) || claimedOverdue.has(l.id))
  const recipientsOf = await resolveRecipients(schoolId, loans)

  const rows = loans.flatMap((l) => {
    const { userIds, href } = recipientsOf(l)
    const timing = loanTiming(l.dueOn, today, rules.dueAlertDays)
    let title: string
    let body: string
    if (claimedOverdue.has(l.id)) {
      const fine = computeFine(timing.days, rules.finePerDay)
      title = `Livro em atraso: ${l.title}`
      body = [
        `${l.borrowerName} · prazo venceu em ${formatBR(l.dueOn)} (${timingLabel(timing)})`,
        rules.finePerDay > 0 ? `multa de ${formatMoney(rules.finePerDay)}/dia (até agora ${formatMoney(fine)})` : null,
        rules.blockOverdue ? 'novos empréstimos ficam bloqueados até a devolução' : null,
      ]
        .filter(Boolean)
        .join(' · ')
    } else {
      title = `Devolução próxima: ${l.title}`
      body = `${l.borrowerName} · devolver até ${formatBR(l.dueOn)} (${timingLabel(timing)})`
    }
    return userIds.map((userId) => ({ userId, schoolId, title, body, href }))
  })
  if (rows.length) await db.insert(notification).values(rows)
  logger.info('library.alerts_dispatched', { schoolId, dueSoon: dueSoon.length, overdue: overdue.length, notifications: rows.length })
  return rows.length
}

/** Versão segura para chamar durante a renderização (via `after`). */
export async function dispatchLibraryAlertsSafe(schoolId: string) {
  try {
    await dispatchLibraryAlerts(schoolId)
  } catch (error) {
    logger.error('library.alerts_failed', { schoolId, error })
  }
}
