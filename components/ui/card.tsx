import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Card({
  title,
  description,
  action,
  className,
  children,
  ...props
}: React.ComponentProps<'section'> & {
  title?: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <section
      className={cn(
        'animate-rise rounded-3xl border border-border bg-card text-card-foreground shadow-soft',
        className,
      )}
      {...props}
    >
      {title ? <CardHeader title={title} description={description} action={action} /> : null}
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-3 border-b border-dashed border-border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-bold text-balance">{title}</h2>
        {description ? (
          <p className="leading-relaxed text-muted-foreground text-pretty">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <div className="relative mb-2 flex size-20 items-center justify-center">
        <span className="absolute inset-0 rotate-6 rounded-[2rem] bg-sun/50" aria-hidden="true" />
        <span className="absolute inset-2 -rotate-6 rounded-[1.6rem] bg-sky/50" aria-hidden="true" />
        <Sparkles className="relative size-8 text-primary" aria-hidden="true" />
      </div>
      <p className="font-display text-lg font-bold">{title}</p>
      <p className="max-w-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
    </div>
  )
}

export function RoleStamp({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex -rotate-3 items-center rounded-lg border-2 border-dashed border-accent bg-coral/15 px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-accent-foreground uppercase',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex animate-rise flex-col gap-1.5">
      <h1 className="text-3xl font-extrabold tracking-tight text-balance">{title}</h1>
      {description ? (
        <p className="text-lg leading-relaxed text-muted-foreground text-pretty">{description}</p>
      ) : null}
    </div>
  )
}
