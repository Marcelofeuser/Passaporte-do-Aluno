import { cn } from '@/lib/utils'

const variants = {
  primary:
    'bg-primary text-primary-foreground shadow-[0_4px_0_0_var(--primary-shadow)] hover:brightness-105 active:shadow-[0_1px_0_0_var(--primary-shadow)]',
  secondary:
    'bg-secondary text-secondary-foreground shadow-[0_4px_0_0_var(--secondary-shadow)] active:shadow-[0_1px_0_0_var(--secondary-shadow)]',
  outline: 'border-2 border-input bg-card text-foreground hover:border-primary/50 hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  destructive:
    'bg-destructive text-destructive-foreground shadow-[0_4px_0_0_var(--destructive-shadow)] hover:brightness-105 active:shadow-[0_1px_0_0_var(--destructive-shadow)]',
} as const

const sizes = {
  md: 'h-12 px-5 text-base',
  sm: 'h-10 px-4 text-sm',
  icon: 'size-12',
} as const

export type ButtonVariant = keyof typeof variants

export function buttonClasses(variant: ButtonVariant = 'primary', size: keyof typeof sizes = 'md') {
  return cn(
    'inline-flex select-none items-center justify-center gap-2 rounded-2xl font-bold transition-all duration-150 ease-out hover:-translate-y-0.5 active:translate-y-[3px] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5',
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
