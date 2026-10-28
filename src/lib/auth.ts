import { eq, inArray } from 'drizzle-orm';
import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { toNextJsHandler } from 'better-auth/next-js';
import { db } from './db';
import * as schema from './schema';
import { sendMail } from './mail';
import { renderEmail } from './email-templates';
import { queueAutomatedMail } from './mail-automation';
import { origin } from './config';
import { createHash } from 'node:crypto';
let cached: ReturnType<typeof makeAuth> | undefined;
function makeAuth() {
  if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32)
    throw new Error('BETTER_AUTH_SECRET trebuie să aibă minimum 32 caractere.');
  return betterAuth({
    appName: 'AutoCare',
    baseURL: origin(),
    secret: process.env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db(), { provider: 'pg', schema }),
    trustedOrigins: [origin()],
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION === 'true',
      autoSignIn: process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION !== 'true',
      minPasswordLength: 12,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        await sendMail(
          user.email,
          'Resetează parola AutoCare',
          url,
          createHash('sha256').update(url).digest('hex'),
          renderEmail('password_reset', { name: user.name, actionUrl: url }),
          { userId: user.id, template: 'password_reset' },
        );
      },
    },
    emailVerification: {
      sendOnSignUp: process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION === 'true',
      autoSignInAfterVerification: false,
      sendVerificationEmail: async ({ user, url }) => {
        await sendMail(
          user.email,
          'Confirmă adresa de email AutoCare',
          url,
          createHash('sha256').update(url).digest('hex'),
          renderEmail('verification', { name: user.name, actionUrl: url }),
          { userId: user.id, template: 'verification' },
        );
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    user: {
      deleteUser: {
        enabled: true,
        beforeDelete: async (u) => {
          const sub = (
            await db()
              .select()
              .from(schema.subscriptions)
              .where(eq(schema.subscriptions.userId, u.id))
          )[0];
          if (
            sub?.subscriptionId &&
            ['active', 'past_due', 'trialing', 'unpaid'].includes(sub.status)
          )
            throw new APIError('CONFLICT', {
              message: 'Anulează abonamentul înainte de ștergerea contului.',
            });
        },
      },
    },
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const row = (
              await db()
                .select()
                .from(schema.accountRestrictions)
                .where(eq(schema.accountRestrictions.userId, session.userId))
            )[0];
            if (row?.suspendedAt)
              throw new APIError('FORBIDDEN', {
                message: 'Contul este suspendat. Contactează echipa AutoCare.',
              });
            return { data: session };
          },
        },
      },
      user: {
        create: {
          after: async (u) => {
            try {
              await queueAutomatedMail(u.id, 'welcome', `welcome:${u.id}`);
            } catch {
              console.error(JSON.stringify({ event: 'welcome_queue_failed' }));
            }
          },
        },
        delete: {
          before: async (u) => {
            const ids = (
              await db()
                .select({ id: schema.notifications.providerId })
                .from(schema.notifications)
                .where(eq(schema.notifications.userId, u.id))
            )
              .map((r) => r.id)
              .filter((id): id is string => !!id);
            if (ids.length)
              await db()
                .delete(schema.emailEvents)
                .where(inArray(schema.emailEvents.providerId, ids));
          },
        },
      },
    },
    rateLimit: { enabled: true, storage: 'database', window: 60, max: 30 },
    advanced: {
      ipAddress: {
        ipAddressHeaders: process.env.VERCEL ? ['x-vercel-forwarded-for'] : ['x-real-ip'],
      },
      useSecureCookies: origin().startsWith('https://'),
    },
  });
}
export function auth() {
  return (cached ??= makeAuth());
}
export function authHandlers() {
  return toNextJsHandler(auth());
}
