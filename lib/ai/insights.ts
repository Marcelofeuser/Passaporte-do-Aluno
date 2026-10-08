import { buildPedagogyReport, type PedagogyReport, type StudentInsight } from '@/lib/ai/pedagogy'
import { GRADE_STATUS_LABEL } from '@/lib/grades'

/* Camada LLM opcional (Fase 12): usa endpoint OpenAI-compatível se AI_API_URL/AI_API_KEY
   estiverem configuradas; caso contrário, todo texto sai do gerador determinístico. */

const AI_URL = process.env.AI_API_URL
const AI_KEY = process.env.AI_API_KEY
const AI_MODEL = process.env.AI_MODEL ?? 'gpt-4o-mini'

export function aiEnabled() {
  return Boolean(AI_URL && AI_KEY)
}

async function chat(messages: { role: 'system' | 'user'; content: string }[], maxTokens = 500): Promise<string | null> {
  if (!aiEnabled()) return null
  try {
    const res = await fetch(`${AI_URL!.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${AI_KEY}` },
      body: JSON.stringify({ model: AI_MODEL, messages, max_tokens: maxTokens, temperature: 0.3 }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
    return data.choices?.[0]?.message?.content?.trim() ?? null
  } catch {
    return null
  }
}

/** Resumo executivo da turma para reuniões de pais (LLM se houver; senão regras). */
export async function generateClassNarrative(schoolId: string, classId: string): Promise<string> {
  const report = await buildPedagogyReport(schoolId)
  const cls = report?.classes.find((c) => c.classId === classId)
  if (!report || !cls) return 'Sem dados suficientes para gerar o resumo desta turma.'

  const members = report.students.filter((s) => s.className === cls.className)
  const facts = [
    `Turma ${cls.grade} ${cls.className} (${cls.year}), ${cls.students} alunos.`,
    `Média geral: ${cls.average ?? 'sem notas lançadas'}.`,
    `Alunos em risco: ${cls.atRisk} (${cls.failing} com reprovação).`,
    `Aprovados: ${members.filter((m) => m.overallFinal !== null && m.overallFinal >= report.passingGrade && m.failingSubjects.length === 0).length}.`,
    `Frequência média: ${avgAttendance(members)}.`,
  ].join(' ')

  const llm = await chat([
    { role: 'system', content: 'Você é um assistente pedagógico de uma escola brasileira. Escreva em português do Brasil, tom profissional e empático, no máximo 4 frases. Use SOMENTE os dados fornecidos — não invente números ou nomes.' },
    { role: 'user', content: `${facts}\n\nEscreva um resumo executivo desta turma para a reunião de pais.` },
  ])
  return llm ?? `${facts} ${suggestForClass(cls.atRisk, cls.failing, report.minAttendance)}`
}

/** Sugestões de intervenção para um aluno (regras determinísticas sobre os números reais). */
export function interventionsFor(stu: StudentInsight, minAttendance: number): string[] {
  const out: string[] = []
  if (stu.failingSubjects.length > 0) {
    out.push(`Conselho de classe para ${stu.failingSubjects.join(', ')}: alinhar recuperação e comunicação com a família.`)
  }
  if (stu.recoverySubjects.length > 0) {
    out.push(`Acompanhar de perto as recuperações de ${stu.recoverySubjects.join(', ')} antes do fechamento do bimestre.`)
  }
  if (stu.attendancePct !== null && stu.attendancePct < minAttendance) {
    out.push(`Convocar a família pelo risco de reprovação por falta (frequência ${stu.attendancePct.toFixed(1)}% < ${minAttendance}%).`)
  } else if (stu.absences >= 10) {
    out.push(`Registrar ocorrência de alerta: ${stu.absences} faltas acumuladas no ano.`)
  }
  if (stu.decliningSubjects.length > 0) {
    out.push(`Reforço escolar em ${stu.decliningSubjects.join(', ')} — houve queda entre os últimos bimestres.`)
  }
  if (out.length === 0) {
    out.push('Sem alertas: manter o acompanhamento regular e registrar conquistas positivas.')
  }
  return out
}

function suggestForClass(atRisk: number, failing: number, minAttendance: number) {
  if (atRisk === 0) return 'Turma sem alertas no momento; manter o ritmo de acompanhamento regular.'
  const parts = [`${atRisk} aluno(s) exigem atenção`]
  if (failing > 0) parts.push(`${failing} com reprovação em ao menos uma disciplina`)
  parts.push(`rever frequência abaixo de ${minAttendance}% com as famílias`)
  return `${parts.join(', ')}. Sugestão: conselho de classe para revisar intervenções.`
}

function avgAttendance(members: StudentInsight[]): string {
  const vals = members.map((m) => m.attendancePct).filter((v): v is number => v !== null)
  if (vals.length === 0) return 'sem aulas registradas'
  return `${(Math.round((vals.reduce((a, v) => a + v, 0) / vals.length) * 10) / 10).toFixed(1)}%`
}

export const RISK_LABEL: Record<StudentInsight['risk'], string> = {
  LOW: 'Sem risco',
  MEDIUM: 'Atenção',
  HIGH: 'Crítico',
}

export { GRADE_STATUS_LABEL }
