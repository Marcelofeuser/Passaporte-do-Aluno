import { and, asc, eq, gte, inArray, isNull, lte, ne, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { appointment, appointmentSlot, calendarEvent, calendarEventType, schoolDay, teacher } from '@/lib/db/schema'
import type { Role } from '@/lib/rbac'

export async function listCalendarTypes(schoolId: string) {
  return db.select().from(calendarEventType).where(and(eq(calendarEventType.schoolId, schoolId), isNull(calendarEventType.deletedAt))).orderBy(asc(calendarEventType.name))
}

export async function listCalendarEvents(schoolId: string, role: Role, from: Date, to: Date) {
  const audiences = role === 'PARENT' || role === 'STUDENT' ? ['ALL', 'FAMILY'] : ['ALL', 'FAMILY', 'STAFF']
  return db
    .select({ id: calendarEvent.id, title: calendarEvent.title, description: calendarEvent.description, startsAt: calendarEvent.startsAt, endsAt: calendarEvent.endsAt, location: calendarEvent.location, isSchoolDay: calendarEvent.isSchoolDay, typeName: calendarEventType.name, color: calendarEventType.color })
    .from(calendarEvent)
    .innerJoin(calendarEventType, and(eq(calendarEventType.id, calendarEvent.typeId), eq(calendarEventType.schoolId, schoolId)))
    .where(and(eq(calendarEvent.schoolId, schoolId), isNull(calendarEvent.deletedAt), gte(calendarEvent.startsAt, from), lte(calendarEvent.startsAt, to), inArray(calendarEventType.audience, audiences)))
    .orderBy(asc(calendarEvent.startsAt))
}

export async function listSchoolDays(schoolId: string, from: string, to: string) {
  return db.select().from(schoolDay).where(and(eq(schoolDay.schoolId, schoolId), gte(schoolDay.day, from), lte(schoolDay.day, to))).orderBy(asc(schoolDay.day))
}

export async function listAppointmentSlots(schoolId: string, from: Date, role: Role, userId?: string) {
  const slots = await db
    .select({ id: appointmentSlot.id, startsAt: appointmentSlot.startsAt, endsAt: appointmentSlot.endsAt, capacity: appointmentSlot.capacity, location: appointmentSlot.location, notes: appointmentSlot.notes, teacherName: teacher.fullName, booked: sql<number>`count(${appointment.id})::int` })
    .from(appointmentSlot)
    .leftJoin(teacher, and(eq(teacher.id, appointmentSlot.teacherId), eq(teacher.schoolId, schoolId)))
    .leftJoin(appointment, and(eq(appointment.slotId, appointmentSlot.id), eq(appointment.status, 'BOOKED')))
    .where(and(eq(appointmentSlot.schoolId, schoolId), isNull(appointmentSlot.deletedAt), gte(appointmentSlot.startsAt, from)))
    .groupBy(appointmentSlot.id, teacher.fullName)
    .orderBy(asc(appointmentSlot.startsAt))
  if (role === 'PARENT' || role === 'STUDENT') return slots
  return slots
}

export async function listFamilyAppointments(schoolId: string, userId: string, studentIds: string[]) {
  if (!studentIds.length) return []
  return db.select({ id: appointment.id, startsAt: appointmentSlot.startsAt, endsAt: appointmentSlot.endsAt, location: appointmentSlot.location, teacherName: teacher.fullName, studentId: appointment.studentId, status: appointment.status })
    .from(appointment)
    .innerJoin(appointmentSlot, and(eq(appointmentSlot.id, appointment.slotId), eq(appointmentSlot.schoolId, schoolId)))
    .leftJoin(teacher, and(eq(teacher.id, appointmentSlot.teacherId), eq(teacher.schoolId, schoolId)))
    .where(and(eq(appointment.schoolId, schoolId), eq(appointment.bookedBy, userId), inArray(appointment.studentId, studentIds), ne(appointment.status, 'CANCELLED')))
    .orderBy(asc(appointmentSlot.startsAt))
}