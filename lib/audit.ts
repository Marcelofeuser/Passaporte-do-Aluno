import { headers } from 'next/headers'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import { logger } from '@/lib/logger'

type AuditInput = {
  action: string
  entityType: string
  entityId?: string | null
  schoolId?: string | null
  actorUserId?: string | null
  metadata?: Record<string, unknown>
  request?: Request | null
}

async function requestMeta(request?: Request | null) {
  try {
    const h = request?.headers ?? (await headers())
    return {
      ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? h.get('x-real-ip'),
      userAgent: h.get('user-agent'),
    }
  } catch {
    return { ipAddress: null, userAgent: null }
  }
}

/** Registra uma ação relevante na trilha de auditoria. Nunca lança erro para o chamador. */
export async function recordAudit(input: AuditInput) {
  try {
    const meta = await requestMeta(input.request)
    await db.insert(auditLog).values({
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      schoolId: input.schoolId ?? null,
      actorUserId: input.actorUserId ?? null,
      metadata: input.metadata ?? {},
      ipAddress: meta.ipAddress ?? null,
      userAgent: meta.userAgent ?? null,
    })
  } catch (error) {
    logger.error('audit.write_failed', { action: input.action, error })
  }
}
