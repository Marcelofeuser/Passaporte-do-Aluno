import type { Metadata } from 'next'
import { createCalendarEvent, createCalendarType, setSchoolDay } from '@/app/actions/calendar'
import { ActionForm } from '@/components/school/action-form'
import { BackLink, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { CALENDAR_AUDIENCES, calendarDateTime } from '@/lib/calendar'
import { listCalendarEvents, listCalendarTypes } from '@/lib/calendar-queries'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Calendário' }

export default async function SchoolCalendarPage() {
  const { schoolId, role } = await requireSchoolPage('school:view_calendar')
  const types = await listCalendarTypes(schoolId)
  const events = await listCalendarEvents(schoolId, role, new Date(), new Date(Date.now() + 120 * 86_400_000))
  return <>
    <BackLink href="/school">Escola</BackLink>
    <PageTitle title="Calendário escolar" description="Eventos, dias letivos e comunicados visíveis conforme o público definido." />
    {role === 'SCHOOL_ADMIN' || role === 'COORDINATOR' ? <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader title="Novo tipo de evento" /><ActionForm action={createCalendarType} submitLabel="Criar tipo" className="p-4">
        <Field label="Nome" htmlFor="name"><Input id="name" name="name" required maxLength={80} /></Field>
        <Field label="Visibilidade" htmlFor="audience"><Select id="audience" name="audience" defaultValue="ALL">{Object.entries(CALENDAR_AUDIENCES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
      </ActionForm></Card>
      <Card><CardHeader title="Novo evento" /><ActionForm action={createCalendarEvent} submitLabel="Adicionar evento" className="p-4">
        <Field label="Tipo" htmlFor="typeId"><Select id="typeId" name="typeId" required defaultValue=""><option value="" disabled>Selecione…</option>{types.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</Select></Field>
        <Field label="Título" htmlFor="title"><Input id="title" name="title" required maxLength={160} /></Field>
        <Field label="Início" htmlFor="startsAt"><Input id="startsAt" name="startsAt" type="datetime-local" required /></Field>
        <Field label="Local" htmlFor="location"><Input id="location" name="location" maxLength={120} /></Field>
        <Field label="Descrição" htmlFor="description"><Textarea id="description" name="description" maxLength={500} /></Field>
      </ActionForm></Card>
    </div> : null}
    {role === 'SCHOOL_ADMIN' || role === 'COORDINATOR' ? <Card><CardHeader title="Dia letivo" description="Registre feriados, recessos e reposições para o calendário escolar." /><ActionForm action={setSchoolDay} submitLabel="Salvar dia" className="p-4 sm:flex-row sm:items-end">
      <Field label="Data" htmlFor="day"><Input id="day" name="day" type="date" required /></Field><Field label="Situação" htmlFor="isSchoolDay"><Select id="isSchoolDay" name="isSchoolDay" defaultValue="false"><option value="true">Letivo</option><option value="false">Não letivo</option></Select></Field><Field label="Motivo" htmlFor="reason"><Input id="reason" name="reason" maxLength={200} /></Field>
    </ActionForm></Card> : null}
    <Card><CardHeader title="Próximos eventos" />{events.length ? <ul className="divide-y divide-border">{events.map((event) => <li key={event.id} className="p-4"><strong>{event.title}</strong><p className="text-sm text-muted-foreground">{event.typeName} · {calendarDateTime(event.startsAt)}{event.location ? ` · ${event.location}` : ''}</p>{event.description ? <p className="mt-1 text-sm">{event.description}</p> : null}</li>)}</ul> : <EmptyState title="Nenhum evento próximo" description="Os próximos eventos aparecerão aqui." />}</Card>
  </>
}