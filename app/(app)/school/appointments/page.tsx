import type { Metadata } from 'next'
import { createAppointmentSlot } from '@/app/actions/calendar'
import { ActionForm } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { calendarDateTime } from '@/lib/calendar'
import { listAppointmentSlots } from '@/lib/calendar-queries'
import { db } from '@/lib/db'
import { school, teacher } from '@/lib/db/schema'
import { requireSchoolPage } from '@/lib/school-page'
import { and, asc, eq, isNull } from 'drizzle-orm'

export const metadata: Metadata = { title: 'Atendimentos' }

export default async function SchoolAppointmentsPage() {
  const { schoolId, role } = await requireSchoolPage('school:manage_appointments')
  const [slots, teachers] = await Promise.all([
    listAppointmentSlots(schoolId, new Date(), role),
    db.select({ id: teacher.id, name: teacher.fullName }).from(teacher).innerJoin(school, eq(school.id, teacher.schoolId)).where(and(eq(teacher.schoolId, schoolId), isNull(teacher.deletedAt))).orderBy(asc(teacher.fullName)),
  ])
  return <>
    <BackLink href="/school">Escola</BackLink><PageTitle title="Atendimentos" description="Abra horários para reuniões com famílias e acompanhe a ocupação." />
    <Card><CardHeader title="Disponibilizar horário" /><ActionForm action={createAppointmentSlot} submitLabel="Abrir horário" className="p-4">
      <Field label="Professor ou coordenação" htmlFor="teacherId"><Select id="teacherId" name="teacherId" defaultValue=""><option value="">Coordenação</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
      <div className="grid gap-4 sm:grid-cols-3"><Field label="Início" htmlFor="startsAt"><Input id="startsAt" name="startsAt" type="datetime-local" required /></Field><Field label="Fim" htmlFor="endsAt"><Input id="endsAt" name="endsAt" type="datetime-local" required /></Field><Field label="Vagas" htmlFor="capacity"><Input id="capacity" name="capacity" type="number" min={1} max={20} defaultValue={1} required /></Field></div>
      <Field label="Local" htmlFor="location"><Input id="location" name="location" maxLength={120} /></Field>
    </ActionForm></Card>
    <Card><CardHeader title="Horários abertos" />{slots.length ? <ul className="divide-y divide-border">{slots.map((slot) => <li key={slot.id} className="flex flex-wrap justify-between gap-2 p-4"><div><strong>{calendarDateTime(slot.startsAt)}</strong><p className="text-sm text-muted-foreground">{slot.teacherName ?? 'Coordenação'}{slot.location ? ` · ${slot.location}` : ''}</p></div><span className="text-sm font-semibold">{slot.booked}/{slot.capacity} vagas</span></li>)}</ul> : <EmptyState title="Nenhum horário aberto" description="Crie um horário para que ele apareça no portal das famílias." />}</Card>
  </>
}