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

export const optionalText = (max: number) =>
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

const digits = (len: number, label: string) =>
  optionalText(24)
    .transform((v) => (v ? v.replace(/\D/g, '') : null))
    .refine((v) => !v || v.length === len, `${label} deve ter ${len} dígitos`)

const optionalEmail = optionalText(160).refine(
  (v) => !v || z.email().safeParse(v).success,
  'E-mail inválido',
)

const optionalDate = optionalText(10).refine(
  (v) => !v || /^\d{4}-\d{2}-\d{2}$/.test(v),
  'Data inválida',
)

const id = z.uuid('Registro inválido')
const optionalId = z
  .string()
  .transform((v) => (v === '' ? null : v))
  .pipe(z.uuid().nullable())
  .optional()

export const addressInput = z.object({
  addressZip: digits(8, 'CEP'),
  addressStreet: optionalText(160),
  addressNumber: optionalText(20),
  addressComplement: optionalText(80),
  addressDistrict: optionalText(80),
  addressCity: optionalText(80),
  addressState: optionalText(2)
    .transform((v) => (v ? v.toUpperCase() : null))
    .refine((v) => !v || /^[A-Z]{2}$/.test(v), 'UF inválida'),
})

export const schoolSettingsInput = addressInput.extend({
  name: z.string().trim().min(3, 'Informe o nome da escola').max(160),
  legalName: optionalText(200),
  cnpj: digits(14, 'CNPJ'),
  inepCode: digits(8, 'Código INEP'),
  stateRegistration: optionalText(30),
  directorName: optionalText(120),
  email: optionalEmail,
  phone: optionalText(20),
  website: optionalText(200).refine(
    (v) => !v || z.url().safeParse(v).success,
    'Informe a URL completa (https://...)',
  ),
})

export const SEX_OPTIONS = { F: 'Feminino', M: 'Masculino', O: 'Outro / não informar' } as const

export const studentInput = addressInput.extend({
  fullName: z.string().trim().min(3, 'Informe o nome completo').max(160),
  socialName: optionalText(160),
  birthDate: optionalDate,
  sex: z.enum(['F', 'M', 'O', '']).optional().transform((v) => v || null),
  cpf: digits(11, 'CPF'),
  registrationCode: optionalText(30),
  email: optionalEmail,
  phone: optionalText(20),
  notes: optionalText(2000),
})

export const RELATIONSHIPS = {
  MOTHER: 'Mãe',
  FATHER: 'Pai',
  GUARDIAN: 'Responsável legal',
  GRANDPARENT: 'Avó/Avô',
  OTHER: 'Outro',
} as const

export const parentInput = z.object({
  studentId: id,
  fullName: z.string().trim().min(3, 'Informe o nome do responsável').max(160),
  relationship: z.enum(Object.keys(RELATIONSHIPS) as [keyof typeof RELATIONSHIPS], 'Parentesco inválido'),
  email: optionalEmail,
  phone: optionalText(20),
  cpf: digits(11, 'CPF'),
})

export const teacherInput = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome do professor').max(160),
  email: optionalEmail,
  phone: optionalText(20),
})

export const subjectInput = z.object({
  name: z.string().trim().min(2, 'Informe o nome da disciplina').max(80),
  code: optionalText(12),
})

export const academicYearInput = z
  .object({
    year: z.coerce.number().int().min(2000, 'Ano inválido').max(2100, 'Ano inválido'),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe o início'),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe o término'),
    isCurrent: z.string().optional().transform((v) => v === 'on'),
  })
  .refine((v) => v.endsOn > v.startsOn, { message: 'O término deve ser após o início', path: ['endsOn'] })

export const SHIFTS = {
  MORNING: 'Manhã',
  AFTERNOON: 'Tarde',
  EVENING: 'Noite',
  FULL: 'Integral',
} as const

export const classInput = z.object({
  academicYearId: id,
  name: z.string().trim().min(1, 'Informe o nome da turma').max(60),
  grade: z.string().trim().min(1, 'Informe a série/ano').max(60),
  shift: z.enum(Object.keys(SHIFTS) as [keyof typeof SHIFTS], 'Turno inválido'),
  capacity: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 200), 'Capacidade inválida'),
  homeroomTeacherId: optionalId,
})

export const classSubjectInput = z.object({
  classId: id,
  subjectId: id,
  teacherId: optionalId,
  workloadHours: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : null))
    .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 2000), 'Carga horária inválida'),
})

export const teacherSubjectInput = z.object({ teacherId: id, subjectId: id })

export const ENROLLMENT_STATUS = {
  ACTIVE: 'Ativa',
  TRANSFERRED: 'Transferida',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
} as const

export const enrollmentInput = z.object({ studentId: id, classId: id, enrolledOn: optionalDate })

export const enrollmentStatusInput = z.object({
  enrollmentId: id,
  status: z.enum(['TRANSFERRED', 'COMPLETED', 'CANCELLED'], 'Situação inválida'),
  changedOn: optionalDate,
  note: optionalText(300),
})

export const ASSESSMENT_KINDS = {
  EXAM: 'Prova',
  ASSIGNMENT: 'Trabalho',
  ACTIVITY: 'Atividade',
  PROJECT: 'Projeto',
  RECOVERY: 'Recuperação',
} as const

const decimal = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => Number(v.replace(',', '.')))
    .refine((v) => Number.isFinite(v) && v >= min && v <= max, `${label} deve estar entre ${min} e ${max}`)

export const assessmentInput = z.object({
  classSubjectId: id,
  kind: z.enum(Object.keys(ASSESSMENT_KINDS) as [keyof typeof ASSESSMENT_KINDS], 'Tipo inválido'),
  title: z.string().trim().min(2, 'Informe o título').max(120),
  term: z.coerce.number().int().min(1, 'Bimestre inválido').max(4, 'Bimestre inválido'),
  heldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Informe a data'),
  weight: decimal('Peso', 0.1, 10),
  maxScore: decimal('Nota máxima', 1, 100),
  notes: optionalText(500),
})

export const passingGradeInput = z.object({ passingGrade: decimal('Média', 0, 10) })

/** Converte o texto digitado ("7,5", "8") em nota. `undefined` = inválida, `null` = em branco. */
export function parseScore(raw: string, maxScore: number): number | null | undefined {
  const v = raw.trim().replace(',', '.')
  if (v === '') return null
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > maxScore) return undefined
  return Math.round(n * 100) / 100
}

export const DOCUMENT_KINDS = {
  BIRTH_CERTIFICATE: 'Certidão de nascimento',
  ID: 'RG / documento de identidade',
  CPF: 'CPF',
  VACCINATION: 'Carteira de vacinação',
  TRANSFER: 'Declaração de transferência',
  MEDICAL: 'Laudo / atestado médico',
  OTHER: 'Outro',
} as const

export const documentInput = z.object({
  studentId: id,
  kind: z.enum(Object.keys(DOCUMENT_KINDS) as [keyof typeof DOCUMENT_KINDS], 'Tipo inválido'),
  label: optionalText(120),
})

/** Extrai apenas campos de texto do FormData (ignora arquivos). */
export function formText(formData: FormData) {
  const out: Record<string, string> = {}
  for (const [key, value] of formData) if (typeof value === 'string') out[key] = value
  return out
}

export function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60)
}
