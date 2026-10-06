'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { academicYear, announcement, announcementAudience, announcementRead, communicationCategory, schoolClass } from '@/lib/db/schema'
import { requireSchoolAction, runAction } from '@/lib/school-action'
import { announcementInput, communicationCategoryInput, formText, toFieldErrors, type ActionState } from '@/lib/validation'
import { listAnnouncements } from '@/lib/communication-queries'
import { getFamilyStudents } from '@/lib/attendance-queries'

const MANAGE = 'school:manage_communications' as const
export async function createCommunicationCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('communications.category_create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = communicationCategoryInput.safeParse(formText(fd))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    await db.insert(communicationCategory).values({ schoolId, name: parsed.data.name, color: parsed.data.color ?? null })
    await recordAudit({ action: 'communications.category_created', entityType: 'communication_category', schoolId, actorUserId: userId })
    revalidatePath('/school/communications')
    return { ok: true, message: 'Categoria criada.' }
  })
}

export async function createAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('communications.announcement_create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = announcementInput.safeParse(formText(fd))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const [category] = await db.select({ id: communicationCategory.id }).from(communicationCategory)
      .where(and(eq(communicationCategory.id, parsed.data.categoryId), eq(communicationCategory.schoolId, schoolId), eq(communicationCategory.active, true))).limit(1)
    if (!category) return { ok: false, message: 'Categoria não encontrada.' }
    if (parsed.data.audienceType === 'CLASS') {
      const [row] = await db.select({ id: schoolClass.id }).from(schoolClass).where(and(eq(schoolClass.id, parsed.data.audienceId!), eq(schoolClass.schoolId, schoolId))).limit(1)
      if (!row) return { ok: false, message: 'Turma não encontrada.' }
    }
    if (parsed.data.audienceType === 'YEAR') {
      const [row] = await db.select({ id: academicYear.id }).from(academicYear).where(and(eq(academicYear.id, parsed.data.audienceId!), eq(academicYear.schoolId, schoolId))).limit(1)
      if (!row) return { ok: false, message: 'Ano letivo não encontrado.' }
    }
    const [post] = await db.insert(announcement).values({
      schoolId, categoryId: parsed.data.categoryId, title: parsed.data.title, body: parsed.data.body,
      priority: parsed.data.priority, publishAt: parsed.data.publishAt ? new Date(parsed.data.publishAt) : new Date(),
      expiresAt: parsed.data.expiresAt ?? null, createdBy: userId,
    }).returning({ id: announcement.id })
    await db.insert(announcementAudience).values({
      schoolId, announcementId: post.id, audienceType: parsed.data.audienceType,
      classId: parsed.data.audienceType === 'CLASS' ? parsed.data.audienceId : null,
      academicYearId: parsed.data.audienceType === 'YEAR' ? parsed.data.audienceId : null,
    })
    await recordAudit({ action: 'communications.announcement_created', entityType: 'announcement', entityId: post.id, schoolId, actorUserId: userId, metadata: { audienceType: parsed.data.audienceType, audienceId: parsed.data.audienceId } })
    revalidatePath('/school/communications'); revalidatePath('/family/communications')
    return { ok: true, message: 'Aviso publicado.' }
  })
}

export async function markAnnouncementRead(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('communications.read_failed', async () => {
    const { schoolId, userId, ctx } = await requireSchoolAction('family:view')
    const id = String(fd.get('announcementId') ?? '')
    const students = await getFamilyStudents(schoolId, ctx.active?.role === 'STUDENT' ? 'STUDENT' : 'PARENT', userId, ctx.user.email)
    const visible = await listAnnouncements(schoolId, userId, students.map((student) => student.id))
    if (!visible.some((item) => item.id === id)) return { ok: false, message: 'Aviso não encontrado.' }
    await db.insert(announcementRead).values({ schoolId, announcementId: id, userId }).onConflictDoUpdate({ target: [announcementRead.announcementId, announcementRead.userId], set: { readAt: new Date(), schoolId } })
    revalidatePath('/family/communications')
    return { ok: true }
  })
}

export async function archiveAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction('communications.archive_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const announcementId = String(fd.get('announcementId') ?? '')
    const justification = String(fd.get('justification') ?? '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(announcementId)) {
      return { ok: false, message: 'Aviso inválido.' }
    }
    if (justification.length < 5 || justification.length > 1000) {
      return { ok: false, fieldErrors: { justification: 'Informe uma justificativa entre 5 e 1000 caracteres.' } }
    }
    const updated = await db.update(announcement)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(announcement.id, announcementId), eq(announcement.schoolId, schoolId)))
      .returning({ id: announcement.id })
    if (updated.length === 0) return { ok: false, message: 'Aviso não encontrado.' }
    await recordAudit({
      action: 'communications.announcement_archived',
      entityType: 'announcement',
      entityId: announcementId,
      schoolId,
      actorUserId: userId,
      metadata: { justification },
    })
    revalidatePath('/school/communications')
    revalidatePath('/family/communications')
    return { ok: true, message: 'Aviso arquivado.' }
  })
}
