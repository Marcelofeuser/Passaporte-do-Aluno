'use server'

import { and, eq, isNull, sql } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { appointment, appointmentSlot, calendarEvent, calendarEventType, schoolDay } from '@/lib/db/schema'
import { isCalendarAudience, isoDate } from '@/lib/calendar'
import { requireSchoolAction, runAction, UUID_RE } from '@/lib/school-action'
import type { ActionState } from '@/lib/validation'

function value(formData: FormData, key: string, max = 500) {
  return String(formData.get(key) ?? '').trim().slice(0, max)
}

function refresh() {
  revalidatePath('/school/calendar')
  revalidatePath('/school/appointments')
  revalidatePath('/family/agenda')
  revalidatePath('/family/appointments')
}

export async function createCalendarType(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('calendar.type_create_failed', async () => {
    const { schoolId } = await requireSchoolAction('school:manage_calendar')
    const name = value(formData, 'name', 80)
    const audience = value(formData, 'audience')
    if (!name || !isCalendarAudience(audience)) return { ok: false, message: 'Informe o nome e a visibilidade do tipo.' }
    await db.insert(calendarEventType).values({ schoolId, name, audience })
    refresh()
    return { ok: true, message: 'Tipo de evento criado.' }
  })
}

export async function createCalendarEvent(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('calendar.event_create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_calendar')
    const typeId = value(formData, 'typeId')
    const title = value(formData, 'title', 160)
    const startsAt = value(formData, 'startsAt', 40)
    if (!UUID_RE.test(typeId) || !title || Number.isNaN(Date.parse(startsAt))) return { ok: false, message: 'Preencha o tipo, título e data do evento.' }
    await db.insert(calendarEvent).values({ schoolId, typeId, title, startsAt: new Date(startsAt), description: value(formData, 'description') || null, location: value(formData, 'location', 120) || null, createdBy: userId })
    refresh()
    return { ok: true, message: 'Evento criado.' }
  })
}

export async function setSchoolDay(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('calendar.day_update_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_calendar')
    const day = value(formData, 'day', 10)
    const isSchoolDay = value(formData, 'isSchoolDay') === 'true'
    if (!isoDate(day)) return { ok: false, message: 'Data inválida.' }
    await db.insert(schoolDay).values({ schoolId, day, isSchoolDay, reason: value(formData, 'reason', 200) || null, createdBy: userId }).onConflictDoUpdate({ target: [schoolDay.schoolId, schoolDay.day], set: { isSchoolDay, reason: value(formData, 'reason', 200) || null, updatedAt: new Date() } })
    refresh()
    return { ok: true, message: 'Dia letivo atualizado.' }
  })
}

export async function createAppointmentSlot(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('appointment.slot_create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_appointments')
    const startsAt = value(formData, 'startsAt', 40)
    const endsAt = value(formData, 'endsAt', 40)
    const capacity = Number(value(formData, 'capacity') || 1)
    if (Number.isNaN(Date.parse(startsAt)) || Number.isNaN(Date.parse(endsAt)) || capacity < 1) return { ok: false, message: 'Informe datas válidas e capacidade positiva.' }
    const teacherId = value(formData, 'teacherId')
    await db.insert(appointmentSlot).values({ schoolId, teacherId: UUID_RE.test(teacherId) ? teacherId : null, startsAt: new Date(startsAt), endsAt: new Date(endsAt), capacity, location: value(formData, 'location', 120) || null, createdBy: userId })
    refresh()
    return { ok: true, message: 'Horário disponibilizado.' }
  })
}

export async function bookAppointment(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('appointment.book_failed', async () => {
    const { schoolId, userId, ctx } = await requireSchoolAction('family:book_appointments')
    const slotId = value(formData, 'slotId')
    const studentId = value(formData, 'studentId')
    if (!UUID_RE.test(slotId) || !UUID_RE.test(studentId)) return { ok: false, message: 'Horário ou aluno inválido.' }
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${schoolId}:${slotId}`}, 0))`)
      const [slot] = await tx.select({ capacity: appointmentSlot.capacity }).from(appointmentSlot).where(and(eq(appointmentSlot.id, slotId), eq(appointmentSlot.schoolId, schoolId), isNull(appointmentSlot.deletedAt)))
      if (!slot) return 'missing'
      const [booked] = await tx.select({ n: sql<number>`count(*)::int` }).from(appointment).where(and(eq(appointment.slotId, slotId), eq(appointment.status, 'BOOKED')))
      if ((booked?.n ?? 0) >= slot.capacity) return 'full'
      await tx.insert(appointment).values({ schoolId, slotId, studentId, bookedBy: ctx.user.id })
      return 'ok'
    })
    if (result !== 'ok') return { ok: false, message: result === 'full' ? 'Este horário já está lotado.' : 'Horário não encontrado.' }
    refresh()
    return { ok: true, message: 'Atendimento agendado.' }
  })
}

export async function cancelAppointment(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('appointment.cancel_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('family:book_appointments')
    const id = value(formData, 'appointmentId')
    if (!UUID_RE.test(id)) return { ok: false, message: 'Agendamento inválido.' }
    await db.update(appointment).set({ status: 'CANCELLED', updatedAt: new Date() }).where(and(eq(appointment.id, id), eq(appointment.schoolId, schoolId), eq(appointment.bookedBy, userId), eq(appointment.status, 'BOOKED')))
    refresh()
    return { ok: true, message: 'Atendimento cancelado.' }
  })
}