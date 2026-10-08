import type { Metadata } from 'next'
import Link from 'next/link'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { calendarDateTime, localDate } from '@/lib/calendar'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { requireSchoolPage } from '@/lib/school-page'
import { cn } from '@/lib/utils'
import { and, desc, eq, gte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accessDevice, studentAccessLog } from '@/lib/db/schema'

export const metadata: Metadata = { title: 'Acessos' }

const TYPE_TONE: Record<string, string> = {
  ENTRADA: 'bg-primary/10 text-primary',
  SAIDA: 'bg-accent text-accent-foreground',
}

const METHOD_LABEL: Record<string, string> = { NFC: 'carteirinha NFC', FACIAL: 'biometria facial', MANUAL: 'registro manual' }

export default async function FamilyAccessPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const sp = await searchParams
  const isStudent = role === 'STUDENT'
  const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)

  if (students.length === 0) {
    return (
      <>
        <PageTitle title="Acessos" />
        <Card>
          <EmptyState
            title="Nenhum aluno vinculado"
            description="Peça à secretaria para vincular seus filhos usando o mesmo e-mail da sua conta."
          />
        </Card>
      </>
    )
  }

  const selected = students.find((s) => s.id === sp.student) ?? students[0]
  const since = new Date(Date.now() - 30 * 86_400_000)
  const logs = await db
    .select({
      id: studentAccessLog.id,
      occurredAt: studentAccessLog.occurredAt,
      type: studentAccessLog.type,
      method: studentAccessLog.method,
      studentId: studentAccessLog.studentId,
      deviceName: accessDevice.name,
    })
    .from(studentAccessLog)
    .leftJoin(accessDevice, and(eq(accessDevice.id, studentAccessLog.deviceId), eq(accessDevice.schoolId, schoolId)))
    .where(
      and(
        eq(studentAccessLog.schoolId, schoolId),
        inArray(studentAccessLog.studentId, students.map((s) => s.id)),
        eq(studentAccessLog.studentId, selected.id),
        gte(studentAccessLog.occurredAt, since),
      ),
    )
    .orderBy(desc(studentAccessLog.occurredAt))
    .limit(60)

  const byDay = new Map<string, typeof logs>()
  for (const log of logs) {
    const key = localDate(log.occurredAt)
    const list = byDay.get(key) ?? []
    list.push(log)
    byDay.set(key, list)
  }

  return (
    <>
      <PageTitle title="Acessos" description="Entradas e saídas pela portaria nos últimos 30 dias." />

      {students.length > 1 ? (
        <nav aria-label="Escolher aluno" className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/family/access?student=${s.id}`}
              aria-current={s.id === selected.id ? 'page' : undefined}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {s.socialName || s.fullName}
            </Link>
          ))}
        </nav>
      ) : null}

      <Card>
        <CardHeader title="Histórico de passagens" description={selected.socialName || selected.fullName} />
        {logs.length === 0 ? (
          <EmptyState
            title="Nenhum registro"
            description="Assim que a escola registrar entradas e saídas, elas aparecem aqui em tempo real."
          />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {[...byDay.entries()].map(([day, list]) => (
              <li key={day}>
                <p className="bg-muted/50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' }).format(new Date(`${day}T12:00:00`))}
                </p>
                <ul className="divide-y divide-border">
                  {list.map((log) => (
                    <li key={log.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', TYPE_TONE[log.type] ?? '')}>{log.type}</span>
                        <span className="text-muted-foreground">{METHOD_LABEL[log.method] ?? log.method}</span>
                      </div>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{calendarDateTime(log.occurredAt)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
