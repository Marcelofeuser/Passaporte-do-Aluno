'use client'

import { useActionState, useEffect, useRef } from 'react'
import { addSchoolUser } from '@/app/actions/users'
import { Button } from '@/components/ui/button'
import { Field, FormMessage, Input, Select } from '@/components/ui/field'
import { ROLE_LABELS, type Role } from '@/lib/rbac'
import { initialActionState } from '@/lib/validation'

export function AddUserForm({ schoolId, roles }: { schoolId: string; roles: readonly Role[] }) {
  const [state, action, pending] = useActionState(addSchoolUser, initialActionState)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.ok) formRef.current?.reset()
  }, [state])
  const err = state.fieldErrors ?? {}

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4 p-4">
      <input type="hidden" name="schoolId" value={schoolId} />
      <Field label="Nome completo" htmlFor="user-name" error={err.name}>
        <Input id="user-name" name="name" required maxLength={120} autoComplete="off" />
      </Field>
      <Field label="E-mail" htmlFor="user-email" error={err.email}>
        <Input id="user-email" name="email" type="email" required autoComplete="off" />
      </Field>
      <Field label="Perfil" htmlFor="user-role" error={err.role}>
        <Select id="user-role" name="role" required defaultValue={roles[0]}>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="Senha inicial"
        htmlFor="user-password"
        error={err.password}
        hint="Obrigatória só para quem ainda não tem conta. Mínimo de 8 caracteres."
      >
        <Input id="user-password" name="password" type="password" autoComplete="new-password" />
      </Field>
      {state.message ? (
        <FormMessage tone={state.ok ? 'success' : 'error'}>{state.message}</FormMessage>
      ) : null}
      <Button type="submit" disabled={pending}>
        {pending ? 'Salvando…' : 'Adicionar usuário'}
      </Button>
    </form>
  )
}
