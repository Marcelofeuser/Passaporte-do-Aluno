import { cn } from '@/lib/utils'

const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-card text-foreground hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
} as const

const sizes = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-9 px-3 text-sm',
  icon: 'size-11',
} as const

export type ButtonVariant = keyof typeof variants

export function buttonClasses(variant: ButtonVariant = 'primary', size: keyof typeof sizes = 'md') {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
  )
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: React.ComponentProps<'button'> & { variant?: ButtonVariant; size?: keyof typeof sizes }) {
  return <button className={cn(buttonClasses(variant, size), className)} {...props} />
}
