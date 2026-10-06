import type { Metadata } from 'next'
import { ChangePasswordForm, ProfileForm } from '@/components/profile/profile-forms'
import { Card, CardHeader, PageTitle } from '@/components/ui/card'
import { ROLE_LABELS } from '@/lib/rbac'
import { requirePageContext } from '@/lib/session'

export const metadata: Metadata = { title: 'Perfil' }

export default async function ProfilePage() {
  const ctx = await requirePageContext()
  return (
    <>
      <PageTitle title="Meu perfil" />
      <Card>
        <CardHeader title="Dados pessoais" />
        <ProfileForm name={ctx.user.name} email={ctx.user.email} />
      </Card>
      <Card>
        <CardHeader title="Meus vínculos" />
        {ctx.memberships.length ? (
          <ul className="divide-y divide-border">
            {ctx.memberships.map((m) => (
              <li key={m.id} className="flex flex-col p-4">
                <span className="font-semibold">{ROLE_LABELS[m.role]}</span>
                <span className="text-sm text-muted-foreground">{m.schoolName ?? 'Plataforma'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm leading-relaxed text-muted-foreground">
            Nenhum vínculo ainda. Peça à sua escola para liberar seu acesso.
          </p>
        )}
      </Card>
      <Card>
        <CardHeader title="Segurança" />
        <ChangePasswordForm />
      </Card>
    </>
  )
}
