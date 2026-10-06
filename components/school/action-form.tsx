'use client'

import { useActionState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { FormMessage } from '@/components/ui/field'
import { cn } from '@/lib/utils'
import { initialActionState, type ActionState } from '@/lib/validation'

type Props = {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>
  children: React.ReactNode
  submitLabel: string
  pendingLabel?: string
  resetOnSuccess?: boolean
  className?: string
  fieldLabels?: Record<string, string>
}

/**
 * Formulário ligado a uma server action com `ActionState`.
 * Os erros de campo são exibidos agrupados, com o rótulo do campo quando informado.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = 'Salvando…',
  resetOnSuccess = true,
  className,
  fieldLabels = {},
}: Props) {
  const [state, formAction, pending] = useActionState(action, initialActionState)
  const ref = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset()
  }, [state, resetOnSuccess])

  const errors = Object.entries(state.fieldErrors ?? {})

  return (
    <form ref={ref} action={formAction} className={cn('flex flex-col gap-4', className)}>
      {children}
      {errors.length > 0 ? (
        <div role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <ul className="flex flex-col gap-0.5">
            {errors.map(([key, message]) => (
              <li key={key}>
                {fieldLabels[key] ? <strong className="font-semibold">{fieldLabels[key]}: </strong> : null}
                {message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {state.message ? <FormMessage tone={state.ok ? 'success' : 'error'}>{state.message}</FormMessage> : null}
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  )
}

/** Botão de envio para formulários simples (remover, arquivar) com confirmação nativa. */
export function ConfirmSubmit({
  children,
  confirm,
  className,
}: {
  children: React.ReactNode
  confirm?: string
  className?: string
}) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault()
      }}
      className={cn(
        'rounded-md px-2 py-1 text-sm font-semibold text-destructive hover:bg-destructive/10 focus-visible:outline-2 focus-visible:outline-ring',
        className,
      )}
    >
      {children}
    </button>
  )
}
