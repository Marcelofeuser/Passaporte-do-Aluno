import { NextResponse } from 'next/server'
import { can } from '@/lib/rbac'
import { getAppContext } from '@/lib/session'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { getFinanceStatement } from '@/lib/finance-queries'

export async function GET() {
  const ctx = await getAppContext()
  if (!ctx?.active?.schoolId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { schoolId, role } = ctx.active
  if (can(role, 'school:manage_finance')) {
    return NextResponse.json(await getFinanceStatement(schoolId, []))
  }
  if (!can(role, 'family:view')) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  const students = await getFamilyStudents(schoolId, role === 'STUDENT' ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)
  return NextResponse.json(await getFinanceStatement(schoolId, students.map((s) => s.id)))
}
