import 'server-only'
import { and, asc, count, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLog, notification, school, schoolMembership, student, teacher, user } from '@/lib/db/schema'

export async function getSchoolMembers(schoolId: string) {
  return db
    .select({
      membershipId: schoolMembership.id,
      role: schoolMembership.role,
      userId: user.id,
      name: user.name,
      email: user.email,
    })
    .from(schoolMembership)
    .innerJoin(user, eq(user.id, schoolMembership.userId))
    .where(and(eq(schoolMembership.schoolId, schoolId), isNull(schoolMembership.deletedAt)))
    .orderBy(asc(user.name))
}

export async function getSchool(schoolId: string) {
  const [row] = await db
    .select()
    .from(school)
    .where(and(eq(school.id, schoolId), isNull(school.deletedAt)))
    .limit(1)
  return row ?? null
}

export async function listSchools() {
  return db
    .select({
      id: school.id,
      name: school.name,
      slug: school.slug,
      createdAt: school.createdAt,
      members: count(schoolMembership.id),
    })
    .from(school)
    .leftJoin(
      schoolMembership,
      and(eq(schoolMembership.schoolId, school.id), isNull(schoolMembership.deletedAt)),
    )
    .where(isNull(school.deletedAt))
    .groupBy(school.id)
    .orderBy(asc(school.name))
}

export async function getSchoolCounts(schoolId: string) {
  const [[members], [students], [teachers]] = await Promise.all([
    db
      .select({ value: count() })
      .from(schoolMembership)
      .where(and(eq(schoolMembership.schoolId, schoolId), isNull(schoolMembership.deletedAt))),
    db
      .select({ value: count() })
      .from(student)
      .where(and(eq(student.schoolId, schoolId), isNull(student.deletedAt))),
    db
      .select({ value: count() })
      .from(teacher)
      .where(and(eq(teacher.schoolId, schoolId), isNull(teacher.deletedAt))),
  ])
  return { members: members.value, students: students.value, teachers: teachers.value }
}

export async function getAuditEntries(schoolId: string | null, limit = 50) {
  return db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      entityType: auditLog.entityType,
      createdAt: auditLog.createdAt,
      actorName: user.name,
      schoolName: school.name,
    })
    .from(auditLog)
    .leftJoin(user, eq(user.id, auditLog.actorUserId))
    .leftJoin(school, eq(school.id, auditLog.schoolId))
    .where(schoolId ? eq(auditLog.schoolId, schoolId) : undefined)
    .orderBy(desc(auditLog.createdAt))
    .limit(limit)
}

export async function getNotifications(userId: string) {
  return db
    .select()
    .from(notification)
    .where(eq(notification.userId, userId))
    .orderBy(desc(notification.createdAt))
    .limit(50)
}
