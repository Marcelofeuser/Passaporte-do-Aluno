import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AddUserForm } from '@/components/school/add-user-form'
import { MembersList } from '@/components/school/members-list'
import { Card, CardHeader, PageTitle } from '@/components/ui/card'
import { getSchoolMembers } from '@/lib/queries'
import { assignableRoles, can } from '@/lib/rbac'
import { requirePagePermission } from '@/lib/session'

export const metadata: Metadata = { title: 'Usuários da escola' }

export default async function SchoolUsersPage() {
  const ctx = await requirePagePermission('school:view_users')
  const schoolId = ctx.active.schoolId
  if (!schoolId) redirect('/dashboard')

  const members = await getSchoolMembers(schoolId)
  const roles = assignableRoles(ctx.active.role)
  const canManage = can(ctx.active.role, 'school:manage_users')

  return (
    <>
      <PageTitle title="Usuários" description={ctx.active.schoolName ?? undefined} />
      <Card>
        <CardHeader title={`Equipe e comunidade (${members.length})`} />
        <MembersList
          members={members}
          removableRoles={canManage ? roles : []}
          currentUserId={ctx.user.id}
        />
      </Card>
      {canManage && roles.length ? (
        <Card>
          <CardHeader title="Adicionar usuário" description="Crie uma conta ou vincule alguém que já tem cadastro." />
          <AddUserForm schoolId={schoolId} roles={roles} />
        </Card>
      ) : null}
    </>
  )
}
