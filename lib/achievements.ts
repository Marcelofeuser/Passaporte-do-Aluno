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
