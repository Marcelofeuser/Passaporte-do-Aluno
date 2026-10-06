import { removeMembership } from '@/app/actions/users'
import { EmptyState } from '@/components/ui/card'
import { isRole, ROLE_LABELS, type Role } from '@/lib/rbac'

type Member = { membershipId: string; role: string; userId: string; name: string; email: string }

export function MembersList({
  members,
  removableRoles,
  currentUserId,
}: {
  members: Member[]
  removableRoles: readonly Role[]
  currentUserId: string
}) {
  if (!members.length) {
    return <EmptyState title="Nenhum usuário ainda" description="Adicione o primeiro usuário desta escola." />
  }
  return (
    <ul className="divide-y divide-border">
      {members.map((m) => {
        const role = isRole(m.role) ? m.role : null
        const canRemove = role && removableRoles.includes(role) && m.userId !== currentUserId
        return (
          <li key={m.membershipId} className="flex items-center justify-between gap-3 p-4">
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-semibold">{m.name}</span>
              <span className="truncate text-sm text-muted-foreground">{m.email}</span>
              <span className="pt-1 text-xs font-bold tracking-wide text-primary uppercase">
                {role ? ROLE_LABELS[role] : m.role}
              </span>
            </div>
            {canRemove ? (
              <form action={removeMembership}>
                <input type="hidden" name="membershipId" value={m.membershipId} />
                <button
                  type="submit"
                  className="min-h-11 rounded-lg px-3 text-sm font-semibold text-destructive hover:bg-muted"
                  aria-label={`Remover ${m.name}`}
                >
                  Remover
                </button>
              </form>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
