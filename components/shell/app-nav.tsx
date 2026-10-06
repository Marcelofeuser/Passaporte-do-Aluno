'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Building2, Home, School, ScrollText, UserRound, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { NavItem } from '@/lib/navigation'

const ICONS = {
  home: Home,
  schools: Building2,
  school: School,
  users: Users,
  audit: ScrollText,
  bell: Bell,
  user: UserRound,
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function BottomNav({ items, unread }: { items: NavItem[]; unread: number }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {item.label}
                {item.icon === 'bell' && unread > 0 ? (
                  <span className="absolute top-2 left-1/2 ml-2 size-2 rounded-full bg-accent">
                    <span className="sr-only">{unread} avisos não lidos</span>
                  </span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function SideNav({ items, unread }: { items: NavItem[]; unread: number }) {
  const pathname = usePathname()
  return (
    <nav aria-label="Navegação principal" className="hidden md:block">
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-semibold',
                  active ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-muted',
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                <span className="flex-1">{item.label}</span>
                {item.icon === 'bell' && unread > 0 ? (
                  <span className="rounded-full bg-accent px-2 text-xs text-accent-foreground">{unread}</span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
