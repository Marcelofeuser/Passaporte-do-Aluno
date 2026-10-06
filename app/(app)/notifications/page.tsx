import type { Metadata } from 'next'
import Link from 'next/link'
import { markNotificationsRead } from '@/app/actions/account'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { getNotifications } from '@/lib/queries'
import { requirePageContext } from '@/lib/session'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Avisos' }

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export default async function NotificationsPage() {
  const ctx = await requirePageContext()
  const items = await getNotifications(ctx.user.id)
  const hasUnread = items.some((n) => !n.readAt)

  return (
    <>
      <PageTitle title="Avisos" description="Notificações sobre seu acesso e sua escola." />
      <Card>
        <CardHeader
          title="Recentes"
          action={
            hasUnread ? (
              <form action={markNotificationsRead}>
                <button type="submit" className="min-h-11 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-muted">
                  Marcar como lidas
                </button>
              </form>
            ) : null
          }
        />
        {items.length ? (
          <ul className="divide-y divide-border">
            {items.map((n) => {
              const content = (
                <>
                  <span className={cn('font-semibold', !n.readAt && 'text-primary')}>
                    {!n.readAt ? <span className="sr-only">Não lida: </span> : null}
                    {n.title}
                  </span>
                  {n.body ? <span className="text-sm leading-relaxed text-muted-foreground">{n.body}</span> : null}
                  <time className="font-mono text-xs text-muted-foreground" dateTime={n.createdAt.toISOString()}>
                    {dateFormat.format(n.createdAt)}
                  </time>
                </>
              )
              return (
                <li key={n.id} className={cn(!n.readAt && 'bg-secondary')}>
                  {n.href ? (
                    <Link href={n.href} className="flex flex-col gap-0.5 p-4">
                      {content}
                    </Link>
                  ) : (
                    <div className="flex flex-col gap-0.5 p-4">{content}</div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <EmptyState title="Nada por aqui" description="Você será avisado quando houver novidades." />
        )}
      </Card>
    </>
  )
}
