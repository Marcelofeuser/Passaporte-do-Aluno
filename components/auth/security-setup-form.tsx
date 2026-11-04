'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { authClient } from '@/lib/auth-client'
import { completeInitialPasswordChange } from '@/app/actions/security'

export function SecuritySetupForm({ mustChangePassword }: { mustChangePassword: boolean }) {
  const router = useRouter()
  const [mustChange, setMustChange] = useState(mustChangePassword)
  const [totpURI, setTotpURI] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function enroll(password: string) {
    setPending(true)
    setError('')
    const result = await authClient.twoFactor.enable({ password, method: 'totp' })
    setPending(false)
    if (result.error || !result.data || result.data.method !== 'totp') {
      setError('Não foi possível iniciar a configuração do autenticador. Confira a senha e tente novamente.')
      return
    }
    setTotpURI(result.data.totpURI)
    setBackupCodes(result.data.backupCodes)
  }

  async function changePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const formData = new FormData(event.currentTarget)
    const nextPassword = String(formData.get('newPassword') ?? '')
    const result = await completeInitialPasswordChange(formData)
    setPending(false)
    if (!result.ok) {
      setError(result.message ?? 'Não foi possível trocar a senha.')
      return
    }
    setMustChange(false)
    await enroll(nextPassword)
  }

  async function verifyAuthenticator(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const code = String(form.get('code') ?? '').replace(/\s/g, '')
    const result = await authClient.twoFactor.verifyTotp({ code, trustDevice: false })
    setPending(false)
    if (result.error) {
      setError('Código inválido ou expirado. Confira o relógio do celular e tente novamente.')
      return
    }
    setVerified(true)
    router.refresh()
  }

  const secret = totpURI ? new URL(totpURI).searchParams.get('secret') ?? '' : ''

  return (
    <section className="mx-auto w-full max-w-xl space-y-5 rounded-2xl border border-border bg-card p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-extrabold">Proteja sua conta Super Admin</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Conclua a troca da senha temporária e configure um aplicativo autenticador antes de continuar.
        </p>
      </header>

      {mustChange ? (
        <form onSubmit={changePassword} className="space-y-4">
          <label className="block space-y-1 text-sm font-semibold">
            Senha temporária
            <input name="currentPassword" type="password" autoComplete="current-password" required className="h-11 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          <label className="block space-y-1 text-sm font-semibold">
            Nova senha (mínimo 12 caracteres)
            <input name="newPassword" type="password" autoComplete="new-password" minLength={12} required className="h-11 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          <label className="block space-y-1 text-sm font-semibold">
            Confirme a nova senha
            <input name="confirmation" type="password" autoComplete="new-password" minLength={12} required className="h-11 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          <button disabled={pending} className="h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">
            {pending ? 'Salvando…' : 'Trocar senha e configurar autenticador'}
          </button>
        </form>
      ) : !totpURI && !verified ? (
        <form onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); void enroll(String(data.get('password') ?? '')) }} className="space-y-4">
          <label className="block space-y-1 text-sm font-semibold">
            Senha atual
            <input name="password" type="password" autoComplete="current-password" required className="h-11 w-full rounded-lg border border-border bg-background px-3" />
          </label>
          <button disabled={pending} className="h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">
            {pending ? 'Preparando…' : 'Ativar aplicativo autenticador'}
          </button>
        </form>
      ) : null}

      {totpURI && !verified ? (
        <div className="space-y-4">
          <div className="rounded-xl bg-muted p-4 text-sm">
            <p>Adicione uma conta no Google Authenticator, Microsoft Authenticator, 1Password ou outro app TOTP. Insira esta chave manualmente:</p>
            <code className="mt-3 block break-all rounded bg-background p-3 font-mono">{secret}</code>
            <p className="mt-3 text-xs text-muted-foreground">Emissor: Passaporte do Aluno · A chave é secreta; não a envie a ninguém.</p>
          </div>
          <form onSubmit={verifyAuthenticator} className="space-y-3">
            <label className="block space-y-1 text-sm font-semibold">
              Código de 6 dígitos do aplicativo
              <input name="code" inputMode="numeric" pattern="[0-9 ]{6,8}" autoComplete="one-time-code" maxLength={8} required className="h-11 w-full rounded-lg border border-border bg-background px-3 font-mono tracking-widest" />
            </label>
            <button disabled={pending} className="h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60">
              {pending ? 'Verificando…' : 'Confirmar autenticador'}
            </button>
          </form>
        </div>
      ) : null}

      {verified ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950">
            Autenticador confirmado. Guarde estes códigos de recuperação em local seguro; cada um pode ser usado uma única vez.
          </div>
          <ul className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-4 font-mono text-sm">
            {backupCodes.map((code) => <li key={code}>{code}</li>)}
          </ul>
          <button onClick={() => { router.replace('/dashboard'); router.refresh() }} className="h-11 w-full rounded-lg bg-primary px-4 font-semibold text-primary-foreground">
            Ir ao painel
          </button>
        </div>
      ) : null}

      {error ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
