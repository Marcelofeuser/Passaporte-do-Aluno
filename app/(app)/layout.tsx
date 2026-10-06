import { and, count, eq, isNull } from 'drizzle-orm'
import { Brand } from '@/components/brand'
import { BottomNav, SideNav } from '@/components/shell/app-nav'
import { ContextSwitcher } from '@/components/shell/context-switcher'
import { SignOutButton } from '@/components/shell/sign-out-button'
import { db } from '@/lib/db'
import { notification } from '@/lib/db/schema'
import { navFor } from '@/lib/navigation'
import { isSuperAdmin, requirePageContext } from '@/lib/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requirePageContext()
  const [{ value: unread }] = await db
    .select({ value: count() })
    .from(notification)
    .where(and(eq(notification.userId, ctx.user.id), isNull(notification.readAt)))
  const items = navFor(ctx.active?.role, isSuperAdmin(ctx))

  return (
    <div className="min-h-dvh md:flex">
      <aside className="hidden w-64 shrink-0 flex-col gap-6 border-r border-border bg-card p-4 md:flex">
        <Brand href="/dashboard" />
        <ContextSwitcher memberships={ctx.memberships} activeId={ctx.active?.id ?? null} />
        <SideNav items={items} unread={unread} />
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-border bg-card px-4 md:hidden">
          <Brand href="/dashboard" className="text-sm" />
          <SignOutButton className="px-2" />
        </header>
        <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 pt-6 pb-28 md:pb-10">
          <div className="md:hidden">
            <ContextSwitcher memberships={ctx.memberships} activeId={ctx.active?.id ?? null} />
          </div>
          {children}
        </main>
      </div>

      <BottomNav items={items} unread={unread} />
    </div>
  )
}
