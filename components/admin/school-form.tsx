'use client'

import { useActionState, useEffect, useRef } from 'react'
import { createSchool } from '@/app/actions/schools'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input } from '@/components/ui/field'
import { initialActionState } from '@/lib/validation'

export function SchoolForm() {
  const [state, action, pending] = useActionState(createSchool, initialActionState)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state])
  const err = state.fieldErrors ?? {}

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4 p-4">
      <Field label="Nome da escola" htmlFor="name" error={err.name}>
        <Input id="name" name="name" required maxLength={160} />
      </Field>
      <Field label="CNPJ (opcional)" htmlFor="cnpj" error={err.cnpj}>
        <Input id="cnpj" name="cnpj" inputMode="numeric" maxLength={18} />
      </Field>
      <Field label="E-mail (opcional)" htmlFor="email" error={err.email}>
        <Input id="email" name="email" type="email" maxLength={160} />
      </Field>
      <Field label="Telefone (opcional)" htmlFor="phone" error={err.phone}>
        <Input id="phone" name="phone" type="tel" inputMode="tel" maxLength={20} />
      </Field>
      {state.message ? (
        <FormMessage tone={state.ok ? 'success' : 'error'}>{state.message}</FormMessage>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Criando…' : 'Criar escola'}
      </Button>
    </form>
  )
}
