'use client'

import { useActionState } from 'react'
import { generateClassSummary } from '@/app/actions/ai'
import { Button } from '@/components/ui/button'
import { initialActionState } from '@/lib/validation'

/** Botão que pede o resumo da turma ao assistente e exibe a narrativa gerada. */
export function ClassSummaryButton({ classId, className }: { classId: string; className: string }) {
  const [state, formAction, pending] = useActionState(generateClassSummary, initialActionState)

  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="classId" value={classId} />
        <Button type="submit" disabled={pending}>
          {pending ? 'Analisando turma…' : `Resumo da ${className}`}
        </Button>
      </form>
      {state.message ? (
        <div
          role={state.ok ? 'status' : 'alert'}
          className={`rounded-lg border p-3 text-sm ${state.ok ? 'border-primary/30 bg-primary/5 text-foreground' : 'border-destructive/30 bg-destructive/5 text-destructive'}`}
        >
          {state.message}
        </div>
      ) : null}
    </div>
  )
}
