import type { Metadata } from 'next'
import { BackLink } from '@/components/school/form-fields'
import { Card, CardHeader, PageTitle } from '@/components/ui/card'
import { requireSchoolPage } from '@/lib/school-page'
import { PassportVerifyForm } from './passport-verify-form'

export const metadata: Metadata = { title: 'Validar passaporte' }

export default async function PassportVerifyPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  await requireSchoolPage('school:view_access')
  const sp = await searchParams

  return (
    <>
      <BackLink href="/school/passport">Passaporte Educacional</BackLink>
      <PageTitle
        title="Validar passaporte"
        description="Aponte a câmera do leitor para o QR Code da carteirinha e cole a URL/lendo o código."
      />
      <Card>
        <CardHeader title="Leitura do QR Code" description="O resultado mostra dados do aluno antes de registrar a conferência." />
        <div className="p-4">
          <PassportVerifyForm initialToken={sp.token} />
        </div>
      </Card>
    </>
  )
}
