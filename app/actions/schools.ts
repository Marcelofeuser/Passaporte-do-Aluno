'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { school } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { isSuperAdmin, requireActionContext } from '@/lib/session'
import { schoolInput, slugify, toFieldErrors, type ActionState } from '@/lib/validation'

export async function createSchool(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireActionContext()
    if (!isSuperAdmin(ctx)) return { ok: false, message: 'Apenas o Super Admin pode criar escolas.' }

    const parsed = schoolInput.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }

    const base = slugify(parsed.data.name) || 'escola'
    const taken = await db
      .select({ id: school.id })
      .from(school)
      .where(and(eq(school.slug, base), isNull(school.deletedAt)))
      .limit(1)
    const slug = taken.length ? `${base}-${crypto.randomUUID().slice(0, 6)}` : base

    const [created] = await db
      .insert(school)
      .values({
        name: parsed.data.name,
        slug,
        cnpj: parsed.data.cnpj?.replace(/\D/g, '') ?? null,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
      })
      .returning({ id: school.id })

    await recordAudit({
      action: 'school.created',
      entityType: 'school',
      entityId: created.id,
      schoolId: created.id,
      actorUserId: ctx.user.id,
      metadata: { name: parsed.data.name },
    })
    revalidatePath('/admin/schools')
    return { ok: true, message: 'Escola criada.' }
  } catch (error) {
    logger.error('school.create_failed', { error })
    return { ok: false, message: 'Não foi possível criar a escola.' }
  }
}

export async function archiveSchool(formData: FormData) {
  const ctx = await requireActionContext()
  if (!isSuperAdmin(ctx)) return
  const id = String(formData.get('schoolId') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) return

  await db
    .update(school)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(school.id, id), isNull(school.deletedAt)))
  await recordAudit({
    action: 'school.archived',
    entityType: 'school',
    entityId: id,
    schoolId: id,
    actorUserId: ctx.user.id,
  })
  revalidatePath('/admin/schools')
}
