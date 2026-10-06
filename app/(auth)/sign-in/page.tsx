import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthForm } from '@/components/auth/auth-form'
import { FormMessage } from '@/components/ui/field'
import { getSession } from '@/lib/session'

export const metadata: Metadata = { title: 'Entrar' }

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>
}) {
  const session = await getSession()
  if (session?.user) redirect('/dashboard')
  const { reset } = await searchParams

  return (
    <div className="flex flex-col gap-4">
      {reset ? <FormMessage tone="success">Senha redefinida. Entre com a nova senha.</FormMessage> : null}
      <AuthForm mode="sign-in" />
    </div>
  )
}
