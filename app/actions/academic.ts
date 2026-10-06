'use server'

import { and, eq, ilike, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import { academicYear, classSubject, schoolClass, subject, teacher, teacherSubject } from '@/lib/db/schema'
import { requireSchoolAction, runAction, runVoidAction, UUID_RE } from '@/lib/school-action'
import {
  academicYearInput,
  classInput,
  classSubjectInput,
  formText,
  subjectInput,
  teacherInput,
  teacherSubjectInput,
  toFieldErrors,
  type ActionState,
} from '@/lib/validation'

const MANAGE = 'school:manage_academic' as const

async function owns(table: typeof teacher | typeof subject | typeof schoolClass | typeof academicYear, id: string, schoolId: string) {
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.schoolId, schoolId), isNull(table.deletedAt)))
  return Boolean(row)
}

/* ---------- Professores ---------- */

export async function createTeacher(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('teacher.create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = teacherInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const [row] = await db.insert(teacher).values({ ...parsed.data, schoolId }).returning({ id: teacher.id })
    await recordAudit({ action: 'teacher.created', entityType: 'teacher', entityId: row.id, schoolId, actorUserId: userId })
    revalidatePath('/school/teachers')
    return { ok: true, message: 'Professor cadastrado.' }
  })
}

export async function archiveTeacher(formData: FormData) {
  await runVoidAction('teacher.archive_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const teacherId = String(formData.get('teacherId') ?? '')
    if (!UUID_RE.test(teacherId) || !(await owns(teacher, teacherId, schoolId))) return
    await db.update(teacher).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(teacher.id, teacherId))
    await db.update(classSubject).set({ teacherId: null }).where(and(eq(classSubject.teacherId, teacherId), eq(classSubject.schoolId, schoolId)))
    await db.update(schoolClass).set({ homeroomTeacherId: null }).where(and(eq(schoolClass.homeroomTeacherId, teacherId), eq(schoolClass.schoolId, schoolId)))
    await recordAudit({ action: 'teacher.archived', entityType: 'teacher', entityId: teacherId, schoolId, actorUserId: userId })
  })
  revalidatePath('/school', 'layout')
}

export async function assignTeacherSubject(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('teacher_subject.assign_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = teacherSubjectInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const { teacherId, subjectId } = parsed.data
    if (!(await owns(teacher, teacherId, schoolId)) || !(await owns(subject, subjectId, schoolId))) {
      return { ok: false, message: 'Professor ou disciplina inválidos.' }
    }
    await db.insert(teacherSubject).values({ teacherId, subjectId, schoolId }).onConflictDoNothing()
    await recordAudit({
      action: 'teacher_subject.assigned',
      entityType: 'teacher',
      entityId: teacherId,
      schoolId,
      actorUserId: userId,
      metadata: { subjectId },
    })
    revalidatePath('/school/teachers')
    return { ok: true, message: 'Disciplina atribuída.' }
  })
}

export async function removeTeacherSubject(formData: FormData) {
  await runVoidAction('teacher_subject.remove_failed', async () => {
    const { schoolId } = await requireSchoolAction(MANAGE)
    const teacherId = String(formData.get('teacherId') ?? '')
    const subjectId = String(formData.get('subjectId') ?? '')
    if (!UUID_RE.test(teacherId) || !UUID_RE.test(subjectId)) return
    await db
      .delete(teacherSubject)
      .where(and(eq(teacherSubject.teacherId, teacherId), eq(teacherSubject.subjectId, subjectId), eq(teacherSubject.schoolId, schoolId)))
  })
  revalidatePath('/school/teachers')
}

/* ---------- Disciplinas ---------- */

export async function createSubject(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('subject.create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = subjectInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const [dup] = await db
      .select({ id: subject.id })
      .from(subject)
      .where(and(eq(subject.schoolId, schoolId), ilike(subject.name, parsed.data.name), isNull(subject.deletedAt)))
    if (dup) return { ok: false, fieldErrors: { name: 'Já existe uma disciplina com este nome.' } }
    const [row] = await db.insert(subject).values({ ...parsed.data, schoolId }).returning({ id: subject.id })
    await recordAudit({ action: 'subject.created', entityType: 'subject', entityId: row.id, schoolId, actorUserId: userId })
    revalidatePath('/school/subjects')
    return { ok: true, message: 'Disciplina criada.' }
  })
}

export async function archiveSubject(formData: FormData) {
  await runVoidAction('subject.archive_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const subjectId = String(formData.get('subjectId') ?? '')
    if (!UUID_RE.test(subjectId) || !(await owns(subject, subjectId, schoolId))) return
    await db.update(subject).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(subject.id, subjectId))
    await recordAudit({ action: 'subject.archived', entityType: 'subject', entityId: subjectId, schoolId, actorUserId: userId })
  })
  revalidatePath('/school', 'layout')
}

/* ---------- Anos letivos ---------- */

export async function createAcademicYear(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('academic_year.create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = academicYearInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const { year, startsOn, endsOn, isCurrent } = parsed.data
    const [dup] = await db
      .select({ id: academicYear.id })
      .from(academicYear)
      .where(and(eq(academicYear.schoolId, schoolId), eq(academicYear.year, year), isNull(academicYear.deletedAt)))
    if (dup) return { ok: false, fieldErrors: { year: 'Este ano letivo já existe.' } }

    const id = await db.transaction(async (tx) => {
      if (isCurrent) await tx.update(academicYear).set({ isCurrent: false }).where(eq(academicYear.schoolId, schoolId))
      const [row] = await tx
        .insert(academicYear)
        .values({ schoolId, year, startsOn, endsOn, isCurrent })
        .returning({ id: academicYear.id })
      return row.id
    })
    await recordAudit({ action: 'academic_year.created', entityType: 'academic_year', entityId: id, schoolId, actorUserId: userId, metadata: { year } })
    revalidatePath('/school', 'layout')
    return { ok: true, message: `Ano letivo ${year} criado.` }
  })
}

export async function setCurrentAcademicYear(formData: FormData) {
  await runVoidAction('academic_year.set_current_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const yearId = String(formData.get('academicYearId') ?? '')
    if (!UUID_RE.test(yearId) || !(await owns(academicYear, yearId, schoolId))) return
    await db.transaction(async (tx) => {
      await tx.update(academicYear).set({ isCurrent: false }).where(eq(academicYear.schoolId, schoolId))
      await tx.update(academicYear).set({ isCurrent: true, updatedAt: new Date() }).where(eq(academicYear.id, yearId))
    })
    await recordAudit({ action: 'academic_year.set_current', entityType: 'academic_year', entityId: yearId, schoolId, actorUserId: userId })
  })
  revalidatePath('/school', 'layout')
}

/* ---------- Turmas ---------- */

export async function createClass(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('class.create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = classInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const data = parsed.data
    if (!(await owns(academicYear, data.academicYearId, schoolId))) {
      return { ok: false, fieldErrors: { academicYearId: 'Ano letivo inválido.' } }
    }
    if (data.homeroomTeacherId && !(await owns(teacher, data.homeroomTeacherId, schoolId))) {
      return { ok: false, fieldErrors: { homeroomTeacherId: 'Professor inválido.' } }
    }
    const [dup] = await db
      .select({ id: schoolClass.id })
      .from(schoolClass)
      .where(
        and(
          eq(schoolClass.schoolId, schoolId),
          eq(schoolClass.academicYearId, data.academicYearId),
          ilike(schoolClass.name, data.name),
          isNull(schoolClass.deletedAt),
        ),
      )
    if (dup) return { ok: false, fieldErrors: { name: 'Já existe uma turma com este nome neste ano.' } }

    const [row] = await db
      .insert(schoolClass)
      .values({ ...data, homeroomTeacherId: data.homeroomTeacherId ?? null, schoolId })
      .returning({ id: schoolClass.id })
    await recordAudit({ action: 'class.created', entityType: 'class', entityId: row.id, schoolId, actorUserId: userId })
    revalidatePath('/school/classes')
    return { ok: true, message: 'Turma criada.' }
  })
}

export async function archiveClass(formData: FormData) {
  await runVoidAction('class.archive_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const classId = String(formData.get('classId') ?? '')
    if (!UUID_RE.test(classId) || !(await owns(schoolClass, classId, schoolId))) return
    await db.update(schoolClass).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(schoolClass.id, classId))
    await recordAudit({ action: 'class.archived', entityType: 'class', entityId: classId, schoolId, actorUserId: userId })
  })
  revalidatePath('/school/classes')
}

export async function addClassSubject(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('class_subject.add_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = classSubjectInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const { classId, subjectId, teacherId } = parsed.data
    if (!(await owns(schoolClass, classId, schoolId)) || !(await owns(subject, subjectId, schoolId))) {
      return { ok: false, message: 'Turma ou disciplina inválida.' }
    }
    if (teacherId && !(await owns(teacher, teacherId, schoolId))) {
      return { ok: false, fieldErrors: { teacherId: 'Professor inválido.' } }
    }
    const [existing] = await db
      .select({ id: classSubject.id })
      .from(classSubject)
      .where(and(eq(classSubject.classId, classId), eq(classSubject.subjectId, subjectId)))
    if (existing) {
      await db.update(classSubject).set({ teacherId: teacherId ?? null }).where(eq(classSubject.id, existing.id))
    } else {
      await db.insert(classSubject).values({ schoolId, classId, subjectId, teacherId: teacherId ?? null })
    }
    if (teacherId) await db.insert(teacherSubject).values({ teacherId, subjectId, schoolId }).onConflictDoNothing()

    await recordAudit({
      action: existing ? 'class_subject.updated' : 'class_subject.added',
      entityType: 'class',
      entityId: classId,
      schoolId,
      actorUserId: userId,
      metadata: { subjectId, teacherId: teacherId ?? null },
    })
    revalidatePath(`/school/classes/${classId}`)
    return { ok: true, message: existing ? 'Professor da disciplina atualizado.' : 'Disciplina adicionada à turma.' }
  })
}

export async function removeClassSubject(formData: FormData) {
  const classId = String(formData.get('classId') ?? '')
  await runVoidAction('class_subject.remove_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const id = String(formData.get('classSubjectId') ?? '')
    if (!UUID_RE.test(id)) return
    const removed = await db
      .delete(classSubject)
      .where(and(eq(classSubject.id, id), eq(classSubject.schoolId, schoolId)))
      .returning({ classId: classSubject.classId })
    if (removed[0]) {
      await recordAudit({ action: 'class_subject.removed', entityType: 'class', entityId: removed[0].classId, schoolId, actorUserId: userId })
    }
  })
  if (UUID_RE.test(classId)) revalidatePath(`/school/classes/${classId}`)
}
