import Link from 'next/link'
import { buttonClasses } from '@/components/ui/button'
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
      className={cn('rounded-xl border border-border bg-card text-card-foreground', className)}
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
    <header className="flex items-start justify-between gap-3 border-b border-border p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-bold text-balance">{title}</h2>
        {description ? (
          <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
        ) : null}
      </div>
      {action}
    </header>
  )
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: { href: string; label: string }
}) {
  return (
    <div className="flex flex-col items-center gap-1 px-4 py-10 text-center">
      <p className="font-semibold">{title}</p>
      <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
        {description}
      </p>
      {action ? (
        <Link href={action.href} className={cn(buttonClasses('outline', 'sm'), 'mt-3')}>
          {action.label}
        </Link>
      ) : null}
    </div>
  )
}

export function RoleStamp({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex -rotate-3 items-center rounded-md border-2 border-dashed border-accent px-2 py-0.5 font-mono text-xs font-bold tracking-wider text-accent uppercase',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h1 className="text-2xl font-extrabold tracking-tight text-balance">{title}</h1>
      {description ? (
        <p className="leading-relaxed text-muted-foreground text-pretty">{description}</p>
      ) : null}
    </div>
  )
}
