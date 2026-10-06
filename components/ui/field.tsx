import { cn } from '@/lib/utils'

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('text-sm font-semibold text-foreground', className)} {...props} />
}

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-destructive" id={`${htmlFor}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function FormMessage({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg px-3 py-2 text-sm',
        tone === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-secondary text-secondary-foreground',
      )}
    >
      {children}
    </p>
  )
}
