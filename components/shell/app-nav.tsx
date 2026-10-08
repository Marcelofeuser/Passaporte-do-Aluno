'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, BookOpen, Building2, CalendarDays, FileText, HeartHandshake, Home, School, ScrollText, UserRound, Users } from 'lucide-react'
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
  file: FileText,
}
