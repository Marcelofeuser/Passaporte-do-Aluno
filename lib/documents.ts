import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { issuedDocument, school, student } from '@/lib/db/schema'

export type DocumentPayload = {
  studentName?: string
  issuedVia?: string
  [key: string]: unknown
}

export type DocumentLookup = {
  ok: boolean
  status: 'VALID' | 'NOT_FOUND'
  docType?: string
  verificationCode?: string
  schoolName?: string
  issuedAt?: Date
  payload?: DocumentPayload | null
}

/**
 * Validação pública por código de autenticidade (sem sessão).
 * Não expõe dados sensíveis: só tipo, escola, data e via de emissão.
 */
export async function verifyDocumentByCode(code: string): Promise<DocumentLookup> {
  const clean = code.trim().toUpperCase()
  if (clean.length < 8) return { ok: false, status: 'NOT_FOUND' }
  const [row] = await db
    .select({
      docType: issuedDocument.docType,
      verificationCode: issuedDocument.verificationCode,
      payload: issuedDocument.payload,
      revokedAt: issuedDocument.revokedAt,
      createdAt: issuedDocument.createdAt,
      schoolName: school.name,
    })
    .from(issuedDocument)
    .innerJoin(school, eq(school.id, issuedDocument.schoolId))
    .where(and(eq(issuedDocument.verificationCode, clean), isNull(issuedDocument.revokedAt)))
    .limit(1)
  if (!row) return { ok: false, status: 'NOT_FOUND' }
  return {
    ok: true,
    status: 'VALID',
    docType: row.docType,
    verificationCode: row.verificationCode,
    schoolName: row.schoolName,
    issuedAt: row.createdAt,
    payload: (row.payload ?? null) as DocumentPayload | null,
  }
}

/** Consulta interna (com escola) para renderizar o documento em PDF. */
export async function getIssuedDocument(schoolId: string, documentId: string) {
  const [row] = await db
    .select({
      id: issuedDocument.id,
      docType: issuedDocument.docType,
      verificationCode: issuedDocument.verificationCode,
      payload: issuedDocument.payload,
      revokedAt: issuedDocument.revokedAt,
      createdAt: issuedDocument.createdAt,
      studentId: issuedDocument.studentId,
      studentName: student.fullName,
      socialName: student.socialName,
      registrationCode: student.registrationCode,
      schoolName: school.name,
    })
    .from(issuedDocument)
    .innerJoin(student, and(eq(student.id, issuedDocument.studentId), eq(student.schoolId, issuedDocument.schoolId)))
    .innerJoin(school, eq(school.id, issuedDocument.schoolId))
    .where(and(eq(issuedDocument.schoolId, schoolId), eq(issuedDocument.id, documentId)))
    .limit(1)
  return row ?? null
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  ENROLLMENT_DECLARATION: 'Declaração de matrícula',
  ATTENDANCE_PROOF: 'Comprovante de frequência',
  PARTIAL_TRANSCRIPT: 'Histórico parcial',
}
