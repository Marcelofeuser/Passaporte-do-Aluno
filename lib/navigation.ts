import { can, type Role } from '@/lib/rbac'

export type NavItem = { href: string; label: string; icon: 'home' | 'schools' | 'users' | 'audit' | 'bell' | 'user' }

export function navFor(role: Role | null | undefined, superAdmin: boolean): NavItem[] {
  const items: NavItem[] = [{ href: '/dashboard', label: 'Início', icon: 'home' }]
  if (superAdmin) items.push({ href: '/admin/schools', label: 'Escolas', icon: 'schools' })
  if (can(role, 'school:view_users') && role !== 'SUPER_ADMIN') {
    items.push({ href: '/school/users', label: 'Usuários', icon: 'users' })
  }
  if (superAdmin || can(role, 'school:view_audit')) {
    items.push({ href: '/audit', label: 'Auditoria', icon: 'audit' })
  }
  items.push({ href: '/notifications', label: 'Avisos', icon: 'bell' })
  items.push({ href: '/profile', label: 'Perfil', icon: 'user' })
  return items
}
