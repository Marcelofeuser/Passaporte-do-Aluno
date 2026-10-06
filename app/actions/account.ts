'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { cookies, headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notification } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { ACTIVE_MEMBERSHIP_COOKIE, requireActionContext } from '@/lib/session'
import { profileInput, toFieldErrors, type ActionState } from '@/lib/validation'

export async function switchMembership(formData: FormData) {
  const ctx = await requireActionContext()
  const id = String(formData.get('membershipId') ?? '')
  if (!ctx.memberships.some((m) => m.id === id)) return

  ;(await cookies()).set(ACTIVE_MEMBERSHIP_COOKIE, id, {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'development' ? 'none' : 'lax',
    secure: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })
  await recordAudit({
    action: 'membership.switched',
    entityType: 'school_membership',
    entityId: id,
    actorUserId: ctx.user.id,
  })
  redirect('/dashboard')
}

export async function updateProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireActionContext()
    const parsed = profileInput.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }

    await auth.api.updateUser({ headers: await headers(), body: { name: parsed.data.name } })
    await recordAudit({
      action: 'user.profile_updated',
      entityType: 'user',
      entityId: ctx.user.id,
      actorUserId: ctx.user.id,
    })
    revalidatePath('/', 'layout')
    return { ok: true, message: 'Perfil atualizado.' }
  } catch (error) {
    logger.error('user.profile_update_failed', { error })
    return { ok: false, message: 'Não foi possível atualizar o perfil.' }
  }
}

export async function markNotificationsRead() {
  const ctx = await requireActionContext()
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, ctx.user.id), isNull(notification.readAt)))
  revalidatePath('/notifications')
  revalidatePath('/', 'layout')
}
