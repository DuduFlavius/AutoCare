import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
import { emailTemplates, type EmailTemplate } from './email-templates';
// Never persist authentication URLs, message bodies containing tokens, or provider responses.
export async function recordSystemMail(
  uid: string,
  template: EmailTemplate,
  key: string,
  to: string,
  status: string,
  providerId?: string,
  error?: string,
) {
  const t = emailTemplates[template];
  const id =
    'system-' +
    createHash('sha256')
      .update(template + ':' + key)
      .digest('hex');
  await db().transaction(async (tx) => {
    if (providerId) {
      const events = await tx
        .select()
        .from(s.emailEvents)
        .where(eq(s.emailEvents.providerId, providerId));
      if (events.some((e) => ['email.failed', 'email.bounced'].includes(e.status))) {
        status = 'failed';
        error = 'EMAIL_DELIVERY_FAILED';
      } else if (events.some((e) => e.status === 'email.delivered')) {
        status = 'delivered';
        error = undefined;
      }
    }
    await tx
      .insert(s.mailCampaigns)
      .values({
        id,
        actorId: null,
        source: 'system',
        template,
        category: 'transactional',
        subject: t.subject,
        message: t.body,
        ctaLabel: t.cta,
        ctaPath: t.path,
        fingerprint: id,
        status: 'completed',
      })
      .onConflictDoNothing();
    await tx
      .insert(s.mailDeliveries)
      .values({
        id: crypto.randomUUID(),
        campaignId: id,
        userId: uid,
        recipientEmail: to,
        dedupeKey: id,
        status,
        providerId,
        error,
        attemptedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: s.mailDeliveries.dedupeKey,
        set: {
          status: sql`CASE WHEN ${s.mailDeliveries.status} IN ('accepted','delivered') THEN ${s.mailDeliveries.status} ELSE ${status} END`,
          providerId: sql`coalesce(${s.mailDeliveries.providerId},${providerId || null})`,
          error: sql`CASE WHEN ${s.mailDeliveries.status} IN ('accepted','delivered') THEN ${s.mailDeliveries.error} ELSE ${error || null} END`,
          attemptedAt: new Date(),
        },
      });
  });
}
export async function safeSystemMailLog(...args: Parameters<typeof recordSystemMail>) {
  try {
    await recordSystemMail(...args);
  } catch {
    console.error(JSON.stringify({ event: 'mail_history_write_failed' }));
  }
}
export async function userEmailName(uid: string) {
  return (await db().select({ name: s.user.name }).from(s.user).where(eq(s.user.id, uid)))[0]?.name;
}
