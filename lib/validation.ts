import { z } from 'zod'
import { SCHOOL_ROLES } from '@/lib/rbac'

export type ActionState = {
  ok: boolean
  message?: string
  fieldErrors?: Record<string, string>
}

export const initialActionState: ActionState = { ok: false }

export function toFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!out[key]) out[key] = issue.message
  }
  return out
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional()

export const schoolInput = z.object({
  name: z.string().trim().min(3, 'Informe o nome da escola').max(160),
  cnpj: optionalText(18).refine(
    (v) => !v || v.replace(/\D/g, '').length === 14,
    'CNPJ deve ter 14 dígitos',
  ),
  email: optionalText(160).refine((v) => !v || z.email().safeParse(v).success, 'E-mail inválido'),
  phone: optionalText(20),
})

export const schoolUserInput = z.object({
  schoolId: z.uuid('Escola inválida'),
  name: z.string().trim().min(2, 'Informe o nome').max(120),
  email: z.email('E-mail inválido').transform((v) => v.trim().toLowerCase()),
  role: z.enum(SCHOOL_ROLES as [string, ...string[]], 'Perfil inválido'),
  password: z
    .string()
    .max(128)
    .refine((v) => v === '' || v.length >= 8, 'Mínimo de 8 caracteres')
    .optional(),
})

export const profileInput = z.object({
  name: z.string().trim().min(2, 'Informe seu nome').max(120),
})

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}
