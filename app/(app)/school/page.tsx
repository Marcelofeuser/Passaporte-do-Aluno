import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { Card, PageTitle } from '@/components/ui/card'
import { SCHOOL_SECTIONS } from '@/lib/navigation'
import { can } from '@/lib/rbac'
import { getAcademicCounts, getCurrentYear } from '@/lib/school-queries'
import { requirePageContext } from '@/lib/session'

export const metadata: Metadata = { title: 'Escola' }

export default async function SchoolHubPage() {
  const ctx = await requirePageContext()
  const role = ctx.active?.role
  const schoolId = ctx.active?.schoolId
  if (!schoolId) redirect('/dashboard')

  const sections = SCHOOL_SECTIONS.filter((s) => can(role, s.permission))
  if (sections.length === 0) redirect('/dashboard')

  const [counts, year] = await Promise.all([getAcademicCounts(schoolId), getCurrentYear(schoolId)])
  const countFor: Record<string, number | undefined> = {
    '/school/students': counts.students,
    '/school/classes': counts.classes,
    '/school/teachers': counts.teachers,
    '/school/subjects': counts.subjects,
  }

  return (
    <>
      <PageTitle
        title={ctx.active?.schoolName ?? 'Escola'}
        description={year ? `Ano letivo vigente: ${year.year}` : 'Nenhum ano letivo vigente definido.'}
      />
      <Card>
        <ul className="divide-y divide-border">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                href={s.href}
                className="flex min-h-16 items-center gap-4 px-4 py-3 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-bold">{s.label}</span>
                  <span className="text-sm leading-relaxed text-muted-foreground">{s.description}</span>
                </div>
                {countFor[s.href] !== undefined ? (
                  <span className="font-mono text-lg font-bold tabular-nums">{countFor[s.href]}</span>
                ) : null}
                <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}
