import { can, type Permission, type Role } from '@/lib/rbac'

export const PERMISSIONS = {
  'platform:manage_schools': ['SUPER_ADMIN'],
  'platform:view_audit': ['SUPER_ADMIN'],

  'school:view_users': ['SCHOOL_ADMIN'],
  'school:manage_users': ['SCHOOL_ADMIN'],
  'school:view_audit': ['SCHOOL_ADMIN'],
  'school:manage_settings': ['SCHOOL_ADMIN'],

  'school:view_academic': ['SCHOOL_ADMIN', 'COORDINATOR'],
  'school:manage_grades': ['SCHOOL_ADMIN', 'COORDINATOR'],
  'school:manage_attendance': ['SCHOOL_ADMIN', 'COORDINATOR', 'TEACHER'],
  'school:manage_discipline': ['SCHOOL_ADMIN', 'COORDINATOR', 'TEACHER'],
  'school:view_calendar': ['SCHOOL_ADMIN', 'COORDINATOR', 'TEACHER'],
  'school:manage_calendar': ['SCHOOL_ADMIN', 'COORDINATOR'],

  'school:view_students': ['SCHOOL_ADMIN', 'COORDINATOR', 'TEACHER'],
  'school:manage_students': ['SCHOOL_ADMIN', 'COORDINATOR'],
  'school:manage_library': ['SCHOOL_ADMIN', 'COORDINATOR'],
  'school:manage_appointments': ['SCHOOL_ADMIN', 'COORDINATOR'],

  'school:view_access': ['SCHOOL_ADMIN', 'COORDINATOR'],
  'school:manage_access': ['SCHOOL_ADMIN', 'COORDINATOR'],

  'family:view': ['PARENT', 'STUDENT'],
} satisfies Record<string, Role[]>

export type Permission = keyof typeof PERMISSIONS
export type Role = (typeof PERMISSIONS)['platform:manage_schools'][number]

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false
  return PERMISSIONS[permission].includes(role)
}
