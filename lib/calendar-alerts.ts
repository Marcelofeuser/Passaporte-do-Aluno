import { and, eq, gte, inArray, isNull, lt } from 'drizzle-orm'
import { db } from '@/lib/db'
import { calendarEvent, calendarEventType, notification, school, schoolMembership } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

export async function dispatchCalendarAlerts(today = new Date()) {
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const rows = await db.select({ id: calendarEvent.id, schoolId: calendarEvent.schoolId, title: calendarEvent.title, startsAt: calendarEvent.startsAt, audience: calendarEventType.audience })
    .from(calendarEvent)
    .innerJoin(calendarEventType, eq(calendarEventType.id, calendarEvent.typeId))
    .innerJoin(school, and(eq(school.id, calendarEvent.schoolId), isNull(school.deletedAt)))
    .where(and(isNull(calendarEvent.deletedAt), isNull(calendarEvent.alertSentAt), gte(calendarEvent.startsAt, tomorrow), lt(calendarEvent.startsAt, new Date(tomorrow.getTime() + 86_400_000))))
  let count = 0
  for (const event of rows) {
    const recipients = await db.selectDistinct({ userId: schoolMembership.userId }).from(schoolMembership).where(and(eq(schoolMembership.schoolId, event.schoolId), isNull(schoolMembership.deletedAt), event.audience === 'ALL' ? inArray(schoolMembership.role, ['SCHOOL_ADMIN', 'COORDINATOR', 'TEACHER', 'LIBRARIAN', 'PARENT', 'STUDENT']) : event.audience === 'STAFF' ? inArray(schoolMembership.role, ['SCHOOL_ADMIN', 'COORDINATOR', 'TEACHER', 'LIBRARIAN']) : inArray(schoolMembership.role, ['PARENT', 'STUDENT'])))
    if (!recipients.length) continue
    const [claimed] = await db.update(calendarEvent).set({ alertSentAt: new Date() }).where(and(eq(calendarEvent.id, event.id), isNull(calendarEvent.alertSentAt))).returning({ id: calendarEvent.id })
    if (!claimed) continue
    try {
      await db.insert(notification).values(recipients.map((recipient) => ({ userId: recipient.userId, schoolId: event.schoolId, title: `Amanhã: ${event.title}`, body: event.startsAt.toLocaleString('pt-BR'), href: '/family/agenda' })))
      count += recipients.length
    } catch (error) {
      await db.update(calendarEvent).set({ alertSentAt: null }).where(eq(calendarEvent.id, event.id))
      throw error
    }
    logger.info('calendar.alert_dispatched', { eventId: event.id, recipients: recipients.length })
  }
  return count
}