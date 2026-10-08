'use client'

import { useActionState } from 'react'
import { askFamilyFaq, FAQ_TOPICS, type FaqState } from '@/app/actions/family-faq'
import { initialActionState } from '@/lib/validation'

/** Perguntas rápidas com respostas geradas sobre os dados reais da escola do usuário. */
export function FamilyFaq() {
  const [state, formAction, pending] = useActionState<FaqState | null, FormData>(askFamilyFaq, null)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FAQ_TOPICS.map((t) => (
          <form key={t.id} action={formAction}>
            <input type="hidden" name="topic" value={t.id} />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
            >
              {t.label}
            </button>
          </form>
        ))}
      </div>
      {state?.answer ? (
        <div
          role={state.ok ? 'status' : 'alert'}
          className={`whitespace-pre-line rounded-lg border p-4 text-sm ${state.ok ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}
        >
          {state.answer}
        </div>
      ) : pending ? (
        <p className="text-sm text-muted-foreground">Consultando os dados da escola…</p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Respostas geradas sobre os dados reais da sua escola — nada sensível é exibido aqui.
      </p>
    </div>
  )
}
