import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { getAuditEntries } from '@/lib/queries'
import { can } from '@/lib/rbac'
import { isSuperAdmin, requirePageContext } from '@/lib/session'

export const metadata: Metadata = { title: 'Auditoria' }

const ACTION_LABELS: Record<string, string> = {
  'user.signed_up': 'Cadastro de usuário',
  'user.signed_in': 'Login',
  'user.profile_updated': 'Perfil atualizado',
  'school.created': 'Escola criada',
  'school.archived': 'Escola arquivada',
  'membership.created': 'Usuário vinculado',
  'membership.removed': 'Vínculo removido',
  'membership.switched': 'Troca de perfil ativo',
  'super_admin.bootstrapped': 'Super Admin inicial definido',
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export default async function AuditPage() {
  const ctx = await requirePageContext()
  const superAdmin = isSuperAdmin(ctx)
  const schoolScoped = !superAdmin && can(ctx.active?.role, 'school:view_audit') ? ctx.active?.schoolId : null
  if (!superAdmin && !schoolScoped) redirect('/dashboard')

  const entries = await getAuditEntries(superAdmin ? null : schoolScoped!)

  return (
    <>
      <PageTitle
        title="Auditoria"
        description={superAdmin ? 'Ações recentes em toda a plataforma.' : `Ações recentes em ${ctx.active?.schoolName}.`}
      />
      <Card>
        <CardHeader title="Últimos 50 registros" />
        {entries.length ? (
          <ol className="divide-y divide-border">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-col gap-0.5 p-4">
                <span className="font-semibold">{ACTION_LABELS[e.action] ?? e.action}</span>
                <span className="text-sm text-muted-foreground">
                  {e.actorName ?? 'Sistema'}
                  {e.schoolName ? ` · ${e.schoolName}` : ''}
                </span>
                <time className="font-mono text-xs text-muted-foreground" dateTime={e.createdAt.toISOString()}>
                  {dateFormat.format(e.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Sem registros" description="As ações importantes aparecerão aqui." />
        )}
      </Card>
    </>
  )
}
