import { redirect } from 'next/navigation'
import { can, type Permission } from '@/lib/rbac'
import { requirePagePermission } from '@/lib/session'

/** Para páginas da escola ativa: exige permissão e vínculo com uma escola. */
export async function requireSchoolPage(permission: Permission) {
  const ctx = await requirePagePermission(permission)
  const schoolId = ctx.active.schoolId
  if (!schoolId) redirect('/dashboard')
  const role = ctx.active.role
  return {
    ctx,
    schoolId,
    role,
    canManage: can(role, 'school:manage_academic'),
  }
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  const d = typeof value === 'string' ? new Date(`${value.slice(0, 10)}T12:00:00`) : value
  return d.toLocaleDateString('pt-BR')
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
