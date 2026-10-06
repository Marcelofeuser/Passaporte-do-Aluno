'use server'

import { and, eq, isNull, ne } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import {
  academicYear,
  enrollment,
  parent,
  schoolClass,
  student,
  studentDocument,
  studentParent,
} from '@/lib/db/schema'
import { requireSchoolAction, runAction, runVoidAction, UUID_RE } from '@/lib/school-action'
import {
  DOCUMENT_TYPES,
  IMAGE_TYPES,
  getUploadedFile,
  removeStoredFile,
  storeSchoolFile,
  UploadError,
} from '@/lib/storage'
import {
  DOCUMENT_KINDS,
  documentInput,
  enrollmentInput,
  enrollmentStatusInput,
  formText,
  parentInput,
  studentInput,
  toFieldErrors,
  type ActionState,
} from '@/lib/validation'

const MANAGE = 'school:manage_academic' as const

async function assertStudent(schoolId: string, studentId: string) {
  const [row] = await db
    .select({ id: student.id, photoPathname: student.photoPathname })
    .from(student)
    .where(and(eq(student.id, studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt)))
  return row ?? null
}

async function registrationTaken(schoolId: string, code: string | null | undefined, exceptId?: string) {
  if (!code) return false
  const filters = [eq(student.schoolId, schoolId), eq(student.registrationCode, code), isNull(student.deletedAt)]
  if (exceptId) filters.push(ne(student.id, exceptId))
  const [row] = await db.select({ id: student.id }).from(student).where(and(...filters)).limit(1)
  return Boolean(row)
}

export async function createStudent(_: ActionState, formData: FormData): Promise<ActionState> {
  let createdId: string | null = null
  const result = await runAction('student.create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = studentInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    if (await registrationTaken(schoolId, parsed.data.registrationCode)) {
      return { ok: false, fieldErrors: { registrationCode: 'Já existe um aluno com esta matrícula.' } }
    }

    const [row] = await db
      .insert(student)
      .values({ ...parsed.data, schoolId })
      .returning({ id: student.id })
    createdId = row.id

    await recordAudit({ action: 'student.created', entityType: 'student', entityId: row.id, schoolId, actorUserId: userId })
    revalidatePath('/school/students')
    return { ok: true, message: 'Aluno cadastrado.' }
  })
  if (createdId) redirect(`/school/students/${createdId}`)
  return result
}

export async function updateStudent(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('student.update_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const studentId = String(formData.get('studentId') ?? '')
    if (!UUID_RE.test(studentId)) return { ok: false, message: 'Aluno inválido.' }
    const existing = await assertStudent(schoolId, studentId)
    if (!existing) return { ok: false, message: 'Aluno não encontrado.' }

    const parsed = studentInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    if (await registrationTaken(schoolId, parsed.data.registrationCode, studentId)) {
      return { ok: false, fieldErrors: { registrationCode: 'Já existe um aluno com esta matrícula.' } }
    }

    let photoPathname = existing.photoPathname
    const photo = getUploadedFile(formData, 'photo')
    if (photo) {
      try {
        photoPathname = (
          await storeSchoolFile(photo, { schoolId, folder: 'students/photos', allowed: IMAGE_TYPES, maxBytes: 3 * 1024 * 1024 })
        ).pathname
      } catch (e) {
        if (e instanceof UploadError) return { ok: false, fieldErrors: { photo: e.message } }
        throw e
      }
    }

    await db
      .update(student)
      .set({ ...parsed.data, photoPathname, updatedAt: new Date() })
      .where(and(eq(student.id, studentId), eq(student.schoolId, schoolId)))
    if (photo && existing.photoPathname) await removeStoredFile(existing.photoPathname)

    await recordAudit({
      action: 'student.updated',
      entityType: 'student',
      entityId: studentId,
      schoolId,
      actorUserId: userId,
      metadata: { photoChanged: Boolean(photo) },
    })
    revalidatePath(`/school/students/${studentId}`)
    revalidatePath('/school/students')
    return { ok: true, message: 'Dados do aluno salvos.' }
  })
}

export async function archiveStudent(formData: FormData) {
  let done = false
  await runVoidAction('student.archive_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const studentId = String(formData.get('studentId') ?? '')
    if (!UUID_RE.test(studentId)) return
    const updated = await db
      .update(student)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(student.id, studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt)))
      .returning({ id: student.id })
    if (updated.length === 0) return
    await db
      .update(enrollment)
      .set({ status: 'CANCELLED', statusChangedOn: today(), statusNote: 'Aluno arquivado', updatedAt: new Date() })
      .where(and(eq(enrollment.studentId, studentId), eq(enrollment.schoolId, schoolId), eq(enrollment.status, 'ACTIVE')))
    await recordAudit({ action: 'student.archived', entityType: 'student', entityId: studentId, schoolId, actorUserId: userId })
    done = true
  })
  revalidatePath('/school/students')
  if (done) redirect('/school/students')
}

/* ---------- Responsáveis ---------- */

export async function addParent(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('parent.create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = parentInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const { studentId, relationship, ...data } = parsed.data
    if (!(await assertStudent(schoolId, studentId))) return { ok: false, message: 'Aluno não encontrado.' }

    // Reaproveita responsável já cadastrado na escola (mesmo CPF ou e-mail), ex.: irmãos.
    let parentId: string | null = null
    const matchBy = data.cpf ? eq(parent.cpf, data.cpf) : data.email ? eq(parent.email, data.email) : null
    if (matchBy) {
      const [found] = await db
        .select({ id: parent.id })
        .from(parent)
        .where(and(eq(parent.schoolId, schoolId), isNull(parent.deletedAt), matchBy))
        .limit(1)
      parentId = found?.id ?? null
    }
    if (!parentId) {
      const [row] = await db.insert(parent).values({ ...data, schoolId }).returning({ id: parent.id })
      parentId = row.id
    }

    await db.insert(studentParent).values({ studentId, parentId, relationship }).onConflictDoNothing()
    await recordAudit({
      action: 'parent.linked',
      entityType: 'student',
      entityId: studentId,
      schoolId,
      actorUserId: userId,
      metadata: { parentId, relationship },
    })
    revalidatePath(`/school/students/${studentId}`)
    return { ok: true, message: 'Responsável vinculado.' }
  })
}

export async function unlinkParent(formData: FormData) {
  const studentId = String(formData.get('studentId') ?? '')
  const parentId = String(formData.get('parentId') ?? '')
  await runVoidAction('parent.unlink_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    if (!UUID_RE.test(studentId) || !UUID_RE.test(parentId)) return
    if (!(await assertStudent(schoolId, studentId))) return
    await db.delete(studentParent).where(and(eq(studentParent.studentId, studentId), eq(studentParent.parentId, parentId)))
    await recordAudit({
      action: 'parent.unlinked',
      entityType: 'student',
      entityId: studentId,
      schoolId,
      actorUserId: userId,
      metadata: { parentId },
    })
  })
  revalidatePath(`/school/students/${studentId}`)
}

/* ---------- Matrícula ---------- */

const today = () => new Date().toISOString().slice(0, 10)

/** Encerra uma matrícula ativa como transferida (saiu da escola), concluída ou cancelada. */
export async function changeEnrollmentStatus(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('enrollment.status_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = enrollmentStatusInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const { enrollmentId, status, changedOn, note } = parsed.data

    const [row] = await db
      .update(enrollment)
      .set({ status, statusChangedOn: changedOn ?? today(), statusNote: note ?? null, updatedAt: new Date() })
      .where(and(eq(enrollment.id, enrollmentId), eq(enrollment.schoolId, schoolId), eq(enrollment.status, 'ACTIVE')))
      .returning({ studentId: enrollment.studentId, classId: enrollment.classId })
    if (!row) return { ok: false, message: 'Matrícula ativa não encontrada.' }

    await recordAudit({
      action: 'enrollment.status_changed',
      entityType: 'student',
      entityId: row.studentId,
      schoolId,
      actorUserId: userId,
      metadata: { enrollmentId, from: 'ACTIVE', to: status, note: note ?? null },
    })
    revalidatePath(`/school/students/${row.studentId}`)
    if (row.classId) revalidatePath(`/school/classes/${row.classId}`)
    return { ok: true, message: 'Situação da matrícula atualizada.' }
  })
}

export async function enrollStudent(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('enrollment.create_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = enrollmentInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const { studentId, classId, enrolledOn } = parsed.data
    if (!(await assertStudent(schoolId, studentId))) return { ok: false, message: 'Aluno não encontrado.' }

    const [cls] = await db
      .select({ id: schoolClass.id, grade: schoolClass.grade, academicYearId: schoolClass.academicYearId, capacity: schoolClass.capacity })
      .from(schoolClass)
      .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
      .where(and(eq(schoolClass.id, classId), eq(schoolClass.schoolId, schoolId), isNull(schoolClass.deletedAt)))
    if (!cls) return { ok: false, fieldErrors: { classId: 'Turma não encontrada.' } }

    if (cls.capacity) {
      const active = await db
        .select({ id: enrollment.id })
        .from(enrollment)
        .where(and(eq(enrollment.classId, classId), eq(enrollment.status, 'ACTIVE')))
      if (active.length >= cls.capacity) return { ok: false, fieldErrors: { classId: 'Turma sem vagas.' } }
    }

    // Uma matrícula ativa por aluno por ano letivo: transfere se já houver.
    const [existing] = await db
      .select({ id: enrollment.id, classId: enrollment.classId })
      .from(enrollment)
      .where(
        and(
          eq(enrollment.schoolId, schoolId),
          eq(enrollment.studentId, studentId),
          eq(enrollment.academicYearId, cls.academicYearId),
          eq(enrollment.status, 'ACTIVE'),
        ),
      )
    if (existing?.classId === classId) return { ok: false, message: 'O aluno já está nesta turma.' }

    if (existing) {
      await db
        .update(enrollment)
        .set({ classId, grade: cls.grade, updatedAt: new Date() })
        .where(eq(enrollment.id, existing.id))
    } else {
      await db.insert(enrollment).values({
        schoolId,
        studentId,
        academicYearId: cls.academicYearId,
        classId,
        grade: cls.grade,
        ...(enrolledOn ? { enrolledOn } : {}),
      })
    }

    await recordAudit({
      action: existing ? 'enrollment.transferred' : 'enrollment.created',
      entityType: 'student',
      entityId: studentId,
      schoolId,
      actorUserId: userId,
      metadata: { classId, fromClassId: existing?.classId ?? null },
    })
    revalidatePath(`/school/students/${studentId}`)
    revalidatePath(`/school/classes/${classId}`)
    if (existing?.classId) revalidatePath(`/school/classes/${existing.classId}`)
    return { ok: true, message: existing ? 'Aluno transferido de turma.' : 'Matrícula realizada.' }
  })
}

export async function endEnrollment(formData: FormData) {
  const enrollmentId = String(formData.get('enrollmentId') ?? '')
  const returnTo = String(formData.get('returnTo') ?? '/school/students')
  await runVoidAction('enrollment.end_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    if (!UUID_RE.test(enrollmentId)) return
    const [row] = await db
      .update(enrollment)
      .set({ status: 'CANCELLED', statusChangedOn: today(), statusNote: 'Retirado da turma', updatedAt: new Date() })
      .where(and(eq(enrollment.id, enrollmentId), eq(enrollment.schoolId, schoolId), eq(enrollment.status, 'ACTIVE')))
      .returning({ studentId: enrollment.studentId })
    if (!row) return
    await recordAudit({
      action: 'enrollment.status_changed',
      entityType: 'student',
      entityId: row.studentId,
      schoolId,
      actorUserId: userId,
      metadata: { enrollmentId, from: 'ACTIVE', to: 'CANCELLED' },
    })
  })
  revalidatePath(returnTo.startsWith('/school/') ? returnTo : '/school/students')
}

/* ---------- Documentos ---------- */

export async function uploadStudentDocument(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('student_document.upload_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    const parsed = documentInput.safeParse(formText(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const { studentId, kind, label } = parsed.data
    if (!(await assertStudent(schoolId, studentId))) return { ok: false, message: 'Aluno não encontrado.' }

    const file = getUploadedFile(formData, 'file')
    if (!file) return { ok: false, fieldErrors: { file: 'Selecione um arquivo.' } }
    let stored
    try {
      stored = await storeSchoolFile(file, {
        schoolId,
        folder: `students/${studentId}/documents`,
        allowed: DOCUMENT_TYPES,
        maxBytes: 10 * 1024 * 1024,
      })
    } catch (e) {
      if (e instanceof UploadError) return { ok: false, fieldErrors: { file: e.message } }
      throw e
    }

    const [doc] = await db
      .insert(studentDocument)
      .values({
        schoolId,
        studentId,
        kind,
        label: label ?? DOCUMENT_KINDS[kind],
        pathname: stored.pathname,
        contentType: stored.contentType,
        sizeBytes: stored.size,
        uploadedBy: userId,
      })
      .returning({ id: studentDocument.id })

    await recordAudit({
      action: 'student_document.uploaded',
      entityType: 'student',
      entityId: studentId,
      schoolId,
      actorUserId: userId,
      metadata: { documentId: doc.id, kind },
    })
    revalidatePath(`/school/students/${studentId}`)
    return { ok: true, message: 'Documento enviado.' }
  })
}

export async function deleteStudentDocument(formData: FormData) {
  const documentId = String(formData.get('documentId') ?? '')
  let studentId = ''
  await runVoidAction('student_document.delete_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction(MANAGE)
    if (!UUID_RE.test(documentId)) return
    const [doc] = await db
      .update(studentDocument)
      .set({ deletedAt: new Date() })
      .where(
        and(eq(studentDocument.id, documentId), eq(studentDocument.schoolId, schoolId), isNull(studentDocument.deletedAt)),
      )
      .returning({ studentId: studentDocument.studentId, pathname: studentDocument.pathname })
    if (!doc) return
    studentId = doc.studentId
    await removeStoredFile(doc.pathname)
    await recordAudit({
      action: 'student_document.deleted',
      entityType: 'student',
      entityId: doc.studentId,
      schoolId,
      actorUserId: userId,
      metadata: { documentId },
    })
  })
  if (studentId) revalidatePath(`/school/students/${studentId}`)
}
