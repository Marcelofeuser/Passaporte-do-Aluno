import type { Metadata } from 'next'
import Link from 'next/link'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { issuedDocument, student } from '@/lib/db/schema'
import { revokeDocument } from '@/app/actions/documents'
import { ActionForm } from '@/components/school/action-form'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { DOCUMENT_TYPE_LABELS } from '@/lib/documents'
import { requireSchoolPage } from '@/lib/school-page'

export const metadata: Metadata = { title: 'Documentos emitidos' }

export default async function SchoolDocumentsPage() {
  const { schoolId } = await requireSchoolPage('school:view_access')
  const docs = await db
    .select({
      id: issuedDocument.id,
      docType: issuedDocument.docType,
      verificationCode: issuedDocument.verificationCode,
      revokedAt: issuedDocument.revokedAt,
      createdAt: issuedDocument.createdAt,
      studentName: student.fullName,
      socialName: student.socialName,
    })
    .from(issuedDocument)
    .innerJoin(student, and(eq(student.id, issuedDocument.studentId), eq(student.schoolId, schoolId)))
    .where(eq(issuedDocument.schoolId, schoolId))
    .orderBy(desc(issuedDocument.createdAt))
    .limit(100)

  return (
    <>
      <BackLink href="/school">Escola</BackLink>
      <PageTitle
        title="Documentos emitidos"
        description="Declarações e comprovantes emitidos pela plataforma, com código de autenticidade."
      />

      <Card>
        <CardHeader
          title="Emissões recentes"
          description="Família e secretaria emitem pela plataforma; revogar invalida o código."
        />
        {docs.length === 0 ? (
          <EmptyState
            title="Nenhuma emissão ainda"
            description="Os documentos emitidos pela família e pela secretaria aparecem aqui."
          />
        ) : (
          <ul className="divide-y divide-border border-t border-border">
            {docs.map((doc) => (
              <li key={doc.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <p className="font-semibold">
                    {DOCUMENT_TYPE_LABELS[doc.docType] ?? doc.docType} · {doc.socialName || doc.studentName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Código <span className="font-mono">{doc.verificationCode}</span> · emitido em{' '}
                    {doc.createdAt.toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {doc.revokedAt ? (
                    <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">Revogado</span>
                  ) : (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">Válido</span>
                  )}
                  <Link
                    href={`/print/document/${doc.id}`}
                    target="_blank"
                    className="rounded-full border border-border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-muted"
                  >
                    Abrir PDF
                  </Link>
                  {!doc.revokedAt ? (
                    <ActionForm action={revokeDocument} submitLabel="Revogar" className="p-0">
                      <input type="hidden" name="documentId" value={doc.id} />
                    </ActionForm>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
