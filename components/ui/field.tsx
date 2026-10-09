import { CircleAlert, CircleCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const control =
  'h-12 w-full rounded-2xl border-2 border-input bg-card px-4 text-base text-foreground transition-colors placeholder:text-muted-foreground hover:border-primary/40 focus-visible:border-primary focus-visible:outline-4 focus-visible:outline-primary/15'

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('font-bold text-foreground', className)} {...props} />
}

export function Input({ className, ...props }: React.ComponentProps<'input'>) {
  return <input className={cn(control, 'disabled:opacity-60', className)} {...props} />
}

export function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return <select className={cn(control, className)} {...props} />
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
    <div className="flex flex-col gap-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive" id={htmlFor + '-error'}>
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export function FormMessage({ tone, children }: { tone: 'error' | 'success'; children: React.ReactNode }) {
  const Icon = tone === 'error' ? CircleAlert : CircleCheck
  return (
    <p
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex animate-pop-in items-center gap-2 rounded-2xl px-4 py-3 font-semibold',
        tone === 'error'
          ? 'bg-destructive/10 text-destructive'
          : 'bg-secondary text-secondary-foreground',
      )}
    >
      <Icon className="size-5 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  )
}
