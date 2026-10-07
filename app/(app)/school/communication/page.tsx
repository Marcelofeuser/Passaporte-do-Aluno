import type { Metadata } from 'next'
import { ActionForm } from '@/components/school/action-form'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { createAnnouncement, deleteAnnouncement, listAnnouncementsForSchool, PRIORITY_LABEL } from '@/app/actions/communication'
import { can } from '@/lib/rbac'
import { listClasses } from '@/lib/school-queries'
import { formatDate, requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Comunicação' }

const PRIORITY_TONE: Record<string, string> = {
  URGENT: 'bg-destructive/10 text-destructive',
  IMPORTANT: 'bg-accent text-accent-foreground',
  NORMAL: 'bg-secondary text-secondary-foreground',
}

export default async function SchoolCommunicationPage() {
  const { ctx, schoolId, role } = await requireSchoolPage('school:view_communication')
  const canManage = can(role, 'school:manage_communication')
  const [classes, announcements] = await Promise.all([listClasses(schoolId), listAnnouncementsForSchool(schoolId)])

  return (
    <>
      <PageTitle
        title="Comunicação e mural de avisos"
        description="Publique avisos para toda a escola ou para turmas específicas e acompanhe as confirmações de leitura."
      />

      {canManage ? (
        <Card title="Novo aviso" description="Sem turma, o aviso alcança toda a escola; com turma, só as famílias dela.">
          <ActionForm action={createAnnouncement} submitLabel="Publicar aviso" pendingLabel="Publicando…" className="p-4">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Título
              <input
                name="title"
                required
                maxLength={160}
                className="h-11 rounded-lg border border-input bg-card px-3 text-base font-normal"
                placeholder="Ex.: Reunião de pais e mestres"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Turma (opcional)
              <select
                name="classId"
                defaultValue=""
                className="h-11 rounded-lg border border-input bg-card px-3 text-base font-normal"
              >
                <option value="">Toda a escola</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.grade} ({c.year})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Prioridade
              <select
                name="priority"
                defaultValue="NORMAL"
                className="h-11 rounded-lg border border-input bg-card px-3 text-base font-normal"
              >
                {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-semibold">
              Conteúdo
              <textarea
                name="content"
                required
                rows={4}
                maxLength={4000}
                className="rounded-lg border border-input bg-card px-3 py-2 text-base font-normal"
                placeholder="Escreva os detalhes do aviso…"
              />
            </label>
          </ActionForm>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Avisos publicados" description="Confirmações de leitura registradas por aviso." />
        {announcements.length === 0 ? (
          <EmptyState
            title="Nenhum aviso publicado"
            description="Os avisos publicados aparecem aqui com o total de confirmações de leitura."
          />
        ) : (
          <ul className="divide-y divide-border">
            {announcements.map((item) => (
              <li key={item.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">{item.title}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                        PRIORITY_TONE[item.priority] ?? PRIORITY_TONE.NORMAL
                      }`}
                    >
                      {PRIORITY_LABEL[item.priority as keyof typeof PRIORITY_LABEL] ?? item.priority}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">{item.readCount} leitura(s)</span>
                    {canManage ? (
                      <ActionForm action={deleteAnnouncement} submitLabel="Remover" className="p-0">
                        <input type="hidden" name="announcementId" value={item.id} />
                      </ActionForm>
                    ) : null}
                  </span>
                </div>
                <p className="mt-1 text-sm">{item.content}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Por {item.authorName ?? 'Administração'} · {formatDate(item.createdAt)} ·{' '}
                  {item.classId ? 'Restrito à turma' : 'Toda a escola'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
