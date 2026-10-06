import type { Metadata } from 'next'
import { archiveAnnouncement, createAnnouncement, createCommunicationCategory } from '@/app/actions/communications'
import { ActionForm } from '@/components/school/action-form'
import { Textarea } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { listAnnouncementReads, listCommunicationCategories, listSchoolAnnouncements } from '@/lib/communication-queries'
import { listClasses, listAcademicYears } from '@/lib/school-queries'
import { requireSchoolPage, formatDate } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Comunicação escolar' }

export default async function CommunicationsPage() {
  const { schoolId } = await requireSchoolPage('school:manage_communications')
  const [categories, classes, years, announcements] = await Promise.all([
    listCommunicationCategories(schoolId), listClasses(schoolId), listAcademicYears(schoolId), listSchoolAnnouncements(schoolId),
  ])
  const readsByAnnouncement = new Map(
    await Promise.all(announcements.map(async (item) => [item.id, await listAnnouncementReads(schoolId, item.id)] as const)),
  )
  return <>
    <PageTitle title="Comunicação escolar" description="Publique avisos por escola, turma ou ano letivo. Professores não publicam nesta fase; a gestão mantém o controle do mural." />
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader title="Categorias" />
        <ActionForm action={createCommunicationCategory} submitLabel="Adicionar categoria" className="border-t border-border p-4">
          <Field label="Nome" htmlFor="category-name"><Input id="category-name" name="name" required maxLength={80} /></Field>
        </ActionForm>
        <ul className="divide-y divide-border">{categories.map((c) => <li className="px-4 py-2 text-sm" key={c.id}>{c.name}</li>)}</ul>
      </Card>
      <Card><CardHeader title="Novo aviso" />
        {categories.length === 0 ? <EmptyState title="Crie uma categoria primeiro" description="Ex.: Geral, Pedagógico ou Urgente." /> :
          <ActionForm action={createAnnouncement} submitLabel="Publicar aviso" className="border-t border-border p-4" fieldLabels={{ categoryId: 'Categoria', audienceId: 'Público' }}>
            <Field label="Categoria" htmlFor="announcement-category"><Select id="announcement-category" name="categoryId" required>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Título" htmlFor="announcement-title"><Input id="announcement-title" name="title" required maxLength={180} /></Field>
            <Field label="Mensagem" htmlFor="announcement-body"><Textarea id="announcement-body" name="body" rows={5} required maxLength={10000} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Prioridade" htmlFor="announcement-priority"><Select id="announcement-priority" name="priority"><option value="NORMAL">Normal</option><option value="URGENT">Urgente</option></Select></Field>
              <Field label="Público" htmlFor="announcement-audience"><Select id="announcement-audience" name="audienceType"><option value="SCHOOL">Toda a escola</option><option value="CLASS">Turma</option><option value="YEAR">Ano letivo</option></Select></Field>
            </div>
            <Field label="ID do público (somente turma/ano)" htmlFor="announcement-audience-id"><Select id="announcement-audience-id" name="audienceId"><option value="">Toda a escola</option>{classes.map((c) => <option key={c.id} value={c.id}>Turma: {c.name}</option>)}{years.map((y) => <option key={y.id} value={y.id}>Ano: {y.year}</option>)}</Select></Field>
            <Field label="Expira em (opcional)" htmlFor="announcement-expires"><Input id="announcement-expires" name="expiresAt" type="date" /></Field>
          </ActionForm>}
      </Card>
    </div>
    <Card><CardHeader title="Mural publicado" />
      {announcements.length === 0 ? <EmptyState title="Nenhum aviso publicado" description="Os avisos aparecerão aqui." /> : <ul className="divide-y divide-border">{announcements.map((a) => {
        const reads = readsByAnnouncement.get(a.id) ?? []
        return <li key={a.id} className="px-4 py-4">
          <div className="flex justify-between gap-3">
            <div><p className="font-semibold">{a.title} {a.priority === 'URGENT' ? <span className="text-destructive">· Urgente</span> : null}</p><p className="text-sm text-muted-foreground">{a.category} · {a.audienceType} · {formatDate(a.publishAt)}</p><p className="mt-1 text-sm">{a.body}</p></div>
            <span className="text-right text-sm text-muted-foreground">{a.reads} leitura(s)<br />{a.lastReadAt ? `Última: ${formatDate(a.lastReadAt)}` : 'Ainda sem leitura'}</span>
          </div>
          {reads.length > 0 ? <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold">Ver recibos de leitura</summary><ul className="mt-2 divide-y divide-border rounded border border-border">{reads.map((read) => <li key={read.userId} className="flex justify-between gap-3 px-3 py-2"><span>{read.name} <span className="text-muted-foreground">({read.email})</span></span><span className="text-muted-foreground">{formatDate(read.readAt)}</span></li>)}</ul></details> : null}
          <ActionForm action={archiveAnnouncement} submitLabel="Arquivar aviso" pendingLabel="Arquivando…" className="mt-3 max-w-md" fieldLabels={{ justification: 'Justificativa' }}>
            <input type="hidden" name="announcementId" value={a.id} />
            <Field label="Justificativa para arquivamento" htmlFor={`archive-${a.id}`}><Input id={`archive-${a.id}`} name="justification" required minLength={5} maxLength={1000} /></Field>
          </ActionForm>
        </li>
      })}</ul>}
    </Card>
  </>
}
