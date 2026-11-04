import { betterAuth } from 'better-auth'
import { twoFactor } from 'better-auth/plugins'
import { db, pool } from '@/lib/db'
import { recordAudit } from '@/lib/audit'
import { logger } from '@/lib/logger'

export const auth = betterAuth({
  database: pool,
  plugins: [twoFactor({ issuer: 'Passaporte do Aluno' })],
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
    autoSignIn: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    sendResetPassword: async ({ user, url }) => {
      // Envio por e-mail entra na fase de Notificações (Resend). Até lá o link
      // só é exposto no log do servidor em desenvolvimento.
      if (process.env.NODE_ENV === 'development') {
        logger.info('auth.password_reset_link', { userId: user.id, link: url })
      } else {
        logger.warn('auth.password_reset_requested_without_email_provider', { userId: user.id })
      }
      await recordAudit({
        action: 'auth.password_reset_requested',
        entityType: 'user',
        entityId: user.id,
        actorUserId: user.id,
      })
    },
    onPasswordReset: async ({ user }) => {
      await recordAudit({
        action: 'auth.password_reset_completed',
        entityType: 'user',
        entityId: user.id,
        actorUserId: user.id,
      })
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await recordAudit({
            action: 'auth.user_created',
            entityType: 'user',
            entityId: createdUser.id,
            actorUserId: createdUser.id,
          })
        },
      },
    },
    session: {
      create: {
        after: async (createdSession) => {
          await recordAudit({
            action: 'auth.sign_in',
            entityType: 'session',
            entityId: createdSession.id,
            actorUserId: createdSession.userId,
          })
        },
      },
    },
  },
  trustedOrigins: [
    ...(process.env.NODE_ENV === 'development'
      ? [
          'http://localhost:3000',
          ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
          ...(process.env.V0_DEV_APP_URL ? [process.env.V0_DEV_APP_URL] : []),
          ...(process.env.V0_BUILD_URL ? [process.env.V0_BUILD_URL] : []),
          ...(process.env.V0_SANDBOX_URL ? [process.env.V0_SANDBOX_URL] : []),
        ]
      : []),
    ...(process.env.NODE_ENV === 'production'
      ? [
          ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
          ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
            : []),
        ]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          // Required by the cross-site v0 preview iframe. Without these
          // attributes, login succeeds but the next request appears signed out.
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})
