import type { Metadata } from 'next'
import { Card, CardHeader, PageTitle } from '@/components/ui/card'
import { requireSchoolPage } from '@/lib/school-page'
import { FamilyFaq } from './family-faq'

export const metadata: Metadata = { title: 'Assistente da família' }

export default async function FamilyAssistantPage() {
  await requireSchoolPage('family:view')

  return (
    <>
      <PageTitle
        title="Assistente"
        description="Tire dúvidas rápidas sobre calendário, notas, biblioteca, portaria e matrícula."
      />
      <Card>
        <CardHeader title="Como posso ajudar?" description="Toque em um tópico — a resposta usa os dados atuais da escola." />
        <div className="p-4">
          <FamilyFaq />
        </div>
      </Card>
    </>
  )
}
