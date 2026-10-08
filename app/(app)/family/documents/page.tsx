import type { Metadata } from 'next'
import Link from 'next/link'
import { and, desc, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { issuedDocument, student } from '@/lib/db/schema'
import { issueDocument } from '@/app/actions/documents'
import { ActionForm } from '@/components/school/action-form'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { Field, Select } from '@/components/ui/field'
import { getFamilyStudents } from '@/lib/attendance-queries'
import { DOCUMENT_TYPE_LABELS } from '@/lib/documents'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Documentos' }

export default async function FamilyDocumentsPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const { ctx, schoolId, role } = await requireSchoolPage('family:view')
  const sp = await searchParams
  const isStudent = role === 'STUDENT'
  const students = await getFamilyStudents(schoolId, isStudent ? 'STUDENT' : 'PARENT', ctx.user.id, ctx.user.email)

  if (students.length === 0) {
    return (
      <>
        <PageTitle title="Documentos" />
        <Card>
          <EmptyState
            title="Nenhum aluno vinculado"
            description="Peça à secretaria para vincular seus filhos usando o mesmo e-mail da sua conta."
          />
        </Card>
      </>
    )
  }

  const selected = students.find((s) => s.id === sp.student) ?? students[0]
  const docs = await db
    .select({
      id: issuedDocument.id,
      docType: issuedDocument.docType,
      verificationCode: issuedDocument.verificationCode,
      revokedAt: issuedDocument.revokedAt,
      createdAt: issuedDocument.createdAt,
      studentId: issuedDocument.studentId,
      studentName: student.fullName,
      socialName: student.socialName,
    })
    .from(issuedDocument)
    .innerJoin(student, and(eq(student.id, issuedDocument.studentId), eq(student.schoolId, schoolId)))
    .where(
      and(
        eq(issuedDocument.schoolId, schoolId),
        inArray(issuedDocument.studentId, students.map((s) => s.id)),
        eq(issuedDocument.studentId, selected.id),
        isNull(issuedDocument.revokedAt),
      ),
    )
    .orderBy(desc(issuedDocument.createdAt))
    .limit(20)

  return (
    <>
      <PageTitle title="Documentos" description="Emita declarações oficiais com código de autenticidade." />

      {students.length > 1 ? (
        <nav aria-label="Escolher aluno" className="flex flex-wrap gap-2">
          {students.map((s) => (
            <Link
              key={s.id}
              href={`/family/documents?student=${s.id}`}
              aria-current={s.id === selected.id ? 'page' : undefined}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
            >
              {s.socialName || s.fullName}
            </Link>
          ))}
        </nav>
      ) : null}

      <Card title="Emitir documento" description="O PDF sai pronto com o QR Code de validação da escola.">
        <ActionForm action={issueDocument} submitLabel="Emitir" className="p-4 sm:flex-row sm:items-end">
          <input type="hidden" name="studentId" value={selected.id} />
          <Field label="Tipo de documento" htmlFor="docType">
            <Select id="docType" name="docType" defaultValue="ENROLLMENT_DECLARATION">
              <option value="ENROLLMENT_DECLARATION">Declaração de matrícula</option>
              <option value="ATTENDANCE_PROOF">Comprovante de frequência</option>
              <option value="PARTIAL_TRANSCRIPT">Histórico parcial</option>
            </Select>
          </Field>
        </ActionForm>
      </Card>

      <Card>
        <CardHeader title="Emitidos recentemente" description={selected.socialName || selected.fullName} />
        {docs.length === 0 ? (
          <EmptyState
            title="Nenhuma emissão ainda"
            description="Escolha o tipo acima e clique em Emitir — o documento fica disponível na hora."
          />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {docs.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">{DOCUMENT_TYPE_LABELS[doc.docType] ?? doc.docType}</p>
                  <p className="text-xs text-muted-foreground">
                    Código <span className="font-mono">{doc.verificationCode}</span> · emitido em{' '}
                    {doc.createdAt.toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">Válido</span>
                  <Link
                    href={`/print/document/${doc.id}`}
                    target="_blank"
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
                  >
                    Abrir PDF
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
