import type { Metadata } from 'next'
import { ForgotPasswordForm } from '@/components/auth/password-recovery-forms'

export const metadata: Metadata = { title: 'Recuperar senha' }

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
