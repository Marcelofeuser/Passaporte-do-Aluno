import { randomBytes, randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { issuedDocument, student } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { runAction, requireSchoolAction, UUID_RE } from '@/lib/school-action'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { requireActionContext } from '@/lib/session'
import { can } from '@/lib/rbac'
import type { ActionState } from '@/lib/validation'

export const DOCUMENT_TYPE_VALUES = ['ENROLLMENT_DECLARATION', 'ATTENDANCE_PROOF', 'PARTIAL_TRANSCRIPT'] as const

function newVerificationCode() {
  // Ex.: DOC-7F3A2B9C-4821 — curto, único (coluna UNIQUE) e legível para conferência manual.
  return `DOC-${randomBytes(4).toString('hex').toUpperCase()}-${randomUUID().slice(0, 4).toUpperCase()}`
}

/**
 * Emite um documento oficial para o aluno (snapshot dos dados no momento).
 * Autorização: família só emite para dependente vinculado; equipe com school:view_access
 * emite para qualquer aluno da escola.
 */
export async function issueDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('document.issue', async () => {
    const studentId = String(formData.get('studentId') ?? '')
    const docType = String(formData.get('docType') ?? '')
    if (!UUID_RE.test(studentId)) return { ok: false, message: 'Aluno inválido.' }
    if (!(DOCUMENT_TYPE_VALUES as readonly string[]).includes(docType)) {
      return { ok: false, message: 'Tipo de documento inválido.' }
    }

    const ctx = await requireActionContext()
    const active = ctx.active
    if (!active?.schoolId) return { ok: false, message: 'Você não tem permissão para esta ação.' }
    const schoolId = active.schoolId
    const isFamily = active.role === 'PARENT' || active.role === 'STUDENT'

    if (isFamily) {
      const familyRole: 'PARENT' | 'STUDENT' = active.role === 'STUDENT' ? 'STUDENT' : 'PARENT'
      const students = await getFamilyStudents(schoolId, familyRole, ctx.user.id, ctx.user.email)
      if (!students.some((s) => s.id === studentId)) {
        return { ok: false, message: 'Aluno não vinculado à sua conta.' }
      }
    } else if (!can(active.role, 'school:view_access')) {
      return { ok: false, message: 'Você não tem permissão para esta ação.' }
    }

    const [stu] = await db
      .select({ id: student.id })
      .from(student)
      .where(and(eq(student.schoolId, schoolId), eq(student.id, studentId), isNull(student.deletedAt)))
      .limit(1)
    if (!stu) return { ok: false, message: 'Aluno não encontrado nesta escola.' }

    // Snapshot é preenchido no momento da emissão pela rota de PDF (payload só guarda metadados).
    const [row] = await db
      .insert(issuedDocument)
      .values({
        schoolId,
        studentId,
        docType,
        verificationCode: newVerificationCode(),
        payload: { issuedVia: isFamily ? 'FAMILIA' : 'ESCOLA' },
        issuedBy: ctx.user.id,
      })
      .returning({ id: issuedDocument.id, verificationCode: issuedDocument.verificationCode })

    await recordAudit({
      action: 'document.issued',
      entityType: 'issued_document',
      entityId: row?.id ?? null,
      schoolId,
      actorUserId: ctx.user.id,
      metadata: { docType, studentId, via: isFamily ? 'FAMILIA' : 'ESCOLA' },
    })
    revalidatePath('/family/documents')
    revalidatePath('/school/documents')
    return {
      ok: true,
      message: `Documento emitido. Código de verificação: ${row?.verificationCode ?? '—'}`,
    }
  })
}

/** Revoga uma emissão (ex.: declaração impressa perdida) — validação pública passa a falhar. */
export async function revokeDocument(_prev: ActionState, formData: FormData): Promise<ActionState> {
  return runAction('document.revoke', async () => {
    const { schoolId, userId } = await requireSchoolAction('school:view_access')
    const docId = String(formData.get('documentId') ?? '')
    if (!UUID_RE.test(docId)) return { ok: false, message: 'Documento inválido.' }

    await db
      .update(issuedDocument)
      .set({ revokedAt: new Date() })
      .where(and(eq(issuedDocument.schoolId, schoolId), eq(issuedDocument.id, docId)))

    await recordAudit({
      action: 'document.revoked',
      entityType: 'issued_document',
      entityId: docId,
      schoolId,
      actorUserId: userId,
      metadata: {},
    })
    revalidatePath('/school/documents')
    return { ok: true, message: 'Documento revogado.' }
  })
}
