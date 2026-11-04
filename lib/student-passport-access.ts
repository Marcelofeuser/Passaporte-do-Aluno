import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { student, studentPassport } from '@/lib/db/schema'

export async function isCurrentPassportStudent(schoolId: string, studentId: string) {
  const [owner] = await db
    .select({ currentSchoolId: studentPassport.currentSchoolId, currentStudentId: studentPassport.currentStudentId })
    .from(student)
    .innerJoin(studentPassport, eq(studentPassport.id, student.passportId))
    .where(and(eq(student.id, studentId), eq(student.schoolId, schoolId), isNull(student.deletedAt)))
    .limit(1)

  return owner?.currentSchoolId === schoolId && owner.currentStudentId === studentId
}
