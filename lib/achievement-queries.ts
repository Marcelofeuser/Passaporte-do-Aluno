import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { classSubject, enrollment, schoolClass, student, studentAchievement, studentPassport, teacher } from '@/lib/db/schema'
import type { Role } from '@/lib/rbac'

export async function listAchievementStudents(schoolId: string, role: Role, userId: string) {
  const base = db
    .selectDistinct({
      id: student.id,
      fullName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
    })
    .from(student)
    .innerJoin(
      studentPassport,
      and(
        eq(studentPassport.id, student.passportId),
        eq(studentPassport.currentSchoolId, schoolId),
        eq(studentPassport.currentStudentId, student.id),
      ),
    )

  if (role === 'TEACHER') {
    return base
      .innerJoin(enrollment, and(eq(enrollment.studentId, student.id), eq(enrollment.schoolId, schoolId)))
      .innerJoin(schoolClass, and(eq(schoolClass.id, enrollment.classId), eq(schoolClass.schoolId, schoolId)))
      .innerJoin(classSubject, and(eq(classSubject.classId, schoolClass.id), eq(classSubject.schoolId, schoolId)))
      .innerJoin(
        teacher,
        and(eq(teacher.id, classSubject.teacherId), eq(teacher.schoolId, schoolId), eq(teacher.userId, userId)),
      )
      .where(and(eq(student.schoolId, schoolId), eq(enrollment.status, 'ACTIVE'), isNull(student.deletedAt), isNull(teacher.deletedAt), isNull(schoolClass.deletedAt)))
      .orderBy(asc(student.fullName))
      .limit(500)
  }

  return base
    .where(and(eq(student.schoolId, schoolId), isNull(student.deletedAt)))
    .orderBy(asc(student.fullName))
    .limit(500)
}

export async function teacherCanRecordAchievement(schoolId: string, studentId: string, userId: string) {
  const [row] = await db
    .select({ studentId: student.id })
    .from(teacher)
    .innerJoin(classSubject, and(eq(classSubject.teacherId, teacher.id), eq(classSubject.schoolId, schoolId)))
    .innerJoin(schoolClass, and(eq(schoolClass.id, classSubject.classId), eq(schoolClass.schoolId, schoolId)))
    .innerJoin(enrollment, and(eq(enrollment.classId, schoolClass.id), eq(enrollment.schoolId, schoolId)))
    .innerJoin(student, and(eq(student.id, enrollment.studentId), eq(student.schoolId, schoolId)))
    .innerJoin(
      studentPassport,
      and(
        eq(studentPassport.id, student.passportId),
        eq(studentPassport.currentSchoolId, schoolId),
        eq(studentPassport.currentStudentId, student.id),
      ),
    )
    .where(
      and(
        eq(teacher.userId, userId),
        eq(teacher.schoolId, schoolId),
        eq(student.id, studentId),
        eq(enrollment.status, 'ACTIVE'),
        isNull(teacher.deletedAt),
        isNull(schoolClass.deletedAt),
        isNull(student.deletedAt),
      ),
    )
    .limit(1)
  return Boolean(row)
}

export async function listStudentAchievements(schoolId: string, studentId: string) {
  return db
    .select({
      id: studentAchievement.id,
      category: studentAchievement.category,
      title: studentAchievement.title,
      description: studentAchievement.description,
      achievedOn: studentAchievement.achievedOn,
      evidencePathname: studentAchievement.evidencePathname,
      evidenceContentType: studentAchievement.evidenceContentType,
      evidenceSizeBytes: studentAchievement.evidenceSizeBytes,
      createdAt: studentAchievement.createdAt,
    })
    .from(studentAchievement)
    .innerJoin(
      student,
      and(
        eq(student.id, studentAchievement.studentId),
        eq(student.schoolId, studentAchievement.schoolId),
        isNull(student.deletedAt),
      ),
    )
    .where(and(eq(studentAchievement.schoolId, schoolId), eq(studentAchievement.studentId, studentId)))
    .orderBy(desc(studentAchievement.achievedOn), desc(studentAchievement.createdAt))
    .limit(200)
}
