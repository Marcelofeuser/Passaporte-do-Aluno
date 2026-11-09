import { Card, CardHeader } from '@/components/ui/card'
import { achievementCategoryLabel } from '@/lib/achievements'

type Stats = {
  total: number
  thisYear: number
  categories: { category: string; total: number }[]
  months: { month: string; total: number }[]
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function AchievementSummary({ stats }: { stats: Stats }) {
  const now = new Date()
  const year = now.getUTCFullYear()
  const values = new Map(stats.months.map((item) => [item.month, item.total]))
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(Date.UTC(year, index, 1)).toISOString().slice(0, 7)
    return { label: MONTHS[index], total: values.get(month) ?? 0 }
  })
  const max = Math.max(1, ...months.map((item) => item.total))

  return (
    <section className="grid gap-4 lg:grid-cols-3" aria-label="Resumo das conquistas">
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Conquistas registradas</p>
        <p className="mt-1 text-3xl font-extrabold">{stats.total}</p>
        <p className="mt-1 text-xs text-muted-foreground">Em todos os passaportes acessíveis</p>
      </Card>
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Neste ano</p>
        <p className="mt-1 text-3xl font-extrabold">{stats.thisYear}</p>
        <p className="mt-1 text-xs text-muted-foreground">Registros feitos em {year}</p>
      </Card>
      <Card className="p-4">
        <p className="text-sm text-muted-foreground">Categorias em destaque</p>
        {stats.categories.length ? (
          <ul className="mt-2 flex flex-col gap-1">
            {stats.categories.slice(0, 3).map((item) => (
              <li key={item.category} className="flex justify-between gap-2 text-sm">
                <span>{achievementCategoryLabel(item.category)}</span><strong>{item.total}</strong>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-muted-foreground">Ainda sem registros.</p>}
      </Card>
      <Card className="lg:col-span-3">
        <CardHeader title="Conquistas por mês" description={`Registros com data de conquista em ${year}.`} />
        <div className="grid h-44 grid-cols-12 items-end gap-2 p-4" role="img" aria-label={months.map((item) => `${item.label}: ${item.total}`).join(', ')}>
          {months.map((item) => (
            <div key={item.label} className="flex h-full min-w-0 flex-col items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">{item.total || ''}</span>
              <div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(item.total ? 8 : 2, (item.total / max) * 100)}%` }} />
              <span className="text-[10px] text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </Card>
    </section>
  )
}
