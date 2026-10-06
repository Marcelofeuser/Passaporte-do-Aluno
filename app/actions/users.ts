'use server'

import { and, eq, isNull } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { notification, parent, school, schoolMembership, student, teacher, user } from '@/lib/db/schema'
import { recordAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'
import { assignableRoles, can, ROLE_LABELS, type Role } from '@/lib/rbac'
import { requireActionContext, roleInSchool } from '@/lib/session'
import { schoolUserInput, toFieldErrors, type ActionState } from '@/lib/validation'

async function createCredentialUser(name: string, email: string, password: string) {
  const ctx = await auth.$context
  const created = await ctx.internalAdapter.createUser({ name, email, emailVerified: false }, { action: 'create-user' } as never)
  const hash = await ctx.password.hash(password)
  await ctx.internalAdapter.linkAccount({
    userId: created.id,
    providerId: 'credential',
    accountId: created.id,
    password: hash,
  })
  return created.id
}

async function ensureDomainProfile(role: Role, schoolId: string, userId: string, fullName: string, email: string) {
  const where = (t: typeof teacher | typeof student | typeof parent) =>
    and(eq(t.schoolId, schoolId), eq(t.userId, userId), isNull(t.deletedAt))

  if (role === 'TEACHER') {
    const exists = await db.select({ id: teacher.id }).from(teacher).where(where(teacher)).limit(1)
    if (!exists.length) await db.insert(teacher).values({ schoolId, userId, fullName, email })
  } else if (role === 'STUDENT') {
    const exists = await db.select({ id: student.id }).from(student).where(where(student)).limit(1)
    if (!exists.length) await db.insert(student).values({ schoolId, userId, fullName })
  } else if (role === 'PARENT') {
    const exists = await db.select({ id: parent.id }).from(parent).where(where(parent)).limit(1)
    if (!exists.length) await db.insert(parent).values({ schoolId, userId, fullName, email })
  }
}

export async function addSchoolUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const ctx = await requireActionContext()
    const parsed = schoolUserInput.safeParse(Object.fromEntries(formData))
    if (!parsed.success) return { ok: false, fieldErrors: toFieldErrors(parsed.error) }
    const input = parsed.data
    const role = input.role as Role

    const actorRole = roleInSchool(ctx, input.schoolId)
    if (!actorRole || (actorRole !== 'SUPER_ADMIN' && !can(actorRole, 'school:manage_users'))) {
      return { ok: false, message: 'Você não tem permissão para gerenciar usuários desta escola.' }
    }
    if (!assignableRoles(actorRole).includes(role)) {
      return { ok: false, message: `Você não pode atribuir o perfil ${ROLE_LABELS[role]}.` }
    }

    const [targetSchool] = await db
      .select({ id: school.id, name: school.name })
      .from(school)
      .where(and(eq(school.id, input.schoolId), isNull(school.deletedAt)))
      .limit(1)
    if (!targetSchool) return { ok: false, message: 'Escola não encontrada.' }

    const [existingUser] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, input.email))
      .limit(1)

    let userId = existingUser?.id
    let createdAccount = false
    if (!userId) {
      if (!input.password) {
        return { ok: false, fieldErrors: { password: 'Defina uma senha inicial para o novo usuário' } }
      }
      userId = await createCredentialUser(input.name, input.email, input.password)
      createdAccount = true
    } else {
      const duplicate = await db
        .select({ id: schoolMembership.id })
        .from(schoolMembership)
        .where(
          and(
            eq(schoolMembership.userId, userId),
            eq(schoolMembership.schoolId, input.schoolId),
            eq(schoolMembership.role, role),
            isNull(schoolMembership.deletedAt),
          ),
        )
        .limit(1)
      if (duplicate.length) return { ok: false, message: 'Este usuário já possui esse perfil na escola.' }
    }

    const [membership] = await db
      .insert(schoolMembership)
      .values({ userId, schoolId: input.schoolId, role })
      .returning({ id: schoolMembership.id })

    await ensureDomainProfile(role, input.schoolId, userId, input.name, input.email)

    await db.insert(notification).values({
      userId,
      schoolId: input.schoolId,
      title: `Você agora é ${ROLE_LABELS[role]} em ${targetSchool.name}`,
      body: 'Seu acesso foi liberado pela equipe da escola.',
      href: '/dashboard',
    })

    await recordAudit({
      action: 'membership.created',
      entityType: 'school_membership',
      entityId: membership.id,
      schoolId: input.schoolId,
      actorUserId: ctx.user.id,
      metadata: { targetUserId: userId, role, createdAccount },
    })

    revalidatePath(`/school/users`)
    revalidatePath(`/admin/schools/${input.schoolId}`)
    return {
      ok: true,
      message: createdAccount
        ? 'Usuário criado e vinculado à escola.'
        : 'Usuário existente vinculado à escola.',
    }
  } catch (error) {
    logger.error('membership.create_failed', { error })
    return { ok: false, message: 'Não foi possível adicionar o usuário.' }
  }
}

export async function removeMembership(formData: FormData) {
  const ctx = await requireActionContext()
  const membershipId = String(formData.get('membershipId') ?? '')
  if (!/^[0-9a-f-]{36}$/i.test(membershipId)) return

  const [target] = await db
    .select({
      id: schoolMembership.id,
      userId: schoolMembership.userId,
      schoolId: schoolMembership.schoolId,
      role: schoolMembership.role,
    })
    .from(schoolMembership)
    .where(and(eq(schoolMembership.id, membershipId), isNull(schoolMembership.deletedAt)))
    .limit(1)
  if (!target?.schoolId || target.userId === ctx.user.id) return

  const actorRole = roleInSchool(ctx, target.schoolId)
  if (!actorRole || !assignableRoles(actorRole).includes(target.role as Role)) return
  if (actorRole !== 'SUPER_ADMIN' && !can(actorRole, 'school:manage_users')) return

  await db
    .update(schoolMembership)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(schoolMembership.id, target.id))

  await recordAudit({
    action: 'membership.removed',
    entityType: 'school_membership',
    entityId: target.id,
    schoolId: target.schoolId,
    actorUserId: ctx.user.id,
    metadata: { targetUserId: target.userId, role: target.role },
  })
  revalidatePath('/school/users')
  revalidatePath(`/admin/schools/${target.schoolId}`)
}
