import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Card, EmptyState, PageTitle } from '@/components/ui/card'
import { PrintButton } from '@/components/school/print-button'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { listStudentAchievements } from '@/lib/achievement-queries'
import { achievementCategoryLabel } from '@/lib/achievements'
import { formatDate } from '@/lib/school-page'
import { fileUrl } from '@/lib/storage'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Passaporte de conquistas' }

export default async function PrintAchievementPassport({
  searchParams,
}: {
  searchParams: Promise<{ student?: string }>
}) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const students = await getFamilyStudents(schoolId, role === 'STUDENT' ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)
  const params = await searchParams
  const selected = students.find((item) => item.id === params.student)
  if (!selected) notFound()
  const items = await listStudentAchievements(schoolId, selected.id)

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 print:max-w-none print:gap-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle title="Passaporte de conquistas" description={selected.socialName || selected.fullName} />
          <p className="mt-1 text-sm text-muted-foreground">Gerado em {formatDate(new Date())}</p>
        </div>
        <PrintButton />
      </div>
      {items.length === 0 ? (
        <Card><EmptyState title="Nenhuma conquista registrada" description="As conquistas aparecerão aqui depois de serem registradas." /></Card>
      ) : (
        <ol className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id} className="break-inside-avoid rounded-xl border border-border bg-card p-4 print:rounded-none print:border-black">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide">{achievementCategoryLabel(item.category)}</span>
                <time className="text-sm" dateTime={item.achievedOn}>{formatDate(item.achievedOn)}</time>
              </div>
              <h2 className="mt-2 text-lg font-bold">{item.title}</h2>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{item.description}</p>
              {item.evidencePathname ? (
                item.evidenceContentType?.startsWith('image/') ? (
                  <figure className="mt-3 break-inside-avoid">
                    <img
                      src={fileUrl(item.evidencePathname)}
                      alt={`Evidência da conquista: ${item.title}`}
                      className="max-h-72 max-w-full rounded-lg object-contain print:max-h-56 print:rounded-none"
                    />
                    <figcaption className="mt-1 text-xs text-muted-foreground">Evidência da conquista</figcaption>
                  </figure>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Evidência em PDF: <a href={fileUrl(item.evidencePathname)} className="underline" target="_blank" rel="noreferrer">abrir arquivo antes de imprimir</a>
                  </p>
                )
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </main>
  )
}
