'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, desc, eq, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  announcementRead,
  enrollment,
  notification,
  parent,
  schoolAnnouncement,
  student,
  studentParent,
  user,
} from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { runAction, runVoidAction, requireSchoolAction, UUID_RE } from '@/lib/school-action'
import type { ActionState } from '@/lib/validation'
import { toFieldErrors } from '@/lib/validation'

export const ANNOUNCEMENT_PRIORITIES = ['NORMAL', 'IMPORTANT', 'URGENT'] as const
export type AnnouncementPriority = (typeof ANNOUNCEMENT_PRIORITIES)[number]

export const PRIORITY_LABEL: Record<AnnouncementPriority, string> = {
  NORMAL: 'Normal',
  IMPORTANT: 'Importante',
  URGENT: 'Urgente',
}

const ANNOUNCEMENT_INPUT = z.object({
  classId: z
    .string()
    .trim()
    .regex(UUID_RE, 'Turma inválida')
    .nullish()
    .transform((v) => v || null),
  title: z.string().trim().min(3, 'Informe o título do aviso').max(160),
  content: z.string().trim().min(3, 'Escreva o conteúdo do aviso').max(4000),
  priority: z.enum(ANNOUNCEMENT_PRIORITIES, 'Prioridade inválida').default('NORMAL'),
})

/** Publica um aviso (geral da escola ou restrito a uma turma). Permissão: school:manage_communication. */
export async function createAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('communication.create', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_communication')
    const parsed = ANNOUNCEMENT_INPUT.safeParse({
      classId: formData.get('classId') || null,
      title: formData.get('title'),
      content: formData.get('content'),
      priority: formData.get('priority') || 'NORMAL',
    })
    if (!parsed.success) {
      return { ok: false, message: 'Verifique os campos destacados.', fieldErrors: toFieldErrors(parsed.error) }
    }
    const data = parsed.data
    const [row] = await db
      .insert(schoolAnnouncement)
      .values({
        schoolId,
        classId: data.classId ?? null,
        authorId: userId,
        title: data.title,
        content: data.content,
        priority: data.priority,
      })
      .returning({ id: schoolAnnouncement.id })

    await notifyAudience(schoolId, data.classId ?? null, {
      title: `Aviso: ${data.title}`,
      body: data.content.slice(0, 200),
    })

    await recordAudit({
      action: 'announcement.created',
      entityType: 'school_announcement',
      entityId: row?.id ?? null,
      schoolId,
      actorUserId: userId,
      metadata: { classId: data.classId ?? null, priority: data.priority },
    })

    revalidatePath('/school/communication')
    revalidatePath('/family')
    return { ok: true, message: 'Aviso publicado.' }
  })
}

/** Confirma a leitura do aviso pelo usuário logado (idempotente). */
export async function markAnnouncementRead(announcementId: string): Promise<void> {
  await runVoidAction('communication.mark_read', async () => {
    const { schoolId, userId } = await requireSchoolAction('family:view')
    if (!UUID_RE.test(announcementId)) return
    const [announcement] = await db
      .select({ id: schoolAnnouncement.id })
      .from(schoolAnnouncement)
      .where(
        and(
          eq(schoolAnnouncement.schoolId, schoolId),
          eq(schoolAnnouncement.id, announcementId),
          isNull(schoolAnnouncement.deletedAt),
        ),
      )
    if (!announcement) return
    await db
      .insert(announcementRead)
      .values({ schoolId, announcementId, userId })
      .onConflictDoNothing({ target: [announcementRead.announcementId, announcementRead.userId] })
    revalidatePath('/family')
    revalidatePath('/school/communication')
  })
}

/** Variante para formulários (ActionForm): confirma leitura e devolve estado. */
export async function markAnnouncementReadForm(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await markAnnouncementRead(String(formData.get('announcementId') ?? ''))
  return { ok: true, message: 'Leitura confirmada.' }
}

/** Remove (soft delete) um aviso. Permissão: school:manage_communication. */
export async function deleteAnnouncement(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('communication.delete', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_communication')
    const announcementId = String(formData.get('announcementId') ?? '')
    if (!UUID_RE.test(announcementId)) return { ok: false, message: 'Aviso inválido.' }
    await db
      .update(schoolAnnouncement)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(schoolAnnouncement.schoolId, schoolId),
          eq(schoolAnnouncement.id, announcementId),
          isNull(schoolAnnouncement.deletedAt),
        ),
      )
    await recordAudit({
      action: 'announcement.deleted',
      entityType: 'school_announcement',
      entityId: announcementId,
      schoolId,
      actorUserId: userId,
      metadata: {},
    })
    revalidatePath('/school/communication')
    revalidatePath('/family')
    return { ok: true, message: 'Aviso removido.' }
  })
}

/** Mural administrativo: todos os avisos da escola com contagem de leituras. */
export async function listAnnouncementsForSchool(schoolId: string, limit = 50) {
  return db
    .select({
      id: schoolAnnouncement.id,
      title: schoolAnnouncement.title,
      content: schoolAnnouncement.content,
      priority: schoolAnnouncement.priority,
      classId: schoolAnnouncement.classId,
      createdAt: schoolAnnouncement.createdAt,
      authorName: user.name,
      readCount: sql<number>`(
        select count(*)::int from ${announcementRead}
        where ${announcementRead.announcementId} = ${schoolAnnouncement.id}
      )`,
    })
    .from(schoolAnnouncement)
    .leftJoin(user, eq(user.id, schoolAnnouncement.authorId))
    .where(and(eq(schoolAnnouncement.schoolId, schoolId), isNull(schoolAnnouncement.deletedAt)))
    .orderBy(desc(schoolAnnouncement.createdAt))
    .limit(limit)
}

/** Avisos visíveis à família: gerais da escola + os da(s) turma(s) dos filhos/aluno. */
export async function listAnnouncementsForFamily(
  schoolId: string,
  role: 'PARENT' | 'STUDENT',
  userId: string,
  email: string,
  limit = 30,
) {
  const classIds = await familyClassIds(schoolId, role, userId, email)
  const visibility = classIds.length
    ? or(
        and(isNull(schoolAnnouncement.classId), isNull(schoolAnnouncement.deletedAt)),
        and(inArray(schoolAnnouncement.classId, classIds), isNull(schoolAnnouncement.deletedAt)),
      )
    : and(isNull(schoolAnnouncement.classId), isNull(schoolAnnouncement.deletedAt))
  return db
    .select({
      id: schoolAnnouncement.id,
      title: schoolAnnouncement.title,
      content: schoolAnnouncement.content,
      priority: schoolAnnouncement.priority,
      classId: schoolAnnouncement.classId,
      createdAt: schoolAnnouncement.createdAt,
      authorName: user.name,
      readAt: announcementRead.readAt,
    })
    .from(schoolAnnouncement)
    .leftJoin(user, eq(user.id, schoolAnnouncement.authorId))
    .leftJoin(
      announcementRead,
      and(eq(announcementRead.announcementId, schoolAnnouncement.id), eq(announcementRead.userId, userId)),
    )
    .where(and(eq(schoolAnnouncement.schoolId, schoolId), visibility))
    .orderBy(desc(schoolAnnouncement.createdAt))
    .limit(limit)
}

/** Contagem de avisos não lidos para o badge do menu. */
export async function countUnreadAnnouncements(
  schoolId: string,
  role: 'PARENT' | 'STUDENT',
  userId: string,
  email: string,
) {
  const classIds = await familyClassIds(schoolId, role, userId, email)
  const visibility = classIds.length
    ? or(isNull(schoolAnnouncement.classId), inArray(schoolAnnouncement.classId, classIds))
    : isNull(schoolAnnouncement.classId)
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(schoolAnnouncement)
    .leftJoin(
      announcementRead,
      and(eq(announcementRead.announcementId, schoolAnnouncement.id), eq(announcementRead.userId, userId)),
    )
    .where(
      and(
        eq(schoolAnnouncement.schoolId, schoolId),
        isNull(schoolAnnouncement.deletedAt),
        visibility,
        isNull(announcementRead.id),
      ),
    )
  return row?.n ?? 0
}

/** Turmas dos filhos (PARENT) ou do próprio aluno (STUDENT) com matrícula ativa. */
async function familyClassIds(schoolId: string, role: 'PARENT' | 'STUDENT', userId: string, email: string) {
  const ownsParent = and(
    eq(parent.schoolId, schoolId),
    isNull(parent.deletedAt),
    or(eq(parent.userId, userId), sql`lower(${parent.email}) = lower(${email})`),
  )
  const base = db
    .selectDistinct({ classId: enrollment.classId })
    .from(studentParent)
    .innerJoin(parent, eq(parent.id, studentParent.parentId))
    .innerJoin(student, and(eq(student.id, studentParent.studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt)))
    .innerJoin(
      enrollment,
      and(eq(enrollment.studentId, student.id), eq(enrollment.schoolId, schoolId), eq(enrollment.status, 'ACTIVE')),
    )

  const rows =
    role === 'PARENT'
      ? await base.where(and(ownsParent, isNull(parent.deletedAt)))
      : await base.where(
          and(
            or(eq(student.userId, userId), sql`lower(${student.email}) = lower(${email})`),
            isNull(parent.deletedAt),
          ),
        )
  return rows.map((r) => r.classId).filter((v): v is string => Boolean(v))
}

/** Notifica responsáveis da turma (aviso direcionado) ou de toda a escola (aviso geral). */
async function notifyAudience(schoolId: string, classId: string | null, msg: { title: string; body: string }) {
  const rows =
    classId
      ? await db
          .selectDistinct({ userId: parent.userId })
          .from(studentParent)
          .innerJoin(parent, eq(parent.id, studentParent.parentId))
          .innerJoin(
            student,
            and(eq(student.id, studentParent.studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt)),
          )
          .innerJoin(
            enrollment,
            and(
              eq(enrollment.studentId, student.id),
              eq(enrollment.schoolId, schoolId),
              eq(enrollment.classId, classId),
              eq(enrollment.status, 'ACTIVE'),
            ),
          )
          .where(and(eq(parent.schoolId, schoolId), isNull(parent.deletedAt), isNotNull(parent.userId)))
      : await db
          .select({ userId: parent.userId })
          .from(parent)
          .where(and(eq(parent.schoolId, schoolId), isNull(parent.deletedAt), isNotNull(parent.userId)))

  const recipients = [...new Set(rows.map((r) => r.userId).filter((v): v is string => Boolean(v)))]
  if (recipients.length === 0) return
  await db.insert(notification).values(
    recipients.map((uid) => ({
      userId: uid,
      schoolId,
      title: msg.title,
      body: msg.body,
      href: '/family',
    })),
  )
}
