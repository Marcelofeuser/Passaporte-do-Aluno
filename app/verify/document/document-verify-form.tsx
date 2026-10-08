'use client'

import { useState } from 'react'
import type { DocumentLookup } from '@/lib/documents'
import { verifyDocumentCodeAction as verifyDocumentByCode } from '@/app/actions/document-verify'

/** Formulário público de validação: consulta o código via server action e mostra o resultado, sem sessão. */
export function DocumentVerifyForm({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? '')
  const [result, setResult] = useState<DocumentLookup | null>(null)
  const [checking, setChecking] = useState(false)

  async function check() {
    if (code.trim().length < 8) {
      setResult({ ok: false, status: 'NOT_FOUND' })
      return
    }
    setChecking(true)
    try {
      setResult(await verifyDocumentByCode(code))
    } finally {
      setChecking(false)
    }
  }

  const tone =
    result?.status === 'VALID'
      ? 'border-primary/40 bg-primary/10 text-primary'
      : result
        ? 'border-destructive/40 bg-destructive/10 text-destructive'
        : ''

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void check()
        }}
        className="flex flex-col gap-2 sm:flex-row"
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Digite o código do documento (ex.: DOC-7F3A2B9C-4821)"
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <button
          type="submit"
          disabled={checking}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {checking ? 'Consultando…' : 'Validar'}
        </button>
      </form>

      {result ? (
        <div className={`rounded-lg border p-4 text-sm ${tone}`}>
          {result.status === 'VALID' ? (
            <>
              <p className="font-bold">✅ Documento autêntico</p>
              <p className="mt-1">{result.schoolName}</p>
              <p className="mt-1 text-xs opacity-80">
                Emitido em {result.issuedAt ? result.issuedAt.toLocaleDateString('pt-BR') : '—'} · código{' '}
                <span className="font-mono">{result.verificationCode}</span>
              </p>
            </>
          ) : (
            <p className="font-bold">❌ Código não encontrado. Confira se foi transcrito corretamente.</p>
          )}
        </div>
      ) : null}
    </div>
  )
}
