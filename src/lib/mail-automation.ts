import { and, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { db } from './db';
import * as s from './schema';
import { emailTemplates, type EmailTemplate } from './email-templates';
import { billingMailValid, type DeliveryContext } from './mail-policy';
export async function automationState() {
  const row = (
    await db().select().from(s.settings).where(eq(s.settings.key, 'mail-automation-approval'))
  )[0];
  const approval = row?.value as
    { approvedBy?: string; approvedAt?: string; testedAt?: string } | undefined;
  const enabled =
    process.env.AUTOCARE_MAIL_AUTOMATIONS_ENABLED === 'true' &&
    !!approval?.approvedAt &&
    !!approval.testedAt &&
    approval.approvedBy === process.env.AUTOCARE_FOUNDER_USER_ID;
  return {
    enabled,
    deploymentGate: process.env.AUTOCARE_MAIL_AUTOMATIONS_ENABLED === 'true',
    approvedAt: approval?.approvedAt || null,
  };
}
export async function queueAutomatedMail(
  uid: string,
  template: EmailTemplate,
  dedupeKey: string,
  context: DeliveryContext = {},
  store: Pick<ReturnType<typeof db>, 'insert'> = db(),
) {
  const t = emailTemplates[template];
  const id = 'auto-' + createHash('sha256').update(dedupeKey).digest('hex');
  await store
    .insert(s.mailCampaigns)
    .values({
      id,
      source: 'automation',
      template,
      category: 'transactional',
      subject: t.subject,
      message: t.body,
      ctaLabel: t.cta,
      ctaPath: t.path,
      fingerprint: id,
      status: 'held',
    })
    .onConflictDoNothing();
  await store
    .insert(s.mailDeliveries)
    .values({
      id: crypto.randomUUID(),
      campaignId: id,
      userId: uid,
      dedupeKey,
      status: 'held',
      context,
    })
    .onConflictDoNothing();
}
export async function scheduleSubscriptionMail(now = new Date()) {
  const subscriptions = await db()
    .select()
    .from(s.subscriptions)
    .where(
      and(
        eq(s.subscriptions.status, 'active'),
        eq(s.subscriptions.cancelAtPeriodEnd, true),
        sql`${s.subscriptions.periodEnd}>${now.toISOString()}::timestamptz AND ${s.subscriptions.periodEnd}<=${new Date(now.getTime() + 7 * 86400000).toISOString()}::timestamptz`,
      ),
    );
  for (const sub of subscriptions) {
    if (await billingMailValid(sub.userId, 'premium_expiry', {}, now))
      await queueAutomatedMail(
        sub.userId,
        'premium_expiry',
        `expiry:${sub.userId}:${sub.periodEnd!.toISOString()}`,
        { subscriptionId: sub.subscriptionId!, periodEnd: sub.periodEnd!.toISOString() },
      );
  }
  const grants = await db()
    .select()
    .from(s.premiumGrants)
    .where(
      sql`${s.premiumGrants.revokedAt} IS NULL AND ${s.premiumGrants.expiresAt}>${now.toISOString()}::timestamptz AND ${s.premiumGrants.expiresAt}<=${new Date(now.getTime() + 7 * 86400000).toISOString()}::timestamptz`,
    );
  for (const grant of grants) {
    if (await billingMailValid(grant.userId, 'premium_expiry', { grantId: grant.id }, now))
      await queueAutomatedMail(
        grant.userId,
        'premium_expiry',
        `expiry:${grant.userId}:${grant.expiresAt!.toISOString()}`,
        { grantId: grant.id, periodEnd: grant.expiresAt!.toISOString() },
      );
  }
}
