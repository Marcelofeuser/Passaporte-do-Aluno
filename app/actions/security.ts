'use server'

import { headers } from 'next/headers'
import { and, eq, isNull } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user, userSecurity } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { isApprovedSuperAdminEmail } from '@/lib/super-admin'
import type { ActionState } from '@/lib/validation'

export async function completeInitialPasswordChange(formData: FormData): Promise<ActionState> {
  const session = await getSession()
  if (!session?.user || !isApprovedSuperAdminEmail(session.user.email)) {
    return { ok: false, message: 'Acesso negado.' }
  }

  const currentPassword = String(formData.get('currentPassword') ?? '')
  const newPassword = String(formData.get('newPassword') ?? '')
  const confirmation = String(formData.get('confirmation') ?? '')
  if (newPassword.length < 12) return { ok: false, message: 'A nova senha precisa ter pelo menos 12 caracteres.' }
  if (newPassword !== confirmation) return { ok: false, message: 'As senhas novas não coincidem.' }
  if (newPassword === currentPassword) return { ok: false, message: 'Escolha uma senha diferente da temporária.' }

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await headers(),
    })

    await db
      .update(userSecurity)
      .set({ mustChangePassword: false, updatedAt: new Date() })
      .where(eq(userSecurity.userId, session.user.id))

    const [account] = await db
      .select({ id: user.id })
      .from(user)
      .where(and(eq(user.id, session.user.id), isNull(user.deletedAt)))
      .limit(1)
    if (!account) return { ok: false, message: 'A conta não foi encontrada.' }

    return { ok: true, message: 'Senha alterada. Configure agora o aplicativo autenticador.' }
  } catch {
    return { ok: false, message: 'Não foi possível trocar a senha. Confira a senha temporária e tente novamente.' }
  }
}
