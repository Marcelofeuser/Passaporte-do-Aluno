'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, BookOpen, Building2, CalendarDays, HeartHandshake, Home, School, ScrollText, UserRound, Users } from 'lucide-react'
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
  family: HeartHandshake,
  library: BookOpen,
  calendar: CalendarDays,
}

// Cada área ganha uma cor amiga para ser reconhecida rapidamente
const TONES: Record<keyof typeof ICONS, string> = {
  home: 'bg-sky/45',
  schools: 'bg-mint/50',
  school: 'bg-mint/50',
  users: 'bg-coral/45',
  audit: 'bg-sun/55',
  bell: 'bg-sun/55',
  user: 'bg-coral/45',
  family: 'bg-coral/45',
  library: 'bg-mint/50',
  calendar: 'bg-sky/45',
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + '/')
}

export function BottomNav({ items, unread }: { items: NavItem[]; unread: number }) {
  const pathname = usePathname()
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-16px_oklch(0.45_0.1_240/0.3)] backdrop-blur md:hidden"
    >
      <ul className="flex px-1">
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-bold transition-transform active:scale-90',
                  active ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'flex h-8 w-12 items-center justify-center rounded-full transition-all duration-200',
                    active ? 'scale-110 bg-primary text-primary-foreground' : 'bg-transparent',
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                {item.label}
                {item.icon === 'bell' && unread > 0 ? (
                  <span className="absolute top-1.5 left-1/2 ml-3 flex min-w-5 animate-pop-in items-center justify-center rounded-full bg-accent px-1 text-[10px] text-white">
                    {unread}
                    <span className="sr-only"> avisos não lidos</span>
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
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => {
          const Icon = ICONS[item.icon]
          const active = isActive(pathname, item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group flex min-h-12 items-center gap-3 rounded-2xl px-2 font-bold transition-all duration-150 active:scale-[0.97]',
                  active
                    ? 'bg-primary text-primary-foreground shadow-[0_4px_0_0_var(--primary-shadow)]'
                    : 'text-foreground hover:translate-x-1 hover:bg-muted',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 items-center justify-center rounded-xl transition-transform group-hover:-rotate-6',
                    active ? 'bg-white/20' : TONES[item.icon],
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex-1">{item.label}</span>
                {item.icon === 'bell' && unread > 0 ? (
                  <span className="mr-1 animate-pop-in rounded-full bg-accent px-2 text-sm text-white">{unread}</span>
                ) : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
