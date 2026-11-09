import { z } from 'zod'

export const ACHIEVEMENT_CATEGORIES = {
  ACADEMIC: 'Acadêmica',
  SPORTS: 'Esportiva',
  ARTS: 'Artística',
  SCIENCE: 'Científica',
  SOCIAL: 'Social',
  TECHNOLOGY: 'Tecnologia',
  LANGUAGES: 'Idiomas',
  OTHER: 'Outra',
} as const

export type AchievementCategory = keyof typeof ACHIEVEMENT_CATEGORIES

export function achievementCategoryLabel(category: string) {
  return ACHIEVEMENT_CATEGORIES[category as AchievementCategory] ?? 'Outra'
}

export const achievementInput = z.object({
  category: z.enum(['ACADEMIC', 'SPORTS', 'ARTS', 'SCIENCE', 'SOCIAL', 'TECHNOLOGY', 'LANGUAGES', 'OTHER']),
  title: z.string().trim().min(3, 'Informe um título').max(120, 'Máximo de 120 caracteres'),
  description: z.string().trim().min(3, 'Descreva a conquista').max(2000, 'Máximo de 2.000 caracteres'),
  achievedOn: z.iso.date('Informe uma data válida'),
})
