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
      <aside className="sticky top-0 hidden h-dvh w-72 shrink-0 flex-col gap-6 border-r border-border bg-card p-5 md:flex">
        <Brand href="/dashboard" />
        <ContextSwitcher memberships={ctx.memberships} activeId={ctx.active?.id ?? null} />
        <SideNav items={items} unread={unread} />
        <div className="mt-auto">
          <SignOutButton />
        </div>
      </aside>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-x-clip">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full bg-sun/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-64 -left-24 size-64 rounded-full bg-sky/25 blur-3xl"
        />
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-2 border-b border-border bg-card/90 px-4 backdrop-blur md:hidden">
          <Brand href="/dashboard" className="text-base" />
          <SignOutButton className="px-2" />
        </header>
        <main className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col gap-7 px-4 pt-7 pb-32 md:px-8 md:pb-12">
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
