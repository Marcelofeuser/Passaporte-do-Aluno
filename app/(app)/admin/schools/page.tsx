import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { SchoolForm } from '@/components/admin/school-form'
import { Card, CardHeader, EmptyState, PageTitle } from '@/components/ui/card'
import { listSchools } from '@/lib/queries'
import { isSuperAdmin, requirePageContext } from '@/lib/session'

export const metadata: Metadata = { title: 'Escolas' }

export default async function SchoolsPage() {
  const ctx = await requirePageContext()
  if (!isSuperAdmin(ctx)) redirect('/dashboard')
  const schools = await listSchools()

  return (
    <>
      <PageTitle title="Escolas" description="Cadastre e gerencie as escolas da plataforma." />
      <Card>
        <CardHeader title={`Escolas ativas (${schools.length})`} />
        {schools.length ? (
          <ul className="divide-y divide-border">
            {schools.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/admin/schools/${s.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 p-4 hover:bg-muted"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-semibold">{s.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {s.members} {s.members === 1 ? 'usuário' : 'usuários'}
                    </span>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Nenhuma escola cadastrada" description="Use o formulário abaixo para criar a primeira." />
        )}
      </Card>
      <Card>
        <CardHeader title="Nova escola" />
        <SchoolForm />
      </Card>
    </>
  )
}
