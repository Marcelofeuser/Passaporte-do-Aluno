import { redirect } from 'next/navigation'
import { SecuritySetupForm } from '@/components/auth/security-setup-form'
import { db } from '@/lib/db'
import { user, userSecurity } from '@/lib/db/schema'
import { getSession } from '@/lib/session'
import { isApprovedSuperAdminEmail } from '@/lib/super-admin'

export default async function SecuritySetupPage() {
  const session = await getSession()
  if (!session?.user) redirect('/sign-in')
  if (!isApprovedSuperAdminEmail(session.user.email)) redirect('/dashboard')

  const [state] = await db
    .select({ twoFactorEnabled: user.twoFactorEnabled, mustChangePassword: userSecurity.mustChangePassword })
    .from(user)
    .leftJoin(userSecurity, (await import('drizzle-orm')).eq(userSecurity.userId, user.id))
    .where((await import('drizzle-orm')).eq(user.id, session.user.id))
    .limit(1)

  if (!state || (state.twoFactorEnabled && !state.mustChangePassword)) redirect('/dashboard')
  return <SecuritySetupForm mustChangePassword={Boolean(state.mustChangePassword)} />
}
