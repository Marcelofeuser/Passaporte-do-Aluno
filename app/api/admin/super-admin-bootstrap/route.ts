import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { account, schoolMembership, session, user, userSecurity } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const expected = process.env.SUPER_ADMIN_BOOTSTRAP_TOKEN ?? ''
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const a = Buffer.from(expected)
  const b = Buffer.from(supplied)
  if (!expected || a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
  }

  const [target] = await db.select({ id: user.id, email: user.email }).from(user)
    .where(sql`lower(${user.email}) = 'marcelofeuser.go@gmail.com'`).limit(1)
  if (!target) return NextResponse.json({ error: 'Approved account not found' }, { status: 404 })

  const [membership] = await db.select({ id: schoolMembership.id }).from(schoolMembership).where(and(
    eq(schoolMembership.userId, target.id), eq(schoolMembership.role, 'SUPER_ADMIN'),
    isNull(schoolMembership.schoolId), isNull(schoolMembership.deletedAt),
  )).limit(1)
  if (!membership) return NextResponse.json({ error: 'Super Admin membership is not provisioned' }, { status: 409 })

  const temporaryPassword = randomBytes(24).toString('base64url')
  const passwordHash = await (await auth.$context).password.hash(temporaryPassword)
  const issued = await db.transaction(async (tx) => {
    await tx.insert(userSecurity).values({ userId: target.id, mustChangePassword: true })
      .onConflictDoNothing({ target: userSecurity.userId })
    const [state] = await tx.select({ issuedAt: userSecurity.bootstrapPasswordIssuedAt })
      .from(userSecurity).where(eq(userSecurity.userId, target.id)).for('update')
    if (!state || state.issuedAt) return false

    const [credential] = await tx.select({ id: account.id }).from(account)
      .where(and(eq(account.userId, target.id), eq(account.providerId, 'credential'))).limit(1)
    if (credential) {
      await tx.update(account).set({ password: passwordHash, updatedAt: new Date() }).where(eq(account.id, credential.id))
    } else {
      await tx.insert(account).values({ id: randomUUID(), accountId: target.id, providerId: 'credential', userId: target.id, password: passwordHash })
    }
    await tx.delete(session).where(eq(session.userId, target.id))
    await tx.update(userSecurity).set({ mustChangePassword: true, bootstrapPasswordIssuedAt: new Date(), updatedAt: new Date() })
      .where(eq(userSecurity.userId, target.id))
    return true
  })

  if (!issued) return NextResponse.json({ error: 'Temporary password already issued' }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
  await recordAudit({ action: 'auth.super_admin_temporary_password_issued', entityType: 'user', entityId: target.id, actorUserId: target.id, request })
  return NextResponse.json({ email: target.email, temporaryPassword }, { headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' } })
}
