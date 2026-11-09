'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { recordAudit } from '@/lib/audit'
import { achievementInput } from '@/lib/achievements'
import { db } from '@/lib/db'
import { student, studentAchievement } from '@/lib/db/schema'
import { can } from '@/lib/rbac'
import { isCurrentPassportStudent } from '@/lib/student-passport-access'
import { requireActionContext, AuthorizationError } from '@/lib/session'
import { runAction, UUID_RE } from '@/lib/school-action'
import { DOCUMENT_TYPES, getUploadedFile, removeStoredFile, storeSchoolFile, UploadError } from '@/lib/storage'
import type { ActionState } from '@/lib/validation'
import { teacherCanRecordAchievement } from '@/lib/achievement-queries'

export async function createAchievement(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('achievement.create_failed', async () => {
    const ctx = await requireActionContext()
    const role = ctx.active?.role
    const schoolId = ctx.active?.schoolId
    const userId = ctx.user.id
    const studentId = String(formData.get('studentId') ?? '')
    if (!UUID_RE.test(studentId) || !schoolId) return { ok: false, message: 'Aluno ou escola inválidos.' }

    const parsed = achievementInput.safeParse({
      category: String(formData.get('category') ?? ''),
      title: String(formData.get('title') ?? ''),
      description: String(formData.get('description') ?? ''),
      achievedOn: String(formData.get('achievedOn') ?? ''),
    })
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? 'form')
        if (!fieldErrors[key]) fieldErrors[key] = issue.message
      }
      return { ok: false, fieldErrors }
    }

    if (role === 'STUDENT') {
      const [owned] = await db
        .select({ id: student.id })
        .from(student)
        .where(and(eq(student.id, studentId), eq(student.schoolId, schoolId), eq(student.userId, userId), isNull(student.deletedAt)))
        .limit(1)
      if (!owned) return { ok: false, message: 'Você só pode registrar conquistas no seu próprio passaporte.' }
    } else {
      if (!can(role, 'school:manage_achievements')) {
        throw new AuthorizationError('Seu perfil não pode registrar conquistas.')
      }
      if (role === 'TEACHER' && !(await teacherCanRecordAchievement(schoolId, studentId, userId))) {
        return { ok: false, message: 'Este aluno não está em uma turma atribuída a você.' }
      }
    }

    if (!(await isCurrentPassportStudent(schoolId, studentId))) {
      return { ok: false, message: 'Este aluno não está sob responsabilidade atual da escola.' }
    }
    const [localStudent] = await db
      .select({ passportId: student.passportId })
      .from(student)
      .where(and(eq(student.id, studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt)))
      .limit(1)
    if (!localStudent) return { ok: false, message: 'Cadastro do aluno não encontrado.' }

    const file = getUploadedFile(formData, 'evidence')
    let stored: Awaited<ReturnType<typeof storeSchoolFile>> | null = null
    if (file) {
      try {
        stored = await storeSchoolFile(file, {
          schoolId,
          folder: `achievements/${studentId}`,
          allowed: DOCUMENT_TYPES,
          maxBytes: 10 * 1024 * 1024,
        })
      } catch (error) {
        if (error instanceof UploadError) return { ok: false, fieldErrors: { evidence: error.message } }
        throw error
      }
    }

    try {
      if (!(await isCurrentPassportStudent(schoolId, studentId))) {
        if (stored) await removeStoredFile(stored.pathname)
        return { ok: false, message: 'A escola deixou de ser responsável pelo aluno. Atualize a página.' }
      }
      const [created] = await db
        .insert(studentAchievement)
        .values({
          schoolId,
          studentId,
          passportId: localStudent.passportId,
          category: parsed.data.category,
          title: parsed.data.title,
          description: parsed.data.description,
          achievedOn: parsed.data.achievedOn,
          evidencePathname: stored?.pathname ?? null,
          evidenceContentType: stored?.contentType ?? null,
          evidenceSizeBytes: stored?.size ?? null,
          recordedByUserId: userId,
        })
        .returning({ id: studentAchievement.id })

      await recordAudit({
        action: 'student_achievement.created',
        entityType: 'student',
        entityId: studentId,
        schoolId,
        actorUserId: userId,
        metadata: { achievementId: created.id, category: parsed.data.category, hasEvidence: Boolean(stored) },
      })
    } catch (error) {
      if (stored) await removeStoredFile(stored.pathname)
      throw error
    }

    revalidatePath('/school/achievements')
    revalidatePath('/family/achievements')
    revalidatePath(`/school/students/${studentId}`)
    return { ok: true, message: 'Conquista registrada no passaporte.' }
  })
}
