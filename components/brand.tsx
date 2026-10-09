import Link from 'next/link'
import { BookMarked } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Brand({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('group flex min-h-12 items-center gap-2.5 font-display font-extrabold', className)}>
      <span className="flex size-10 -rotate-6 items-center justify-center rounded-2xl bg-linear-to-br from-primary to-secondary-foreground text-primary-foreground shadow-soft transition-transform group-hover:animate-wiggle">
        <BookMarked className="size-5" aria-hidden="true" />
      </span>
      <span className="tracking-tight">Passaporte do Aluno</span>
    </Link>
  )
}
