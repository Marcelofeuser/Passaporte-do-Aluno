'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input } from '@/components/ui/field'

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim()
    setPending(true)
    await authClient.requestPasswordReset({ email, redirectTo: '/reset-password' })
    setPending(false)
    // Mesma resposta sempre, para não revelar se o e-mail está cadastrado.
    setSent(true)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Recuperar senha</h1>
        <p className="leading-relaxed text-muted-foreground">
          Informe seu e-mail e enviaremos um link para criar uma nova senha.
        </p>
      </div>
      {sent ? (
        <FormMessage tone="success">
          Se houver uma conta com esse e-mail, você receberá o link de recuperação em instantes.
        </FormMessage>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="E-mail" htmlFor="email">
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? 'Enviando…' : 'Enviar link'}
          </Button>
        </form>
      )}
      <Link href="/sign-in" className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
        Voltar para o login
      </Link>
    </div>
  )
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-extrabold tracking-tight">Link inválido</h1>
        <p className="leading-relaxed text-muted-foreground">
          Este link de recuperação é inválido ou expirou. Solicite um novo.
        </p>
        <Link href="/forgot-password" className="font-semibold text-primary underline-offset-4 hover:underline">
          Solicitar novo link
        </Link>
      </div>
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    const newPassword = String(form.get('password') ?? '')
    const confirm = String(form.get('confirm') ?? '')
    if (newPassword.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.')
    if (newPassword !== confirm) return setError('As senhas não conferem.')

    setPending(true)
    const result = await authClient.resetPassword({ newPassword, token: token! })
    setPending(false)
    if (result.error) {
      setError('Não foi possível redefinir a senha. O link pode ter expirado.')
      return
    }
    router.push('/sign-in?reset=1')
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">Nova senha</h1>
        <p className="leading-relaxed text-muted-foreground">Escolha uma senha com pelo menos 8 caracteres.</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Nova senha" htmlFor="password">
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        <Field label="Confirmar senha" htmlFor="confirm">
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
        </Field>
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
        <Button type="submit" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </div>
  )
}
