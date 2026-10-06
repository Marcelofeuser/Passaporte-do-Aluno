import Link from 'next/link'
import { BookMarked } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Brand({ href = '/', className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn('flex min-h-11 items-center gap-2 font-extrabold', className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <BookMarked className="size-4" aria-hidden="true" />
      </span>
      <span className="tracking-tight">Passaporte do Aluno</span>
    </Link>
  )
}
