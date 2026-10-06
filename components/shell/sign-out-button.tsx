'use client'

import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true)
        await authClient.signOut()
        router.push('/sign-in')
        router.refresh()
      }}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50',
        className,
      )}
    >
      <LogOut className="size-4" aria-hidden="true" />
      Sair
    </button>
  )
}
