import { Card, EmptyState } from '@/components/ui/card'
import { fileUrl } from '@/lib/storage'
import { formatBytes, formatDate } from '@/lib/school-page'
import { achievementCategoryLabel } from '@/lib/achievements'

type Achievement = {
  id: string
  category: string
  title: string
  description: string
  achievedOn: string
  evidencePathname: string | null
  evidenceContentType: string | null
  evidenceSizeBytes: number | null
}

export function AchievementTimeline({ items }: { items: Achievement[] }) {
  if (items.length === 0) {
    return <Card><EmptyState title="Ainda não há conquistas" description="As conquistas registradas aparecerão aqui em ordem cronológica." /></Card>
  }

  return (
    <ol className="flex flex-col gap-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-secondary-foreground">
              {achievementCategoryLabel(item.category)}
            </span>
            <time className="text-sm text-muted-foreground" dateTime={item.achievedOn}>{formatDate(item.achievedOn)}</time>
          </div>
          <h2 className="mt-3 text-lg font-bold">{item.title}</h2>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{item.description}</p>
          {item.evidencePathname ? (
            <a
              href={fileUrl(item.evidencePathname)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
            >
              {item.evidenceContentType?.startsWith('image/') ? 'Ver foto' : 'Abrir evidência'}
              {item.evidenceSizeBytes ? <span className="font-normal text-muted-foreground">({formatBytes(item.evidenceSizeBytes)})</span> : null}
            </a>
          ) : null}
        </li>
      ))}
    </ol>
  )
}
