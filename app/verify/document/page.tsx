import type { Metadata } from 'next'
import { Card, CardHeader, PageTitle } from '@/components/ui/card'
import { DocumentVerifyForm } from './document-verify-form'

export const metadata: Metadata = {
  title: 'Validar documento',
  description: 'Confira a autenticidade de declarações emitidas pelo Passaporte do Aluno.',
}

/** Rota pública (sem login): validação por código de autenticidade. */
export default async function VerifyDocumentPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const sp = await searchParams

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <PageTitle
        title="Validar documento"
        description="Digite o código impresso na declaração para confirmar a autenticidade."
      />
      <Card>
        <CardHeader title="Consulta de autenticidade" description="A consulta é pública e não registra dados pessoais." />
        <div className="p-4">
          <DocumentVerifyForm initialCode={sp.code} />
        </div>
      </Card>
      <p className="mt-4 text-center text-xs text-muted-foreground">
        Serviço de conferência das escolas que usam o Passaporte do Aluno.
      </p>
    </div>
  )
}
