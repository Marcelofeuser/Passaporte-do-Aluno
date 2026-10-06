'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { recordAudit } from '@/lib/audit'
import { db } from '@/lib/db'
import {
  academicYear,
  attendanceChange,
  attendanceRecord,
  attendanceSession,
  notification,
  school,
  schoolClass,
  studentAttendance,
} from '@/lib/db/schema'
import { ATTENDANCE_STATUS, isAttendanceStatus, isISODate, todayISO, type AttendanceStatus } from '@/lib/attendance'
import {
  getAttendanceSession,
  getGuardianRecipients,
  getRosterOn,
  getSessionRecords,
} from '@/lib/attendance-queries'
import { getClassSubjectForGrading, gradeScope } from '@/lib/grade-queries'
import { requireSchoolAction, runAction, UUID_RE } from '@/lib/school-action'
import type { ActionState } from '@/lib/validation'

const MIN_REASON = 5

function formatBR(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

export async function saveAttendance(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('attendance.save_failed', async () => {
    const { ctx, schoolId, userId } = await requireSchoolAction('school:manage_attendance')
    const scope = await gradeScope(schoolId, ctx.active?.role ?? null, userId, ctx.user.email)

    const classSubjectId = String(formData.get('classSubjectId') ?? '')
    const heldOn = String(formData.get('heldOn') ?? '')
    const lessons = Number(formData.get('lessons'))
    const term = Number(formData.get('term'))
    const content = String(formData.get('content') ?? '').trim().slice(0, 500) || null

    const fieldErrors: Record<string, string> = {}
    if (!UUID_RE.test(classSubjectId)) return { ok: false, message: 'Disciplina inválida.' }
    if (!isISODate(heldOn)) fieldErrors.heldOn = 'Informe a data da aula.'
    else if (heldOn > todayISO()) fieldErrors.heldOn = 'Não é possível registrar chamada em data futura.'
    if (!Number.isInteger(lessons) || lessons < 1 || lessons > 6) fieldErrors.lessons = 'Entre 1 e 6 aulas.'
    if (!Number.isInteger(term) || term < 1 || term > 4) fieldErrors.term = 'Bimestre inválido.'
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

    const cs = await getClassSubjectForGrading(schoolId, classSubjectId, scope)
    if (!cs) return { ok: false, message: 'Você não leciona esta disciplina nesta turma.' }

    const [year] = await db
      .select({ startsOn: academicYear.startsOn, endsOn: academicYear.endsOn })
      .from(schoolClass)
      .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
      .where(and(eq(schoolClass.id, cs.classId), eq(schoolClass.schoolId, schoolId)))
    if (year && (heldOn < year.startsOn || heldOn > year.endsOn)) {
      return { ok: false, fieldErrors: { heldOn: 'A data está fora do ano letivo da turma.' } }
    }

    const roster = await getRosterOn(schoolId, cs.classId, heldOn)
    if (roster.length === 0) return { ok: false, message: 'Nenhum aluno matriculado nesta turma na data.' }

    const statuses = new Map<string, AttendanceStatus>()
    for (const r of roster) {
      const raw = formData.get(`status_${r.studentId}`)
      if (!isAttendanceStatus(raw)) return { ok: false, message: `Marque a situação de ${r.fullName}.` }
      statuses.set(r.studentId, raw)
    }

    const existing = await getAttendanceSession(schoolId, cs.id, heldOn)
    const previous = existing ? await getSessionRecords(schoolId, existing.id) : []
    const prevByStudent = new Map(previous.map((p) => [p.studentId, p]))

    const changes: { recordId: string; studentId: string; old: string; next: AttendanceStatus; reason: string }[] = []
    const sessionChanged =
      existing && (existing.lessons !== lessons || existing.term !== term) ? true : false
    for (const r of roster) {
      const prev = prevByStudent.get(r.studentId)
      const next = statuses.get(r.studentId)!
      if (prev && prev.status !== next) {
        const reason = String(formData.get(`reason_${r.studentId}`) ?? '').trim()
        if (reason.length < MIN_REASON) {
          fieldErrors[`reason_${r.studentId}`] = 'Justifique a alteração (mín. 5 caracteres).'
        }
        changes.push({ recordId: prev.id, studentId: r.studentId, old: prev.status, next, reason: reason.slice(0, 300) })
      }
    }
    let sessionReason = ''
    if (sessionChanged) {
      sessionReason = String(formData.get('sessionReason') ?? '').trim()
      if (sessionReason.length < MIN_REASON) fieldErrors.sessionReason = 'Justifique a alteração de aulas/bimestre.'
    }
    if (Object.keys(fieldErrors).length) {
      return { ok: false, fieldErrors, message: 'Alterações em chamada já registrada exigem justificativa.' }
    }

    const newAbsences: { studentId: string; status: AttendanceStatus }[] = []

    const sessionId = await db.transaction(async (tx) => {
      let id = existing?.id
      if (!id) {
        const [row] = await tx
          .insert(attendanceSession)
          .values({
            schoolId,
            classSubjectId: cs.id,
            classId: cs.classId,
            subjectId: cs.subjectId,
            teacherId: cs.teacherId,
            heldOn,
            lessons,
            term,
            content,
            createdBy: userId,
          })
          .returning({ id: attendanceSession.id })
        id = row.id
      } else {
        await tx
          .update(attendanceSession)
          .set({ lessons, term, content, updatedAt: new Date() })
          .where(and(eq(attendanceSession.id, id), eq(attendanceSession.schoolId, schoolId)))
      }

      const toInsert = roster
        .filter((r) => !prevByStudent.has(r.studentId))
        .map((r) => ({
          schoolId,
          sessionId: id!,
          studentId: r.studentId,
          enrollmentId: r.enrollmentId,
          status: statuses.get(r.studentId)!,
          updatedBy: userId,
        }))
      if (toInsert.length) await tx.insert(attendanceRecord).values(toInsert).onConflictDoNothing()
      for (const r of toInsert) {
        if (r.status === 'ABSENT' || r.status === 'LATE') newAbsences.push({ studentId: r.studentId, status: r.status })
      }

      for (const c of changes) {
        await tx
          .update(attendanceRecord)
          .set({ status: c.next, updatedBy: userId, updatedAt: new Date() })
          .where(and(eq(attendanceRecord.id, c.recordId), eq(attendanceRecord.schoolId, schoolId)))
        await tx.insert(attendanceChange).values({
          schoolId,
          recordId: c.recordId,
          oldStatus: c.old,
          newStatus: c.next,
          reason: c.reason,
          changedBy: userId,
        })
        if (c.next === 'ABSENT' || c.next === 'LATE') newAbsences.push({ studentId: c.studentId, status: c.next })
      }
      return id!
    })

    if (newAbsences.length) {
      const recipients = await getGuardianRecipients(schoolId, newAbsences.map((a) => a.studentId))
      const names = new Map(roster.map((r) => [r.studentId, r.socialName || r.fullName]))
      const rows = newAbsences.flatMap((a) =>
        (recipients.get(a.studentId) ?? []).map((uid) => ({
          userId: uid,
          schoolId,
          title: `${ATTENDANCE_STATUS[a.status]} registrada: ${names.get(a.studentId)}`,
          body: `${cs.subjectName} · ${cs.className} · ${formatBR(heldOn)}`,
          href: `/family?student=${a.studentId}`,
        })),
      )
      if (rows.length) await db.insert(notification).values(rows)
    }

    await recordAudit({
      action: existing ? 'attendance.updated' : 'attendance.created',
      entityType: 'attendance_session',
      entityId: sessionId,
      schoolId,
      actorUserId: userId,
      metadata: {
        classSubjectId: cs.id,
        heldOn,
        lessons,
        term,
        students: roster.length,
        changes: changes.map((c) => ({ studentId: c.studentId, from: c.old, to: c.next, reason: c.reason })),
        ...(sessionChanged ? { sessionReason, previous: { lessons: existing!.lessons, term: existing!.term } } : {}),
      },
    })

    revalidatePath(`/school/attendance/${cs.id}`)
    return {
      ok: true,
      message: existing
        ? changes.length
          ? `Chamada atualizada (${changes.length} alteração(ões) registrada(s)).`
          : 'Chamada salva.'
        : 'Chamada registrada.',
    }
  })
}

export async function updateAttendanceSettings(_: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('attendance.settings_failed', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:manage_settings')
    const minAttendance = Number(formData.get('minAttendance'))
    const lateThreshold = Number(formData.get('lateThreshold'))
    const fieldErrors: Record<string, string> = {}
    if (!Number.isInteger(minAttendance) || minAttendance < 50 || minAttendance > 100) {
      fieldErrors.minAttendance = 'Entre 50% e 100%.'
    }
    if (!Number.isInteger(lateThreshold) || lateThreshold < 1 || lateThreshold > 30) {
      fieldErrors.lateThreshold = 'Entre 1 e 30.'
    }
    if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }

    await db.update(school).set({ minAttendance, lateAlertThreshold: lateThreshold }).where(eq(school.id, schoolId))
    await recordAudit({
      action: 'school.attendance_settings_updated',
      entityType: 'school',
      entityId: schoolId,
      schoolId,
      actorUserId: userId,
      metadata: { minAttendance, lateThreshold },
    })
    revalidatePath('/school/settings')
    revalidatePath('/school/attendance')
    return { ok: true, message: 'Critérios de frequência salvos.' }
  })
}

export type AttendanceStatusValue = 'present' | 'absent' | 'justified' | 'late'

export interface AttendanceInput {
  schoolId: string
  studentId: string
  classId?: string
  date: string
  status: AttendanceStatusValue
  notes?: string
}

export interface BatchAttendanceInput {
  schoolId: string
  classId?: string
  date: string
  records: Array<{
    studentId: string
    status: AttendanceStatusValue
    notes?: string
  }>
}

/**
 * Registra ou atualiza a assiduidade individual ou em lote para uma turma/data (Fase 11).
 */
export async function recordAttendance(data: AttendanceInput | BatchAttendanceInput) {
  try {
    if (!data.schoolId || !data.date) {
      return { success: false, error: 'Escola e data são obrigatórias para registro de frequência.' }
    }

    // Se for lote
    if ('records' in data && Array.isArray(data.records)) {
      if (data.records.length === 0) {
        return { success: false, error: 'Nenhum aluno informado no lote.' }
      }

      await db.transaction(async (tx) => {
        for (const item of data.records) {
          const [existing] = await tx
            .select({ id: studentAttendance.id })
            .from(studentAttendance)
            .where(
              and(
                eq(studentAttendance.schoolId, data.schoolId),
                eq(studentAttendance.studentId, item.studentId),
                eq(studentAttendance.date, data.date),
              ),
            )

          if (existing) {
            await tx
              .update(studentAttendance)
              .set({
                status: item.status,
                classId: data.classId || null,
                notes: item.notes || null,
                updatedAt: new Date(),
              })
              .where(eq(studentAttendance.id, existing.id))
          } else {
            await tx.insert(studentAttendance).values({
              schoolId: data.schoolId,
              studentId: item.studentId,
              classId: data.classId || null,
              date: data.date,
              status: item.status,
              notes: item.notes || null,
            })
          }
        }
      })

      revalidatePath('/school/attendance')
      return { success: true, count: data.records.length }
    }

    // Se for individual
    const single = data as AttendanceInput
    if (!single.studentId) {
      return { success: false, error: 'Aluno é obrigatório.' }
    }

    const [existing] = await db
      .select({ id: studentAttendance.id })
      .from(studentAttendance)
      .where(
        and(
          eq(studentAttendance.schoolId, single.schoolId),
          eq(studentAttendance.studentId, single.studentId),
          eq(studentAttendance.date, single.date),
        ),
      )

    let record
    if (existing) {
      const [updated] = await db
        .update(studentAttendance)
        .set({
          status: single.status,
          classId: single.classId || null,
          notes: single.notes || null,
          updatedAt: new Date(),
        })
        .where(eq(studentAttendance.id, existing.id))
        .returning()
      record = updated
    } else {
      const [inserted] = await db
        .insert(studentAttendance)
        .values({
          schoolId: single.schoolId,
          studentId: single.studentId,
          classId: single.classId || null,
          date: single.date,
          status: single.status,
          notes: single.notes || null,
        })
        .returning()
      record = inserted
    }

    revalidatePath('/school/attendance')
    return { success: true, data: record }
  } catch (error: any) {
    console.error('Erro ao registrar frequência:', error)
    return { success: false, error: error.message || 'Erro ao registrar frequência.' }
  }
}

/**
 * Retorna o resumo de presenças, faltas e taxa de assiduidade do aluno (Fase 11).
 */
export async function getStudentAttendanceSummary(studentId: string, schoolId: string) {
  try {
    if (!studentId || !schoolId) {
      return { success: false, error: 'studentId e schoolId são obrigatórios.' }
    }

    const records = await db
      .select({
        id: studentAttendance.id,
        status: studentAttendance.status,
        date: studentAttendance.date,
        notes: studentAttendance.notes,
        classId: studentAttendance.classId,
      })
      .from(studentAttendance)
      .where(and(eq(studentAttendance.schoolId, schoolId), eq(studentAttendance.studentId, studentId)))

    const total = records.length
    const present = records.filter((r) => r.status === 'present').length
    const absent = records.filter((r) => r.status === 'absent').length
    const justified = records.filter((r) => r.status === 'justified').length
    const late = records.filter((r) => r.status === 'late').length

    const attendanceRate = total > 0 ? Math.round(((present + late) / total) * 100) : 100

    return {
      success: true,
      summary: {
        total,
        present,
        absent,
        justified,
        late,
        attendanceRate,
      },
      records,
    }
  } catch (error: any) {
    console.error('Erro ao buscar resumo de assiduidade:', error)
    return { success: false, error: error.message || 'Erro ao buscar resumo de assiduidade.' }
  }
}

/**
 * Server Action auxiliar para formulários de lançamento rápido de frequência.
 */
export async function submitQuickAttendanceAction(formData: FormData): Promise<void> {
  const schoolId = String(formData.get('schoolId') ?? '')
  const studentId = String(formData.get('studentId') ?? '')
  const classId = String(formData.get('classId') ?? '') || undefined
  const date = String(formData.get('date') ?? '') || todayISO()
  const status = (String(formData.get('status') ?? 'present')) as AttendanceStatusValue
  const notes = String(formData.get('notes') ?? '').trim() || undefined

  if (!schoolId || !studentId) {
    return
  }

  await recordAttendance({
    schoolId,
    studentId,
    classId,
    date,
    status,
    notes,
  })
}

