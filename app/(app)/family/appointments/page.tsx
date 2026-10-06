import type { Metadata } from 'next'
import { bookAppointment, cancelAppointment } from '@/app/actions/calendar'
import { ActionForm } from '@/components/school/action-form'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { calendarDateTime } from '@/lib/calendar'
import { listAppointmentSlots, listFamilyAppointments } from '@/lib/calendar-queries'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Agendamentos' }

export default async function FamilyAppointmentsPage() {
  const { ctx, schoolId } = await requireSchoolPage('family:book_appointments')
  const role = ctx.active.role
  const students = await getFamilyStudents(schoolId, role === 'STUDENT' ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)
  const [slots, appointments] = await Promise.all([listAppointmentSlots(schoolId, new Date(), role), listFamilyAppointments(schoolId, ctx.user.id, students.map((student) => student.id))])
  return <><PageTitle title="Atendimentos" description="Escolha um horário disponível para conversar com a escola." />
    <Card><CardHeader title="Meus agendamentos" />{appointments.length ? <ul className="divide-y divide-border">{appointments.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><span><strong>{calendarDateTime(item.startsAt)}</strong><span className="block text-sm text-muted-foreground">{item.teacherName ?? 'Coordenação'} · {students.find((student) => student.id === item.studentId)?.fullName}</span></span><ActionForm action={cancelAppointment} submitLabel="Cancelar" className="p-0"><input type="hidden" name="appointmentId" value={item.id} /></ActionForm></li>)}</ul> : <EmptyState title="Nenhum agendamento" description="Seus horários marcados aparecerão aqui." />}</Card>
    <Card><CardHeader title="Horários disponíveis" />{slots.length && students.length ? <ul className="divide-y divide-border">{slots.filter((slot) => slot.booked < slot.capacity).map((slot) => <li key={slot.id} className="p-4"><div className="mb-3"><strong>{calendarDateTime(slot.startsAt)}</strong><p className="text-sm text-muted-foreground">{slot.teacherName ?? 'Coordenação'}{slot.location ? ` · ${slot.location}` : ''} · {slot.capacity - slot.booked} vaga(s)</p></div><ActionForm action={bookAppointment} submitLabel="Agendar" className="sm:flex-row sm:items-end"><input type="hidden" name="slotId" value={slot.id} /><label className="flex flex-1 flex-col gap-1.5 text-sm font-semibold" htmlFor={`student-${slot.id}`}>Aluno<select id={`student-${slot.id}`} name="studentId" required className="h-11 rounded-lg border border-input bg-card px-3 text-base font-normal">{students.map((student) => <option key={student.id} value={student.id}>{student.socialName || student.fullName}</option>)}</select></label></ActionForm></li>)}</ul> : <EmptyState title="Nenhum horário disponível" description="A escola ainda não abriu horários para agendamento." />}</Card>
  </>
}