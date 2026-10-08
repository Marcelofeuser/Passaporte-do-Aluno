'use server'

import { runAction } from '@/lib/school-action'
import type { ActionState } from '@/lib/validation'
import { requireActionContext } from '@/lib/session'
import { and, desc, eq, gte, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { calendarEvent, bookLoan, schoolClass } from '@/lib/db/schema'
import { getFamilyStudents, getCurrentEnrollments } from '@/lib/attendance-queries'
import { buildPedagogyReport } from '@/lib/ai/pedagogy'
import { formatScore } from '@/lib/grades'
import { formatRate } from '@/lib/attendance'

/* FAQ Inteligente da Família (Fase 12): responde com dados reais do tenant.
   Tópicos: calendário, biblioteca, boletim/notas, portaria, matrícula. Sem LLM no v1 —
   respostas determinísticas a partir de consultas seguras (nada sensível vaza). */

export type FaqState = ActionState & { answer?: string }

const TOPICS = ['calendario', 'biblioteca', 'boletim', 'portaria', 'matricula'] as const
export type FaqTopic = (typeof TOPICS)[number]

export function isFaqTopic(v: unknown): v is FaqTopic {
  return typeof v === 'string' && (TOPICS as readonly string[]).includes(v)
}

export const FAQ_TOPICS: { id: FaqTopic; label: string }[] = [
  { id: 'calendario', label: 'Calendário e eventos' },
  { id: 'boletim', label: 'Notas e frequência' },
  { id: 'biblioteca', label: 'Biblioteca' },
  { id: 'portaria', label: 'Entradas e saídas' },
  { id: 'matricula', label: 'Matrícula' },
]

export async function askFamilyFaq(_prev: FaqState | null, formData: FormData): Promise<FaqState> {
  return runAction('ai.family_faq', async () => {
    const topic = String(formData.get('topic') ?? '')
    const ctx = await requireActionContext()
    const active = ctx.active
    if (!active?.schoolId) return { ok: false, answer: 'Sessão sem escola ativa.' }
    const schoolId = active.schoolId
    const isStudent = active.role === 'STUDENT'
    const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)
    if (students.length === 0) return { ok: false, answer: 'Nenhum aluno vinculado à sua conta.' }
    const ids = students.map((s) => s.id)
    const names = students.map((s) => s.socialName || s.fullName).join(', ')

    switch (topic) {
      case 'calendario': {
        const events = await db
          .select({ title: calendarEvent.title, startsAt: calendarEvent.startsAt, location: calendarEvent.location })
          .from(calendarEvent)
          .where(and(eq(calendarEvent.schoolId, schoolId), isNull(calendarEvent.deletedAt), gte(calendarEvent.startsAt, new Date(Date.now() - 86_400_000))))
          .orderBy(calendarEvent.startsAt)
          .limit(5)
        if (events.length === 0) return { ok: true, answer: 'Não há eventos próximos no calendário da escola.' }
        const list = events
          .map((e) => `• ${e.startsAt.toLocaleDateString('pt-BR')} — ${e.title}${e.location ? ` (${e.location})` : ''}`)
          .join('\n')
        return { ok: true, answer: `Próximos eventos da escola:\n${list}\n\nVeja a agenda completa em “Agenda”.` }
      }

      case 'boletim': {
        const [enr0] = await getCurrentEnrollments(schoolId, ids)
        if (!enr0?.classId) return { ok: true, answer: `Os alunos (${names}) ainda não têm turma ativa neste ano.` }
        const report = await buildPedagogyReport(schoolId)
        const rows = report?.students.filter((s) => ids.includes(s.studentId)) ?? []
        if (rows.length === 0) return { ok: true, answer: 'Ainda não há notas lançadas para este ano.' }
        const parts = rows.map((s) => {
          const att = formatRate(s.attendancePct)
          return `• ${s.socialName || s.studentName}: média ${formatScore(s.overallFinal)}, frequência ${att}${s.failingSubjects.length ? `, reprovação em ${s.failingSubjects.join(', ')}` : ''}${s.recoverySubjects.length ? `, recuperação em ${s.recoverySubjects.join(', ')}` : ''}`
        })
        return { ok: true, answer: `Resumo do ano (detalhes em “Boletim”):\n${parts.join('\n')}` }
      }

      case 'biblioteca': {
        const loans = await db
          .select({
            status: bookLoan.status,
            dueOn: bookLoan.dueOn,
            returnedOn: bookLoan.returnedOn,
          })
          .from(bookLoan)
          .where(and(eq(bookLoan.schoolId, schoolId), inArray(bookLoan.studentId, ids), isNull(bookLoan.returnedOn)))
          .orderBy(desc(bookLoan.dueOn))
          .limit(5)
        if (loans.length === 0) return { ok: true, answer: 'Nenhum livro emprestado no momento pelos seus dependentes.' }
        const list = loans.map((l) => `• Devolver até ${new Date(`${l.dueOn}T12:00:00`).toLocaleDateString('pt-BR')}`).join('\n')
        return { ok: true, answer: `Empréstimos abertos:\n${list}\n\nGerencie em “Biblioteca”.` }
      }

      case 'portaria':
        return {
          ok: true,
          answer:
            'As entradas e saídas pela portaria (NFC ou biometria facial) aparecem em tempo real em “Acessos”. A escola registra manualmente quando o aluno não usa a credencial. Para emitir ou trocar a carteirinha, procure a secretaria.',
        }

      case 'matricula': {
        const [enr1] = await getCurrentEnrollments(schoolId, ids)
        if (!enr1) return { ok: true, answer: 'Nenhuma matrícula ativa encontrada para este ano. Procure a secretaria.' }
        const [cls] = enr1.classId
          ? await db
              .select({ name: schoolClass.name, grade: schoolClass.grade })
              .from(schoolClass)
              .where(and(eq(schoolClass.schoolId, schoolId), eq(schoolClass.id, enr1.classId)))
              .limit(1)
          : []
        return {
          ok: true,
          answer: `Matrícula ativa${cls ? `: ${cls.grade} — turma ${cls.name}` : ''}, ano letivo ${enr1.startsOn} a ${enr1.endsOn ? new Date(`${enr1.endsOn}T12:00:00`).toLocaleDateString('pt-BR') : '—'}. Rematrícula e documentos ficam com a secretaria.`,
        }
      }

      default:
        return { ok: false, answer: 'Escolha um tópico para consultar.' }
    }
  })
}
