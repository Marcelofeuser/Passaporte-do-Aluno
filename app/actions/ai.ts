'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { runAction, requireSchoolAction, UUID_RE } from '@/lib/school-action'
import { generateClassNarrative } from '@/lib/ai/insights'
import type { ActionState } from '@/lib/validation'

/** Gera (e guarda) o resumo de turma para boletins/reunião de pais. Narrativa = LLM opcional + fatos reais. */
export async function generateClassSummary(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('ai.class_summary', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:view_academic')
    const classId = String(formData.get('classId') ?? '')
    if (!UUID_RE.test(classId)) return { ok: false, message: 'Turma inválida.' }

    const narrative = await generateClassNarrative(schoolId, classId)
    await recordAudit({
      action: 'ai.class_summary_generated',
      entityType: 'class',
      entityId: classId,
      schoolId,
      actorUserId: userId,
      metadata: { length: narrative.length },
    })
    revalidatePath('/school/ai')
    return { ok: true, message: narrative }
  })
}
