import { cn } from '@/lib/utils'
import { OCCURRENCE_SEVERITY } from '@/lib/occurrences'

export function SeverityBadge({ severity, positive }: { severity: string; positive?: boolean }) {
  if (positive) {
    return <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Mérito</span>
  }
  const label = OCCURRENCE_SEVERITY[severity as keyof typeof OCCURRENCE_SEVERITY] ?? severity
  const tone =
    severity === 'SEVERE'
      ? 'bg-destructive/10 text-destructive'
      : severity === 'MODERATE'
        ? 'bg-accent text-accent-foreground'
        : 'bg-muted text-muted-foreground'
  return <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', tone)}>{label}</span>
}
