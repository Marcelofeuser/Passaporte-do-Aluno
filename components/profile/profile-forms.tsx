'use client'

import { useActionState, useRef, useState } from 'react'
import { updateProfile } from '@/app/actions/account'
import { authClient } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input } from '@/components/ui/field'
import { initialActionState } from '@/lib/validation'

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(updateProfile, initialActionState)
  return (
    <form action={action} className="flex flex-col gap-4 p-4">
      <Field label="E-mail" htmlFor="profile-email">
        <Input id="profile-email" value={email} readOnly disabled />
      </Field>
      <Field label="Nome" htmlFor="profile-name" error={state.fieldErrors?.name}>
        <Input id="profile-name" name="name" defaultValue={name} required maxLength={120} autoComplete="name" />
      </Field>
      {state.message ? <FormMessage tone={state.ok ? 'success' : 'error'}>{state.message}</FormMessage> : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Salvar'}
      </Button>
    </form>
  )
}

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null)
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const currentPassword = String(form.get('current') ?? '')
    const newPassword = String(form.get('next') ?? '')
    if (newPassword.length < 8) {
      setMessage({ tone: 'error', text: 'A nova senha precisa ter pelo menos 8 caracteres.' })
      return
    }
    setPending(true)
    const result = await authClient.changePassword({ currentPassword, newPassword, revokeOtherSessions: true })
    setPending(false)
    if (result.error) {
      setMessage({ tone: 'error', text: 'Não foi possível alterar a senha. Confira a senha atual.' })
      return
    }
    formRef.current?.reset()
    setMessage({ tone: 'success', text: 'Senha alterada. Outras sessões foram encerradas.' })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
      <Field label="Senha atual" htmlFor="current">
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="Nova senha" htmlFor="next" hint="Mínimo de 8 caracteres.">
        <Input id="next" name="next" type="password" autoComplete="new-password" required minLength={8} />
      </Field>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? 'Alterando…' : 'Alterar senha'}
      </Button>
    </form>
  )
}
