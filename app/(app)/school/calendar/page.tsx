import type { Metadata } from 'next'
import { createCalendarEvent, createCalendarType, setSchoolDay } from '@/app/actions/calendar'
import { createSchoolEvent, deleteSchoolEvent, EVENT_KIND_LABEL } from '@/app/actions/school-events'
import { ActionForm } from '@/components/school/action-form'
import { BackLink, Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { CALENDAR_AUDIENCES, calendarDateTime } from '@/lib/calendar'
import { listCalendarEvents, listCalendarTypes } from '@/lib/calendar-queries'
import { listAgendaEntries } from '@/lib/agenda-queries'
import { listClasses, listSubjects } from '@/lib/school-queries'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Calendário' }

export default async function SchoolCalendarPage() {
  const { schoolId, role } = await requireSchoolPage('school:view_calendar')
  const types = await listCalendarTypes(schoolId)
  const events = await listCalendarEvents(schoolId, role, new Date(), new Date(Date.now() + 120 * 86_400_000))
  const canManage = role === 'SCHOOL_ADMIN' || role === 'COORDINATOR'
  const [classes, subjects, schoolEvents] = canManage
    ? await Promise.all([listClasses(schoolId), listSubjects(schoolId), listAgendaEntries(schoolId, role, new Date(), new Date(Date.now() + 120 * 86_400_000), [])])
    : [[], [], []]
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
    {canManage ? <Card><CardHeader title="Agenda: provas, trabalhos e eventos" description="Publicados na agenda das famílias da turma (ou de toda a escola, sem turma)." /><ActionForm action={createSchoolEvent} submitLabel="Publicar na agenda" className="p-4 grid gap-4 sm:grid-cols-2">
      <Field label="Tipo" htmlFor="kind"><Select id="kind" name="kind" defaultValue="EVENT">{Object.entries(EVENT_KIND_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <Field label="Título" htmlFor="eventTitle"><Input id="eventTitle" name="title" required maxLength={160} /></Field>
      <Field label="Turma (opcional)" htmlFor="eventClass"><Select id="eventClass" name="classId" defaultValue=""><option value="">Toda a escola</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.grade} ({c.year})</option>)}</Select></Field>
      <Field label="Disciplina (opcional)" htmlFor="eventSubject"><Select id="eventSubject" name="subjectId" defaultValue=""><option value="">—</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>
      <Field label="Data" htmlFor="eventDate"><Input id="eventDate" name="date" type="date" required /></Field>
      <Field label="Hora" htmlFor="eventTime"><Input id="eventTime" name="time" type="time" defaultValue="08:00" required /></Field>
      <Field label="Local" htmlFor="eventLocation"><Input id="eventLocation" name="location" maxLength={160} /></Field>
      <Field label="Descrição" htmlFor="eventDescription"><Textarea id="eventDescription" name="description" maxLength={2000} /></Field>
    </ActionForm>
    {schoolEvents.filter((e) => e.source === 'SCHOOL_EVENT').length ? <ul className="divide-y divide-border border-t border-border">{schoolEvents.filter((e) => e.source === 'SCHOOL_EVENT').map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 p-4"><span><strong>{entry.title}</strong><span className="block text-sm text-muted-foreground">{entry.kindLabel}{entry.className ? ` · ${entry.className}` : ''}{entry.subjectName ? ` · ${entry.subjectName}` : ''} · {calendarDateTime(entry.startsAt)}</span></span><ActionForm action={deleteSchoolEvent} submitLabel="Remover" className="p-0"><input type="hidden" name="eventId" value={entry.id.replace('evt-', '')} /></ActionForm></li>)}</ul> : <EmptyState title="Agenda vazia" description="Provas, trabalhos e eventos publicados aparecem aqui." />}
    </Card> : null}
  </>
}