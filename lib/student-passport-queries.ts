import { and, asc, count, desc, eq, inArray, isNull, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  academicYear,
  assessment,
  assessmentScore,
  attendanceRecord,
  enrollment,
  school,
  schoolMembership,
  student,
  studentDocument,
  studentPassport,
  studentTransfer,
  subject,
} from '@/lib/db/schema'
import { fileUrl } from '@/lib/storage'
import { DOCUMENT_KINDS } from '@/lib/validation'

function formatHistoryDate(value: string | Date | null | undefined) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(`${value.slice(0, 10)}T00:00:00Z`)
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function dateOrder(value: string | Date | null | undefined) {
  if (!value) return 0
  return new Date(value instanceof Date ? value : `${value.slice(0, 10)}T00:00:00Z`).getTime()
}

function enrollmentLabel(value: string) {
  if (value === 'ACTIVE') return 'Ativa'
  if (value === 'TRANSFERRED') return 'Transferida'
  if (value === 'COMPLETED') return 'Concluída'
  if (value === 'CANCELLED') return 'Cancelada'
  return value
}

export async function listTransferSchools(currentSchoolId: string) {
  return db
    .selectDistinct({ id: school.id, name: school.name })
    .from(school)
    .innerJoin(schoolMembership, eq(schoolMembership.schoolId, school.id))
    .where(
      and(
        ne(school.id, currentSchoolId),
        isNull(school.deletedAt),
        isNull(schoolMembership.deletedAt),
        inArray(schoolMembership.role, ['SCHOOL_ADMIN', 'COORDINATOR']),
      ),
    )
    .orderBy(asc(school.name))
}

export async function getIncomingStudentTransfers(schoolId: string) {
  const rows = await db
    .select({
      id: studentTransfer.id,
      studentName: student.socialName,
      fullName: student.fullName,
      sourceSchoolName: school.name,
      requestedAt: studentTransfer.requestedAt,
    })
    .from(studentTransfer)
    .innerJoin(student, and(eq(student.id, studentTransfer.fromStudentId), eq(student.schoolId, studentTransfer.fromSchoolId)))
    .innerJoin(school, eq(school.id, studentTransfer.fromSchoolId))
    .where(and(eq(studentTransfer.toSchoolId, schoolId), eq(studentTransfer.status, 'PENDING')))
    .orderBy(desc(studentTransfer.requestedAt))
    .limit(100)

  return rows.map((row) => ({
    id: row.id,
    studentName: row.studentName ?? row.fullName,
    sourceSchoolName: row.sourceSchoolName,
    requestedAt: row.requestedAt,
  }))
}

export async function getStudentPassportHistory(
  schoolId: string,
  studentId: string,
  includeTransferSchools = false,
) {
  const [localProfile] = await db
    .select({ passportId: student.passportId })
    .from(student)
    .where(and(eq(student.id, studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt)))
    .limit(1)
  if (!localProfile?.passportId) return null

  const [passport] = await db
    .select()
    .from(studentPassport)
    .where(eq(studentPassport.id, localProfile.passportId))
    .limit(1)
  if (!passport) return null

  const isCurrentSchool = passport.currentSchoolId === schoolId && passport.currentStudentId === studentId
  const profiles = await db
    .select({
      id: student.id,
      schoolId: student.schoolId,
      createdAt: student.createdAt,
      schoolName: school.name,
    })
    .from(student)
    .innerJoin(school, eq(school.id, student.schoolId))
    .where(
      isCurrentSchool
        ? eq(student.passportId, localProfile.passportId)
        : and(eq(student.id, studentId), eq(student.schoolId, schoolId)),
    )
    .orderBy(asc(student.createdAt))

  const studentIds = profiles.map((profile) => profile.id)
  if (studentIds.length === 0) return null
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const recordsByStudent = new Map<string, Array<{ dateOrder: number; record: {
    id: string
    dateLabel: string
    category: string
    title: string
    summary?: string | null
    href?: string | null
    hrefLabel?: string
  } }>>()
  const addRecord = (
    localStudentId: string,
    record: {
      id: string
      dateLabel: string
      category: string
      title: string
      summary?: string | null
      href?: string | null
      hrefLabel?: string
    },
    orderValue: string | Date | null | undefined,
  ) => {
    const items = recordsByStudent.get(localStudentId) ?? []
    items.push({ dateOrder: dateOrder(orderValue), record })
    recordsByStudent.set(localStudentId, items)
  }

  const transferFilters = [eq(studentTransfer.passportId, localProfile.passportId), eq(studentTransfer.status, 'ACCEPTED')]
  if (!isCurrentSchool) transferFilters.push(eq(studentTransfer.fromSchoolId, schoolId))

  const [enrollments, documents, scores, attendanceCounts, transfers] = await Promise.all([
      db
        .select({
          id: enrollment.id,
          studentId: enrollment.studentId,
          enrolledOn: enrollment.enrolledOn,
          statusChangedOn: enrollment.statusChangedOn,
          statusNote: enrollment.statusNote,
          grade: enrollment.grade,
          status: enrollment.status,
          year: academicYear.year,
        })
        .from(enrollment)
        .innerJoin(student, and(eq(student.id, enrollment.studentId), eq(student.schoolId, enrollment.schoolId)))
        .innerJoin(academicYear, and(eq(academicYear.id, enrollment.academicYearId), eq(academicYear.schoolId, enrollment.schoolId)))
        .where(inArray(student.id, studentIds))
        .orderBy(asc(enrollment.enrolledOn)),
      db
        .select({
          id: studentDocument.id,
          studentId: studentDocument.studentId,
          kind: studentDocument.kind,
          label: studentDocument.label,
          pathname: studentDocument.pathname,
          createdAt: studentDocument.createdAt,
        })
        .from(studentDocument)
        .innerJoin(student, and(eq(student.id, studentDocument.studentId), eq(student.schoolId, studentDocument.schoolId)))
        .where(and(inArray(student.id, studentIds), isNull(studentDocument.deletedAt)))
        .orderBy(desc(studentDocument.createdAt))
        .limit(300),
      db
        .select({
          id: assessmentScore.id,
          studentId: assessmentScore.studentId,
          score: assessmentScore.score,
          note: assessmentScore.note,
          title: assessment.title,
          heldOn: assessment.heldOn,
          maxScore: assessment.maxScore,
          subjectName: subject.name,
        })
        .from(assessmentScore)
        .innerJoin(student, and(eq(student.id, assessmentScore.studentId), eq(student.schoolId, assessmentScore.schoolId)))
        .innerJoin(assessment, and(eq(assessment.id, assessmentScore.assessmentId), eq(assessment.schoolId, assessmentScore.schoolId)))
        .leftJoin(subject, and(eq(subject.id, assessment.subjectId), eq(subject.schoolId, assessment.schoolId)))
        .where(inArray(student.id, studentIds))
        .orderBy(desc(assessment.heldOn))
        .limit(500),
      db
        .select({ studentId: attendanceRecord.studentId, schoolId: attendanceRecord.schoolId, status: attendanceRecord.status, total: count() })
        .from(attendanceRecord)
        .innerJoin(student, and(eq(student.id, attendanceRecord.studentId), eq(student.schoolId, attendanceRecord.schoolId)))
        .where(inArray(student.id, studentIds))
        .groupBy(attendanceRecord.studentId, attendanceRecord.schoolId, attendanceRecord.status),
      db
        .select({
          id: studentTransfer.id,
          fromSchoolId: studentTransfer.fromSchoolId,
          toSchoolId: studentTransfer.toSchoolId,
          fromStudentId: studentTransfer.fromStudentId,
          toStudentId: studentTransfer.toStudentId,
          resolvedAt: studentTransfer.resolvedAt,
        })
        .from(studentTransfer)
        .where(and(...transferFilters))
        .orderBy(asc(studentTransfer.resolvedAt)),
    ])

  for (const item of enrollments) {
    addRecord(
      item.studentId,
      {
        id: `enrollment-${item.id}`,
        dateLabel: formatHistoryDate(item.enrolledOn),
        category: `Matrícula · ${item.year}`,
        title: `${item.grade} · ${enrollmentLabel(item.status)}`,
        summary: item.statusNote,
      },
      item.enrolledOn,
    )
  }

  for (const item of documents) {
    addRecord(
      item.studentId,
      {
        id: `document-${item.id}`,
        dateLabel: formatHistoryDate(item.createdAt),
        category: 'Documento',
        title: item.label,
        summary: DOCUMENT_KINDS[item.kind as keyof typeof DOCUMENT_KINDS] ?? 'Documento escolar',
        href: fileUrl(item.pathname),
        hrefLabel: 'Abrir documento',
      },
      item.createdAt,
    )
  }

  for (const item of scores) {
    addRecord(
      item.studentId,
      {
        id: `score-${item.id}`,
        dateLabel: formatHistoryDate(item.heldOn),
        category: 'Nota',
        title: `${item.title}${item.subjectName ? ` · ${item.subjectName}` : ''}`,
        summary: `${item.score === null ? 'Sem nota' : item.score} / ${item.maxScore}${item.note ? ` · ${item.note}` : ''}`,
      },
      item.heldOn,
    )
  }

  const attendanceSummary = new Map<string, Record<string, number>>()
  for (const row of attendanceCounts) {
    const key = `${row.studentId}:${row.schoolId}`
    const summary = attendanceSummary.get(key) ?? {}
    const status = row.status.toUpperCase()
    summary[status] = (summary[status] ?? 0) + Number(row.total)
    attendanceSummary.set(key, summary)
  }
  for (const [key, summary] of attendanceSummary) {
    const [localStudentId] = key.split(':')
    const parts = [
      ['PRESENT', 'presenças'],
      ['LATE', 'atrasos'],
      ['ABSENT', 'faltas'],
      ['JUSTIFIED', 'justificadas'],
    ] as const
    const labels = parts
      .filter(([status]) => (summary[status] ?? 0) > 0)
      .map(([status, label]) => `${summary[status]} ${label}`)
    if (labels.length > 0) {
      const profile = profileById.get(localStudentId)
      addRecord(
        localStudentId,
        {
          id: `attendance-${profile?.schoolId ?? 'school'}-${localStudentId}`,
          dateLabel: 'Resumo do período',
          category: 'Frequência',
          title: 'Registros de presença',
          summary: labels.join(' · '),
        },
        profile?.createdAt,
      )
    }
  }

  const schoolNameById = new Map(profiles.map((profile) => [profile.schoolId, profile.schoolName]))
  const otherSchoolIds = [...new Set(transfers.flatMap((transfer) => [transfer.fromSchoolId, transfer.toSchoolId]))].filter(
    (id) => !schoolNameById.has(id),
  )
  if (otherSchoolIds.length > 0) {
    const otherSchools = await db.select({ id: school.id, name: school.name }).from(school).where(inArray(school.id, otherSchoolIds))
    for (const otherSchool of otherSchools) schoolNameById.set(otherSchool.id, otherSchool.name)
  }

  for (const transfer of transfers) {
    const transferDate = formatHistoryDate(transfer.resolvedAt)
    const sourceName = schoolNameById.get(transfer.fromSchoolId) ?? 'Escola de origem'
    const destinationName = schoolNameById.get(transfer.toSchoolId) ?? 'Escola de destino'
    if (profileById.has(transfer.fromStudentId)) {
      addRecord(
        transfer.fromStudentId,
        {
          id: `transfer-out-${transfer.id}`,
          dateLabel: transferDate,
          category: 'Transferência',
          title: `Transferido para ${destinationName}`,
          summary: 'A escola de destino confirmou o recebimento.',
        },
        transfer.resolvedAt,
      )
    }
    if (transfer.toStudentId && profileById.has(transfer.toStudentId)) {
      addRecord(
        transfer.toStudentId,
        {
          id: `transfer-in-${transfer.id}`,
          dateLabel: transferDate,
          category: 'Transferência',
          title: `Recebido de ${sourceName}`,
          summary: 'A escola assumiu a responsabilidade pelo período atual.',
        },
        transfer.resolvedAt,
      )
    }
  }

  const periods = profiles.map((profile) => {
    const profileEnrollments = enrollments.filter((item) => item.studentId === profile.id)
    const latestEndDate = profileEnrollments
      .map((item) => item.statusChangedOn)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => dateOrder(b) - dateOrder(a))[0]
    const current = isCurrentSchool && profile.id === passport.currentStudentId
    const records = (recordsByStudent.get(profile.id) ?? [])
      .sort((a, b) => b.dateOrder - a.dateOrder)
      .map((item) => item.record)

    return {
      id: profile.id,
      schoolName: profile.schoolName,
      startsOnLabel: formatHistoryDate(profileEnrollments[0]?.enrolledOn ?? profile.createdAt),
      endsOnLabel: current || !latestEndDate ? null : formatHistoryDate(latestEndDate),
      current,
      records,
    }
  })

  const [pendingTransfer] = await db
    .select({ id: studentTransfer.id, destination: school.name })
    .from(studentTransfer)
    .innerJoin(school, eq(school.id, studentTransfer.toSchoolId))
    .where(
      and(
        eq(studentTransfer.passportId, localProfile.passportId),
        eq(studentTransfer.fromSchoolId, schoolId),
        eq(studentTransfer.fromStudentId, studentId),
        eq(studentTransfer.status, 'PENDING'),
      ),
    )
    .limit(1)

  return {
    isCurrentSchool,
    periods,
    transferPending: pendingTransfer ?? null,
    transferSchools: isCurrentSchool && includeTransferSchools ? await listTransferSchools(schoolId) : [],
  }
}
