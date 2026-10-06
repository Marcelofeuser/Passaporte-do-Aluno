import { can, type Permission, type Role } from '@/lib/rbac'

export type NavItem = {
  href: string
  label: string
  icon: 'home' | 'schools' | 'school' | 'users' | 'audit' | 'bell' | 'user'
}

export function navFor(role: Role | null | undefined, superAdmin: boolean): NavItem[] {
  const items: NavItem[] = [{ href: '/dashboard', label: 'Início', icon: 'home' }]
  if (superAdmin) items.push({ href: '/admin/schools', label: 'Escolas', icon: 'schools' })
  if (role !== 'SUPER_ADMIN' && (can(role, 'school:view_academic') || can(role, 'school:view_users'))) {
    items.push({ href: '/school', label: 'Escola', icon: 'school' })
  }
  if (superAdmin || can(role, 'school:view_audit')) {
    items.push({ href: '/audit', label: 'Auditoria', icon: 'audit' })
  }
  items.push({ href: '/notifications', label: 'Avisos', icon: 'bell' })
  items.push({ href: '/profile', label: 'Perfil', icon: 'user' })
  return items
}

export type SchoolSection = {
  href: string
  label: string
  description: string
  permission: Permission
}

export const SCHOOL_SECTIONS: SchoolSection[] = [
  { href: '/school/students', label: 'Alunos', description: 'Cadastro, responsáveis, matrícula e documentos', permission: 'school:view_students' },
  { href: '/school/classes', label: 'Turmas', description: 'Turmas por ano letivo, disciplinas e alunos', permission: 'school:view_academic' },
  { href: '/school/grades', label: 'Diário e notas', description: 'Avaliações, lançamento de notas e médias', permission: 'school:manage_grades' },
  { href: '/school/teachers', label: 'Professores', description: 'Corpo docente e disciplinas que lecionam', permission: 'school:view_academic' },
  { href: '/school/subjects', label: 'Disciplinas', description: 'Componentes curriculares da escola', permission: 'school:view_academic' },
  { href: '/school/years', label: 'Anos letivos', description: 'Calendário e ano letivo vigente', permission: 'school:view_academic' },
  { href: '/school/users', label: 'Usuários', description: 'Contas de acesso e perfis', permission: 'school:view_users' },
  { href: '/school/settings', label: 'Dados da escola', description: 'Identificação, endereço e logotipo', permission: 'school:manage_settings' },
]
