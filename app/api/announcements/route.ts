import { NextResponse } from 'next/server'
import { markAnnouncementRead } from '@/app/actions/communications'
import { listAnnouncements } from '@/lib/communication-queries'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { can } from '@/lib/rbac'
import { getAppContext } from '@/lib/session'

export async function GET() {
  const ctx = await getAppContext()
  if (!ctx?.active?.schoolId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { schoolId, role } = ctx.active
  if (can(role, 'school:manage_communications') || can(role, 'school:view_academic')) {
    return NextResponse.json(await listAnnouncements(schoolId, ctx.user.id))
  }
  if (!can(role, 'family:view')) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const students = await getFamilyStudents(schoolId, role === 'STUDENT' ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)
  return NextResponse.json(await listAnnouncements(schoolId, ctx.user.id, students.map((s) => s.id)))
}

export async function POST(request: Request) {
  const ctx = await getAppContext()
  if (!ctx?.active?.schoolId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const body = await request.json().catch(() => null) as { announcementId?: string } | null
  if (!body?.announcementId || !can(ctx.active.role, 'family:view')) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const form = new FormData(); form.set('announcementId', body.announcementId)
  const result = await markAnnouncementRead({ ok: false }, form)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
