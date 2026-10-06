import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { archiveSchool } from '@/app/actions/schools'
import { AddUserForm } from '@/components/school/add-user-form'
import { MembersList } from '@/components/school/members-list'
import { Card, CardHeader, PageTitle } from '@/components/ui/card'
import { getSchool, getSchoolMembers } from '@/lib/queries'
import { assignableRoles } from '@/lib/rbac'
import { isSuperAdmin, requirePageContext } from '@/lib/session'

export default async function SchoolDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requirePageContext()
  if (!isSuperAdmin(ctx)) redirect('/dashboard')
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const school = await getSchool(id)
  if (!school) notFound()
  const members = await getSchoolMembers(id)
  const roles = assignableRoles('SUPER_ADMIN')

  return (
    <>
      <Link
        href="/admin/schools"
        className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1 px-2 text-sm font-semibold text-muted-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        Escolas
      </Link>
      <PageTitle
        title={school.name}
        description={[school.email, school.phone].filter(Boolean).join(' · ') || undefined}
      />
      <Card>
        <CardHeader title={`Usuários (${members.length})`} />
        <MembersList members={members} removableRoles={roles} currentUserId={ctx.user.id} />
      </Card>
      <Card>
        <CardHeader title="Adicionar usuário" description="Crie uma conta ou vincule alguém que já tem cadastro." />
        <AddUserForm schoolId={school.id} roles={roles} />
      </Card>
      <Card>
        <CardHeader title="Arquivar escola" description="A escola deixa de aparecer, mas os dados são preservados." />
        <form action={archiveSchool} className="p-4">
          <input type="hidden" name="schoolId" value={school.id} />
          <button
            type="submit"
            className="min-h-11 rounded-lg border border-destructive px-4 text-sm font-semibold text-destructive hover:bg-muted"
          >
            Arquivar escola
          </button>
        </form>
      </Card>
    </>
  )
}
