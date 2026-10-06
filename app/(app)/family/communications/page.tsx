import type { Metadata } from 'next'
import { ActionForm } from '@/components/school/action-form'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { listAnnouncements } from '@/lib/communication-queries'
import { formatDate, requireSchoolPage } from '@/lib/school-page'
import { markAnnouncementRead } from '@/app/actions/communications'

export const metadata: Metadata = { title: 'Comunicação escolar' }
export default async function FamilyCommunicationsPage() {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const students = await getFamilyStudents(schoolId, role === 'STUDENT' ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)
  const announcements = await listAnnouncements(schoolId, ctx.user.id, students.map((s) => s.id))
  return <>
    <PageTitle title="Mural de avisos" description="Avisos da escola, das turmas e dos anos letivos dos seus dependentes." />
    <Card><CardHeader title={`${announcements.filter((a) => !a.readAt).length} não lido(s)`} />
      {announcements.length === 0 ? <EmptyState title="Nenhum aviso disponível" description="Quando a escola publicar um aviso para você, ele aparecerá aqui." /> :
        <ul className="divide-y divide-border">{announcements.map((a) => <li key={a.id} className={`px-4 py-4 ${!a.readAt ? 'border-l-4 border-primary bg-primary/5' : ''}`}><div className="flex justify-between gap-3"><div><p className="font-semibold">{a.title} {a.priority === 'URGENT' ? <span className="text-destructive">· Urgente</span> : null}</p><p className="text-sm text-muted-foreground">{a.category} · {formatDate(a.publishAt)}</p><p className="mt-2 whitespace-pre-wrap text-sm">{a.body}</p></div>{!a.readAt ? <ActionForm action={markAnnouncementRead} submitLabel="Marcar como lido" className="shrink-0 gap-1"><input type="hidden" name="announcementId" value={a.id} /></ActionForm> : <span className="text-xs text-muted-foreground">Lido em {formatDate(a.readAt)}</span>}</div></li>)}</ul>}
    </Card>
  </>
}
