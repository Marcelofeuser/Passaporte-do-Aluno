'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'

export function TwoFactorForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [useBackupCode, setUseBackupCode] = useState(false)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setPending(true)
    const code = String(new FormData(event.currentTarget).get('code') ?? '').replace(/\s/g, '')
    const result = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code, disableSession: false, trustDevice: false })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice: false })
    setPending(false)
    if (result.error) {
      setError('Código inválido ou expirado. Tente novamente.')
      return
    }
    router.replace('/dashboard')
    router.refresh()
  }

  return (
    <section className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-border bg-card p-6">
      <h1 className="text-2xl font-extrabold">Verificação em duas etapas</h1>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {useBackupCode
          ? 'Digite um código de recuperação que ainda não tenha sido usado.'
          : 'Digite o código atual do seu aplicativo autenticador para concluir o acesso.'}
      </p>
      <form onSubmit={submit} className="space-y-4">
        <label className="block space-y-1 text-sm font-semibold">
          {useBackupCode ? 'Código de recuperação' : 'Código de 6 dígitos'}
          <input name="code" inputMode={useBackupCode ? 'text' : 'numeric'} autoComplete="one-time-code" required className="h-12 w-full rounded-lg border border-border bg-background px-3 font-mono tracking-widest" />
        </label>
        <button disabled={pending} className="h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">
          {pending ? 'Verificando…' : 'Confirmar código'}
        </button>
      </form>
      <button type="button" onClick={() => { setUseBackupCode((value) => !value); setError('') }} className="text-sm font-semibold text-primary underline-offset-4 hover:underline">
        {useBackupCode ? 'Usar código do autenticador' : 'Usar um código de recuperação'}
      </button>
      {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
