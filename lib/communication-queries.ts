import { and, asc, desc, eq, inArray, isNull, lte, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { academicYear, announcement, announcementAudience, announcementRead, communicationCategory, enrollment, schoolClass, user } from '@/lib/db/schema'

export async function listCommunicationCategories(schoolId: string) {
  return db.select().from(communicationCategory).where(and(eq(communicationCategory.schoolId, schoolId), eq(communicationCategory.active, true))).orderBy(asc(communicationCategory.name))
}

export async function listAnnouncements(schoolId: string, userId: string, familyStudentIds?: string[]) {
  const enrollments = familyStudentIds?.length
    ? await db.select({ classId: enrollment.classId, yearId: enrollment.academicYearId }).from(enrollment)
      .where(and(eq(enrollment.schoolId, schoolId), inArray(enrollment.studentId, familyStudentIds), eq(enrollment.status, 'ACTIVE')))
    : []
  const classIds = enrollments.map((e) => e.classId).filter((id): id is string => Boolean(id))
  const yearIds = enrollments.map((e) => e.yearId)
  const audience = familyStudentIds
    ? or(eq(announcementAudience.audienceType, 'SCHOOL'),
      and(eq(announcementAudience.audienceType, 'CLASS'), classIds.length ? inArray(announcementAudience.classId, classIds) : sql`false`),
      and(eq(announcementAudience.audienceType, 'YEAR'), yearIds.length ? inArray(announcementAudience.academicYearId, yearIds) : sql`false`))
    : sql`true`
  return db.select({
    id: announcement.id, title: announcement.title, body: announcement.body, priority: announcement.priority,
    publishAt: announcement.publishAt, expiresAt: announcement.expiresAt, category: communicationCategory.name,
    readAt: announcementRead.readAt,
  }).from(announcement)
    .innerJoin(communicationCategory, eq(communicationCategory.id, announcement.categoryId))
    .leftJoin(announcementAudience, eq(announcementAudience.announcementId, announcement.id))
    .leftJoin(announcementRead, and(eq(announcementRead.announcementId, announcement.id), eq(announcementRead.userId, userId)))
    .where(and(eq(announcement.schoolId, schoolId), isNull(announcement.deletedAt), lte(announcement.publishAt, new Date()), or(isNull(announcement.expiresAt), sql`${announcement.expiresAt} >= current_date`), audience))
    .groupBy(announcement.id, communicationCategory.name, announcementRead.readAt)
    .orderBy(desc(announcement.publishAt))
}

export async function listSchoolAnnouncements(schoolId: string) {
  return db.select({
    id: announcement.id, title: announcement.title, body: announcement.body, priority: announcement.priority,
    publishAt: announcement.publishAt, category: communicationCategory.name,
    audienceType: announcementAudience.audienceType, audienceId: sql<string | null>`coalesce(${announcementAudience.classId}, ${announcementAudience.academicYearId})`,
    reads: sql<number>`(select count(*)::int from announcement_read ar where ar.announcement_id = ${announcement.id})`,
    lastReadAt: sql<Date | null>`(select max(ar.read_at) from announcement_read ar where ar.announcement_id = ${announcement.id})`,
  }).from(announcement)
    .innerJoin(communicationCategory, eq(communicationCategory.id, announcement.categoryId))
    .leftJoin(announcementAudience, eq(announcementAudience.announcementId, announcement.id))
    .where(and(eq(announcement.schoolId, schoolId), isNull(announcement.deletedAt)))
    .orderBy(desc(announcement.publishAt))
}

export async function listAnnouncementReads(schoolId: string, announcementId: string) {
  return db.select({
    userId: announcementRead.userId,
    name: user.name,
    email: user.email,
    readAt: announcementRead.readAt,
  }).from(announcementRead)
    .innerJoin(user, eq(user.id, announcementRead.userId))
    .where(and(
      eq(announcementRead.schoolId, schoolId),
      eq(announcementRead.announcementId, announcementId),
    ))
    .orderBy(desc(announcementRead.readAt))
}
