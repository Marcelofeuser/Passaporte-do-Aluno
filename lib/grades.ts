export type GradeStatus = 'PENDING' | 'APPROVED' | 'RECOVERY' | 'FAILED'

export const GRADE_STATUS_LABEL: Record<GradeStatus, string> = {
  PENDING: 'Sem notas',
  APPROVED: 'Aprovado',
  RECOVERY: 'Em recuperação',
  FAILED: 'Reprovado',
}

export type GradeItem = { kind: string; weight: number; maxScore: number; score: number | null }

export type GradeResult = {
  average: number | null
  recovery: number | null
  final: number | null
  status: GradeStatus
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * Média ponderada das avaliações regulares, normalizada para 0–10.
 * A recuperação substitui a média quando for maior. Notas em branco não entram no cálculo.
 */
export function computeResult(items: GradeItem[], passingGrade: number): GradeResult {
  const regular = items.filter((i) => i.kind !== 'RECOVERY' && i.score !== null)
  const recoveries = items.filter((i) => i.kind === 'RECOVERY' && i.score !== null)

  const totalWeight = regular.reduce((acc, i) => acc + i.weight, 0)
  const average =
    totalWeight > 0
      ? round1(regular.reduce((acc, i) => acc + ((i.score as number) / i.maxScore) * 10 * i.weight, 0) / totalWeight)
      : null
  const recovery = recoveries.length
    ? round1(Math.max(...recoveries.map((i) => ((i.score as number) / i.maxScore) * 10)))
    : null

  if (average === null) return { average, recovery, final: null, status: 'PENDING' }
  const final = recovery !== null ? Math.max(average, recovery) : average
  const status: GradeStatus = final >= passingGrade ? 'APPROVED' : recovery === null ? 'RECOVERY' : 'FAILED'
  return { average, recovery, final, status }
}

export function formatScore(n: number | null | undefined) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
}
