'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { school } from '@/lib/db/schema'
import { requireSchoolAction, runAction } from '@/lib/school-action'
import { IMAGE_TYPES, getUploadedFile, removeStoredFile, storeSchoolFile, UploadError } from '@/lib/storage'
import { formText, schoolSettingsInput, toFieldErrors, type ActionState } from '@/lib/validation'

export async function updateSchoolSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('school.settings_update_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_settings')
    const parsed = schoolSettingsInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }

    const [current] = await db
      .select({ logoPathname: school.logoPathname })
      .from(school)
      .where(and(eq(school.id, schoolId), isNull(school.deletedAt)))
    if (!current) return { ok: false, message: 'Escola não encontrada.' }

    let logoPathname = current.logoPathname
    const logo = getUploadedFile(formData, 'logo')
    if (logo) {
      try {
        const stored = await storeSchoolFile(logo, {
          schoolId,
          folder: 'branding',
          allowed: IMAGE_TYPES,
          maxBytes: 2 * 1024 * 1024,
        })
        logoPathname = stored.pathname
      } catch (e) {
        if (e instanceof UploadError) return { ok: false, fieldErrors: { logo: e.message } }
        throw e
      }
    }

    await db
      .update(school)
      .set({ ...parsed.data, logoPathname, updatedAt: new Date() })
      .where(eq(school.id, schoolId))

    if (logo && current.logoPathname) await removeStoredFile(current.logoPathname)

    await recordAudit({
      action: 'school.settings_updated',
      entityType: 'school',
      entityId: schoolId,
      schoolId,
      actorUserId: userId,
      metadata: { logoChanged: Boolean(logo) },
    })
    revalidatePath('/school', 'layout')
    return { ok: true, message: 'Dados da escola atualizados.' }
  })
}
