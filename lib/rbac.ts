export const ROLES = [
  'SUPER_ADMIN',
  'SCHOOL_ADMIN',
  'COORDINATOR',
  'TEACHER',
  'PARENT',
  'STUDENT',
] as const

export type Role = (typeof ROLES)[number]

export const SCHOOL_ROLES = ROLES.filter((r) => r !== 'SUPER_ADMIN') as Exclude<
  Role,
  'SUPER_ADMIN'
>[]

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: 'Super Admin',
  SCHOOL_ADMIN: 'Administrador da escola',
  COORDINATOR: 'Coordenador',
  TEACHER: 'Professor',
  PARENT: 'Responsável',
  STUDENT: 'Aluno',
}

const PERMISSIONS = {
  'platform:manage_schools': ['SUPER_ADMIN'],
  'platform:view_audit': ['SUPER_ADMIN'],
  'school:view_users': ['SCHOOL_ADMIN', 'COORDINATOR'],
  'school:manage_users': ['SCHOOL_ADMIN', 'COORDINATOR'],
  'school:view_audit': ['SCHOOL_ADMIN'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return (PERMISSIONS[permission] as readonly Role[]).includes(role)
}

/** Funções que cada perfil pode atribuir a outros usuários dentro de uma escola. */
const ASSIGNABLE: Record<Role, readonly Role[]> = {
  SUPER_ADMIN: SCHOOL_ROLES,
  SCHOOL_ADMIN: SCHOOL_ROLES,
  COORDINATOR: ['TEACHER', 'PARENT', 'STUDENT'],
  TEACHER: [],
  PARENT: [],
  STUDENT: [],
}

export function assignableRoles(role: Role | null | undefined): readonly Role[] {
  return role ? ASSIGNABLE[role] : []
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
