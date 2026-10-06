import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { calendarDateTime } from '@/lib/calendar'
import { listCalendarEvents } from '@/lib/calendar-queries'
import { requireSchoolPage } from '@/lib/school-page'
import { buttonClasses } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Agenda' }

export default async function FamilyAgendaPage() {
  const { schoolId, role } = await requireSchoolPage('family:view')
  const events = await listCalendarEvents(schoolId, role, new Date(), new Date(Date.now() + 120 * 86_400_000))
  return <><div className="flex flex-wrap items-end justify-between gap-3"><PageTitle title="Agenda escolar" description="Eventos e comunicados da escola para sua família." /><Link href="/family/appointments" className={buttonClasses('outline', 'sm')}>Agendamentos</Link></div><Card><CardHeader title="Próximos eventos" />{events.length ? <ul className="divide-y divide-border">{events.map((event) => <li key={event.id} className="p-4"><strong>{event.title}</strong><p className="text-sm text-muted-foreground">{event.typeName} · {calendarDateTime(event.startsAt)}{event.location ? ` · ${event.location}` : ''}</p>{event.description ? <p className="mt-1 text-sm">{event.description}</p> : null}</li>)}</ul> : <EmptyState title="Agenda vazia" description="Não há eventos publicados para os próximos dias." />}</Card></>
}