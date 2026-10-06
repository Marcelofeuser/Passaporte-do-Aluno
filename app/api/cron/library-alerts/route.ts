import { timingSafeEqual } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bookLoan, school } from '@/lib/db/schema'
import { dispatchLibraryAlerts } from '@/lib/library-alerts'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const given = Buffer.from(request.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/** Disparo diário (Vercel Cron) dos avisos de vencimento e atraso de todas as escolas. */
export async function GET(request: Request) {
  if (!authorized(request)) return new Response('Unauthorized', { status: 401 })

  const schools = await db
    .selectDistinct({ id: bookLoan.schoolId })
    .from(bookLoan)
    .innerJoin(school, and(eq(school.id, bookLoan.schoolId), isNull(school.deletedAt)))
    .where(eq(bookLoan.status, 'ACTIVE'))

  let notifications = 0
  let failures = 0
  for (const s of schools) {
    try {
      notifications += await dispatchLibraryAlerts(s.id)
    } catch (error) {
      failures++
      logger.error('library.cron_school_failed', { schoolId: s.id, error })
    }
  }
  return Response.json({ schools: schools.length, notifications, failures })
}
