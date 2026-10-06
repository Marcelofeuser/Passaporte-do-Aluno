import { switchMembership } from '@/app/actions/account'
import { ROLE_LABELS } from '@/lib/rbac'
import type { Membership } from '@/lib/session'

function label(m: Membership) {
  return m.schoolName ? `${ROLE_LABELS[m.role]} · ${m.schoolName}` : ROLE_LABELS[m.role]
}

export function ContextSwitcher({
  memberships,
  activeId,
}: {
  memberships: Membership[]
  activeId: string | null
}) {
  if (memberships.length < 2) return null
  return (
    <form action={switchMembership} className="flex flex-col gap-1">
      <label htmlFor="membershipId" className="text-xs font-semibold text-muted-foreground">
        Acessando como
      </label>
      <div className="flex gap-2">
        <select
          id="membershipId"
          name="membershipId"
          defaultValue={activeId ?? undefined}
          className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 text-base"
        >
          {memberships.map((m) => (
            <option key={m.id} value={m.id}>
              {label(m)}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-semibold hover:bg-muted"
        >
          Trocar
        </button>
      </div>
    </form>
  )
}
