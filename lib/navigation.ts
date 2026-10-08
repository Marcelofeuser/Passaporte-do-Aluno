import { can, type Permission, type Role } from '@/lib/rbac'

export type NavItem = {
  href: string
  label: string
  icon: 'home' | 'schools' | 'school' | 'users' | 'audit' | 'bell' | 'user' | 'family' | 'library' | 'calendar' | 'file'
}

export function navFor(role: Role | null | undefined, superAdmin: boolean): NavItem[] {
  const items: NavItem[] = [{ href: '/dashboard', label: 'Início', icon: 'home' }]
  if (superAdmin) items.push({ href: '/admin/schools', label: 'Escolas', icon: 'schools' })
  if (role !== 'SUPER_ADMIN' && (can(role, 'school:view_academic') || can(role, 'school:view_users') || can(role, 'school:manage_library'))) {
    items.push({ href: '/school', label: 'Escola', icon: 'school' })
  }
  if (can(role, 'family:view')) {
    items.push({ href: '/family', label: role === 'STUDENT' ? 'Meu boletim' : 'Meus filhos', icon: 'family' })
    items.push({ href: '/family/passport', label: 'Passaporte', icon: 'family' })
    items.push({ href: '/family/report-card', label: 'Boletim', icon: 'library' })
    items.push({ href: '/family/history', label: 'Histórico', icon: 'calendar' })
    items.push({ href: '/family/documents', label: 'Documentos', icon: 'file' })
    items.push({ href: '/family/library', label: 'Biblioteca', icon: 'library' })
    items.push({ href: '/family/agenda', label: 'Agenda', icon: 'calendar' })
    items.push({ href: '/family/access', label: 'Acessos', icon: 'user' })
    items.push({ href: '/family/assistant', label: 'Assistente', icon: 'bell' })
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
  { href: '/school/dashboard', label: 'Dashboard', description: 'Visão executiva: alunos, frequência, notas e risco', permission: 'school:view_academic' },
  { href: '/school/students', label: 'Alunos', description: 'Cadastro, responsáveis, matrícula e documentos', permission: 'school:view_students' },
  { href: '/school/enrollments', label: 'Matrículas', description: 'Ingressos, rematrículas, contratos e situação documental', permission: 'school:view_students' },
  { href: '/school/classes', label: 'Turmas', description: 'Turmas por ano letivo, disciplinas e alunos', permission: 'school:view_academic' },
  { href: '/school/grades', label: 'Diário e notas', description: 'Avaliações, lançamento de notas e médias', permission: 'school:manage_grades' },
  { href: '/school/attendance', label: 'Chamada e frequência', description: 'Presenças, faltas, atrasos e alertas', permission: 'school:manage_attendance' },
  { href: '/school/occurrences', label: 'Ocorrências', description: 'Registro disciplinar, acompanhamento e avisos à família', permission: 'school:manage_discipline' },
  { href: '/school/library', label: 'Biblioteca', description: 'Acervo, exemplares, empréstimos e devoluções', permission: 'school:manage_library' },
  { href: '/school/calendar', label: 'Calendário', description: 'Eventos, dias letivos e comunicação escolar', permission: 'school:view_calendar' },
  { href: '/school/appointments', label: 'Atendimentos', description: 'Horários disponíveis para famílias', permission: 'school:manage_appointments' },
  { href: '/school/access', label: 'Portaria', description: 'Entradas e saídas via NFC e biometria facial', permission: 'school:view_access' },
  { href: '/school/passport', label: 'Passaporte', description: 'Carteirinha digital com QR Code de validação', permission: 'school:view_access' },
  { href: '/school/documents', label: 'Documentos', description: 'Declarações emitidas e códigos de autenticidade', permission: 'school:view_access' },
  { href: '/school/ai', label: 'Assistente Pedagógico', description: 'Análise de risco, médias por turma e resumos para reunião de pais', permission: 'school:view_academic' },
  { href: '/school/teachers', label: 'Professores', description: 'Corpo docente e disciplinas que lecionam', permission: 'school:view_academic' },
  { href: '/school/subjects', label: 'Disciplinas', description: 'Componentes curriculares da escola', permission: 'school:view_academic' },
  { href: '/school/years', label: 'Anos letivos', description: 'Calendário e ano letivo vigente', permission: 'school:view_academic' },
  { href: '/school/users', label: 'Usuários', description: 'Contas de acesso e perfis', permission: 'school:view_users' },
  { href: '/school/settings', label: 'Dados da escola', description: 'Identificação, endereço e logotipo', permission: 'school:manage_settings' },
]
