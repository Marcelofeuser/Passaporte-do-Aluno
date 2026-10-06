import type { Metadata } from 'next'
import { ResetPasswordForm } from '@/components/auth/password-recovery-forms'

export const metadata: Metadata = { title: 'Nova senha' }

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const { token, error } = await searchParams
  return <ResetPasswordForm token={error ? null : (token ?? null)} />
}
