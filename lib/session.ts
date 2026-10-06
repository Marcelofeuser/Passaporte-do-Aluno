import { cache } from 'react'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { and, asc, eq, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { school, schoolMembership } from '@/lib/db/schema'
import { can, isRole, type Permission, type Role } from '@/lib/rbac'

export const ACTIVE_MEMBERSHIP_COOKIE = 'pa_active_membership'

export type Membership = {
  id: string
  role: Role
  schoolId: string | null
  schoolName: string | null
}

export type AppContext = {
  user: { id: string; name: string; email: string }
  memberships: Membership[]
  active: Membership | null
}

export class AuthorizationError extends Error {
  constructor(message = 'Acesso negado') {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() })
})

export async function getUserMemberships(userId: string): Promise<Membership[]> {
  const rows = await db
    .select({
      id: schoolMembership.id,
      role: schoolMembership.role,
      schoolId: schoolMembership.schoolId,
      schoolName: school.name,
      schoolDeletedAt: school.deletedAt,
    })
    .from(schoolMembership)
    .leftJoin(school, eq(school.id, schoolMembership.schoolId))
    .where(and(eq(schoolMembership.userId, userId), isNull(schoolMembership.deletedAt)))
    .orderBy(asc(schoolMembership.createdAt))

  return rows
    .filter((r) => isRole(r.role) && (r.schoolId === null || r.schoolDeletedAt === null))
    .map((r) => ({
      id: r.id,
      role: r.role as Role,
      schoolId: r.schoolId,
      schoolName: r.schoolName,
    }))
}

/** Contexto do usuário autenticado (sessão + vínculos + vínculo ativo). Sem sessão, retorna null. */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const session = await getSession()
  if (!session?.user) return null

  const memberships = await getUserMemberships(session.user.id)
  const preferred = (await cookies()).get(ACTIVE_MEMBERSHIP_COOKIE)?.value
  const active = memberships.find((m) => m.id === preferred) ?? memberships[0] ?? null

  return {
    user: { id: session.user.id, name: session.user.name, email: session.user.email },
    memberships,
    active,
  }
})

/** Para páginas: redireciona ao login se não houver sessão. */
export async function requirePageContext() {
  const ctx = await getAppContext()
  if (!ctx) redirect('/sign-in')
  return ctx
}

/** Para páginas: exige uma permissão no vínculo ativo; caso contrário volta ao painel. */
export async function requirePagePermission(permission: Permission) {
  const ctx = await requirePageContext()
  if (!can(ctx.active?.role, permission)) redirect('/dashboard')
  return ctx as AppContext & { active: Membership }
}

/** Para server actions: lança erro se não autenticado. */
export async function requireActionContext() {
  const ctx = await getAppContext()
  if (!ctx) throw new AuthorizationError('Sessão expirada. Entre novamente.')
  return ctx
}

export function isSuperAdmin(ctx: AppContext) {
  return ctx.memberships.some((m) => m.role === 'SUPER_ADMIN')
}

/**
 * Resolve o papel efetivo do usuário em uma escola específica.
 * Super Admin atua em qualquer escola; demais perfis somente onde têm vínculo ativo.
 */
export function roleInSchool(ctx: AppContext, schoolId: string): Role | null {
  if (isSuperAdmin(ctx)) return 'SUPER_ADMIN'
  const membership = ctx.memberships.find((m) => m.schoolId === schoolId)
  return membership?.role ?? null
}
