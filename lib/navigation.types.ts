import { can, type Permission, type Role } from '@/lib/rbac'

export type NavItem = {
  href: string
  label: string
  icon: 'home' | 'schools' | 'school' | 'users' | 'audit' | 'bell' | 'user' | 'family' | 'library' | 'calendar' | 'file'
}
