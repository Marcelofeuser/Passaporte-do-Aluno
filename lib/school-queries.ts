import { and, asc, count, desc, eq, ilike, inArray, isNull, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  academicYear,
  classSubject,
  enrollment,
  parent,
  school,
  schoolClass,
  student,
  studentDocument,
  studentParent,
  subject,
  teacher,
  teacherSubject,
} from '@/lib/db/schema'

/* Todas as funções recebem `schoolId` do vínculo ativo validado no servidor. */

export async function getSchoolProfile(schoolId: string) {
  const [row] = await db.select().from(school).where(and(eq(school.id, schoolId), isNull(school.deletedAt)))
  return row ?? null
}

export async function getAcademicCounts(schoolId: string) {
  const [[s], [t], [sub], [c]] = await Promise.all([
    db.select({ n: count() }).from(student).where(and(eq(student.schoolId, schoolId), isNull(student.deletedAt))),
    db.select({ n: count() }).from(teacher).where(and(eq(teacher.schoolId, schoolId), isNull(teacher.deletedAt))),
    db.select({ n: count() }).from(subject).where(and(eq(subject.schoolId, schoolId), isNull(subject.deletedAt))),
    db.select({ n: count() }).from(schoolClass).where(and(eq(schoolClass.schoolId, schoolId), isNull(schoolClass.deletedAt))),
  ])
  return { students: s.n, teachers: t.n, subjects: sub.n, classes: c.n }
}

/* ---------- Alunos ---------- */

export async function listStudents(schoolId: string, query?: string) {
  const q = query?.trim()
  const filters = [eq(student.schoolId, schoolId), isNull(student.deletedAt)]
  if (q) {
    filters.push(
      or(ilike(student.fullName, `%${q}%`), ilike(student.socialName, `%${q}%`), ilike(student.registrationCode, `%${q}%`))!,
    )
  }
  const rows = await db
    .select({
      id: student.id,
      fullName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
      birthDate: student.birthDate,
      photoPathname: student.photoPathname,
    })
    .from(student)
    .where(and(...filters))
    .orderBy(asc(student.fullName))
    .limit(200)

  const current = await getCurrentYear(schoolId)
  if (!current || rows.length === 0) return rows.map((r) => ({ ...r, className: null as string | null }))

  const enrolled = await db
    .select({ studentId: enrollment.studentId, className: schoolClass.name })
    .from(enrollment)
    .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(
      and(
        eq(enrollment.schoolId, schoolId),
        eq(enrollment.academicYearId, current.id),
        eq(enrollment.status, 'ACTIVE'),
        inArray(enrollment.studentId, rows.map((r) => r.id)),
      ),
    )
  const byStudent = new Map(enrolled.map((e) => [e.studentId, e.className]))
  return rows.map((r) => ({ ...r, className: byStudent.get(r.id) ?? null }))
}

export async function getStudent(schoolId: string, studentId: string) {
  const [row] = await db
    .select()
    .from(student)
    .where(and(eq(student.id, studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt)))
  return row ?? null
}

export async function getStudentParents(schoolId: string, studentId: string) {
  return db
    .select({
      id: parent.id,
      fullName: parent.fullName,
      email: parent.email,
      phone: parent.phone,
      relationship: studentParent.relationship,
    })
    .from(studentParent)
    .innerJoin(parent, eq(parent.id, studentParent.parentId))
    .where(and(eq(studentParent.studentId, studentId), eq(parent.schoolId, schoolId), isNull(parent.deletedAt)))
    .orderBy(asc(parent.fullName))
}

export async function getStudentEnrollments(schoolId: string, studentId: string) {
  return db
    .select({
      id: enrollment.id,
      status: enrollment.status,
      grade: enrollment.grade,
      enrolledOn: enrollment.enrolledOn,
      year: academicYear.year,
      className: schoolClass.name,
      classId: enrollment.classId,
    })
    .from(enrollment)
    .innerJoin(academicYear, eq(academicYear.id, enrollment.academicYearId))
    .leftJoin(schoolClass, eq(schoolClass.id, enrollment.classId))
    .where(and(eq(enrollment.schoolId, schoolId), eq(enrollment.studentId, studentId)))
    .orderBy(desc(academicYear.year), desc(enrollment.createdAt))
}

export async function getStudentDocuments(schoolId: string, studentId: string) {
  return db
    .select()
    .from(studentDocument)
    .where(
      and(
        eq(studentDocument.schoolId, schoolId),
        eq(studentDocument.studentId, studentId),
        isNull(studentDocument.deletedAt),
      ),
    )
    .orderBy(desc(studentDocument.createdAt))
}

/* ---------- Professores e disciplinas ---------- */

export async function listTeachers(schoolId: string) {
  const rows = await db
    .select({ id: teacher.id, fullName: teacher.fullName, email: teacher.email, phone: teacher.phone })
    .from(teacher)
    .where(and(eq(teacher.schoolId, schoolId), isNull(teacher.deletedAt)))
    .orderBy(asc(teacher.fullName))
  if (rows.length === 0) return []
  const links = await db
    .select({ teacherId: teacherSubject.teacherId, subjectId: subject.id, subjectName: subject.name })
    .from(teacherSubject)
    .innerJoin(subject, eq(subject.id, teacherSubject.subjectId))
    .where(and(eq(teacherSubject.schoolId, schoolId), isNull(subject.deletedAt)))
    .orderBy(asc(subject.name))
  return rows.map((t) => ({
    ...t,
    subjects: links.filter((l) => l.teacherId === t.id).map((l) => ({ id: l.subjectId, name: l.subjectName })),
  }))
}

export async function listSubjects(schoolId: string) {
  return db
    .select({ id: subject.id, name: subject.name, code: subject.code })
    .from(subject)
    .where(and(eq(subject.schoolId, schoolId), isNull(subject.deletedAt)))
    .orderBy(asc(subject.name))
}

/* ---------- Anos letivos e turmas ---------- */

export async function listAcademicYears(schoolId: string) {
  return db
    .select()
    .from(academicYear)
    .where(and(eq(academicYear.schoolId, schoolId), isNull(academicYear.deletedAt)))
    .orderBy(desc(academicYear.year))
}

export async function getCurrentYear(schoolId: string) {
  const [row] = await db
    .select()
    .from(academicYear)
    .where(and(eq(academicYear.schoolId, schoolId), eq(academicYear.isCurrent, true), isNull(academicYear.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function listClasses(schoolId: string, academicYearId?: string) {
  const filters = [eq(schoolClass.schoolId, schoolId), isNull(schoolClass.deletedAt)]
  if (academicYearId) filters.push(eq(schoolClass.academicYearId, academicYearId))
  const rows = await db
    .select({
      id: schoolClass.id,
      name: schoolClass.name,
      grade: schoolClass.grade,
      shift: schoolClass.shift,
      capacity: schoolClass.capacity,
      academicYearId: schoolClass.academicYearId,
      year: academicYear.year,
      homeroomTeacher: teacher.fullName,
    })
    .from(schoolClass)
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .leftJoin(teacher, eq(teacher.id, schoolClass.homeroomTeacherId))
    .where(and(...filters))
    .orderBy(desc(academicYear.year), asc(schoolClass.grade), asc(schoolClass.name))

  if (rows.length === 0) return []
  const totals = await db
    .select({ classId: enrollment.classId, n: count() })
    .from(enrollment)
    .where(and(eq(enrollment.schoolId, schoolId), eq(enrollment.status, 'ACTIVE')))
    .groupBy(enrollment.classId)
  const byClass = new Map(totals.map((t) => [t.classId, t.n]))
  return rows.map((r) => ({ ...r, enrolled: byClass.get(r.id) ?? 0 }))
}

export async function getClass(schoolId: string, classId: string) {
  const [row] = await db
    .select({
      id: schoolClass.id,
      name: schoolClass.name,
      grade: schoolClass.grade,
      shift: schoolClass.shift,
      capacity: schoolClass.capacity,
      academicYearId: schoolClass.academicYearId,
      homeroomTeacherId: schoolClass.homeroomTeacherId,
      year: academicYear.year,
      homeroomTeacher: teacher.fullName,
    })
    .from(schoolClass)
    .innerJoin(academicYear, eq(academicYear.id, schoolClass.academicYearId))
    .leftJoin(teacher, eq(teacher.id, schoolClass.homeroomTeacherId))
    .where(and(eq(schoolClass.id, classId), eq(schoolClass.schoolId, schoolId), isNull(schoolClass.deletedAt)))
  return row ?? null
}

export async function getClassSubjects(schoolId: string, classId: string) {
  return db
    .select({
      id: classSubject.id,
      subjectName: subject.name,
      subjectCode: subject.code,
      teacherName: teacher.fullName,
    })
    .from(classSubject)
    .innerJoin(subject, eq(subject.id, classSubject.subjectId))
    .leftJoin(teacher, eq(teacher.id, classSubject.teacherId))
    .where(and(eq(classSubject.schoolId, schoolId), eq(classSubject.classId, classId)))
    .orderBy(asc(subject.name))
}

export async function getClassRoster(schoolId: string, classId: string) {
  return db
    .select({
      enrollmentId: enrollment.id,
      studentId: student.id,
      fullName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
    })
    .from(enrollment)
    .innerJoin(student, eq(student.id, enrollment.studentId))
    .where(
      and(
        eq(enrollment.schoolId, schoolId),
        eq(enrollment.classId, classId),
        eq(enrollment.status, 'ACTIVE'),
        isNull(student.deletedAt),
      ),
    )
    .orderBy(asc(student.fullName))
}
