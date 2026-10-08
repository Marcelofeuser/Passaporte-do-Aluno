'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { confirmPassportVerification, lookupPassport, type VerifyResult } from '@/app/actions/passport-verify'
import { Button } from '@/components/ui/button'
import { initialActionState, type ActionState } from '@/lib/validation'

/**
 * Validador do passaporte (client): consulta o token digitado/colado (ou extraído da URL
 * lida pelo leitor de QR) antes de registrar a leitura — nada é gravado sem confirmação.
 */
export function PassportVerifyForm({ initialToken }: { initialToken?: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(confirmPassportVerification, initialActionState)
  const [token, setToken] = useState(initialToken ?? '')
  const [result, setResult] = useState<VerifyResult | null>(null)
  const [checking, setChecking] = useState(false)
  const ref = useRef<HTMLFormElement>(null)

  async function check() {
    if (token.trim().length < 16) {
      setResult({ ok: false, status: 'NOT_FOUND', message: 'Cole o código completo do QR (URL ou token).' })
      return
    }
    setChecking(true)
    try {
      setResult(await lookupPassport(token))
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    if (initialToken) void check()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const tone =
    result?.status === 'VALID'
      ? 'border-primary/40 bg-primary/10 text-primary'
      : result
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : ''

  return (
    <div className="space-y-4">
      <form
        ref={ref}
        onSubmit={(e) => {
          e.preventDefault()
          void check()
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          name="token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Cole a URL ou o código do QR Code"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <Button type="button" onClick={() => void check()} disabled={checking}>
          {checking ? 'Consultando…' : 'Consultar'}
        </Button>
      </form>

      {result ? (
        <div className={`rounded-lg border p-4 text-sm ${tone}`}>
          <p className="font-bold">{result.status === 'VALID' ? '✅ Válido' : result.status === 'REVOKED' ? '⛔ Revogado' : '❓ Não encontrado'}</p>
          {result.studentName ? (
            <p className="mt-1">
              {result.socialName || result.studentName}
              {result.registrationCode ? ` · Matrícula ${result.registrationCode}` : ''}
            </p>
          ) : null}
          <p className="mt-1 text-xs opacity-80">{result.message}</p>
        </div>
      ) : null}

      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="token" value={token} />
        <Button type="submit" disabled={pending || !result || result.status === 'NOT_FOUND'}>
          {pending ? 'Registrando…' : 'Registrar leitura'}
        </Button>
        {state.message ? (
          <p role={state.ok ? 'status' : 'alert'} className={state.ok ? 'text-sm text-primary' : 'text-sm text-destructive'}>
            {state.message}
          </p>
        ) : null}
      </form>
      <p className="text-xs text-muted-foreground">
        A leitura fica registrada com seu usuário, data/hora e resultado — para portaria e eventos.
      </p>
    </div>
  )
}
