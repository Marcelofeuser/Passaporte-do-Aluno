'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input } from '@/components/ui/field'

type Mode = 'sign-in' | 'sign-up'

export function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const isSignUp = mode === 'sign-up'

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const name = String(form.get('name') ?? '').trim()

    if (isSignUp && password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }

    setPending(true)
    const result = isSignUp
      ? await authClient.signUp.email({ email, password, name })
      : await authClient.signIn.email({ email, password })
    setPending(false)

    if (result.error) {
      setError(
        isSignUp
          ? 'Não foi possível criar a conta. Verifique os dados e tente novamente.'
          : 'E-mail ou senha incorretos.',
      )
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {isSignUp ? 'Criar sua conta' : 'Entrar'}
        </h1>
        <p className="leading-relaxed text-muted-foreground">
          {isSignUp
            ? 'Depois do cadastro, a escola vincula você ao seu perfil.'
            : 'Acesse o passaporte da sua escola.'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate={false}>
        {isSignUp ? (
          <Field label="Nome completo" htmlFor="name">
            <Input id="name" name="name" autoComplete="name" required maxLength={120} />
          </Field>
        ) : null}
        <Field label="E-mail" htmlFor="email">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
          />
        </Field>
        <Field
          label="Senha"
          htmlFor="password"
          hint={isSignUp ? 'Mínimo de 8 caracteres.' : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
            minLength={isSignUp ? 8 : undefined}
          />
        </Field>

        {error ? <FormMessage tone="error">{error}</FormMessage> : null}

        <Button type="submit" disabled={pending}>
          {pending ? 'Aguarde…' : isSignUp ? 'Criar conta' : 'Entrar'}
        </Button>
      </form>

      <div className="flex flex-col gap-2 text-sm">
        {isSignUp ? (
          <p className="text-muted-foreground">
            Já tem conta?{' '}
            <Link href="/sign-in" className="font-semibold text-primary underline-offset-4 hover:underline">
              Entrar
            </Link>
          </p>
        ) : (
          <>
            <Link
              href="/forgot-password"
              className="font-semibold text-primary underline-offset-4 hover:underline"
            >
              Esqueci minha senha
            </Link>
            <p className="text-muted-foreground">
              Ainda não tem conta?{' '}
              <Link href="/sign-up" className="font-semibold text-primary underline-offset-4 hover:underline">
                Criar conta
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
