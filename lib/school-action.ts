import { logger } from '@/lib/logger'
import { can, type Permission } from '@/lib/rbac'
import { AuthorizationError, requireActionContext } from '@/lib/session'
import type { ActionState } from '@/lib/validation'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Garante que a ação ocorra na escola do vínculo ativo e que o perfil tenha a permissão.
 * Toda consulta subsequente deve filtrar por `schoolId`.
 */
export async function requireSchoolAction(permission: Permission) {
  const ctx = await requireActionContext()
  const active = ctx.active
  if (!active?.schoolId || !can(active.role, permission)) {
    throw new AuthorizationError('Você não tem permissão para esta ação.')
  }
  return { ctx, schoolId: active.schoolId, userId: ctx.user.id }
}

/** Executa uma action com tratamento padronizado de erros e logs. */
export async function runAction(event: string, fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof AuthorizationError) return { ok: false, message: error.message }
    logger.error(event, { error })
    return { ok: false, message: 'Não foi possível concluir a operação. Tente novamente.' }
  }
}

/** Variante para formulários simples (botões de remover) que não exibem estado. */
export async function runVoidAction(event: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    if (!(error instanceof AuthorizationError)) logger.error(event, { error })
  }
}
