import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
export type DeliveryContext = typeof s.mailDeliveries.$inferSelect.context;
export async function communicationPreference(uid: string) {
  const row = (
    await db()
      .select()
      .from(s.communicationPreferences)
      .where(eq(s.communicationPreferences.userId, uid))
  )[0];
  return { transactional: row?.transactional ?? true, promotional: row?.promotional ?? false };
}
export async function recipientAllowed(uid: string, category: string, manual = false) {
  const [user, profile, restrictions, preferences] = await Promise.all([
    db().select().from(s.user).where(eq(s.user.id, uid)),
    db().select().from(s.profiles).where(eq(s.profiles.userId, uid)),
    db().select().from(s.accountRestrictions).where(eq(s.accountRestrictions.userId, uid)),
    communicationPreference(uid),
  ]);
  return (
    !!user[0] && (user[0].emailVerified || (manual && category === 'transactional')) &&
    !restrictions[0]?.suspendedAt &&
    profile[0]?.emailEnabled !== false &&
    (category === 'promotional' ? preferences.promotional : preferences.transactional)
  );
}
export async function billingMailValid(
  uid: string,
  template: string,
  context: DeliveryContext = {},
  now = new Date(),
) {
  if (!['premium_expiry', 'renewal', 'payment_failed'].includes(template)) return true;
  const sub = (await db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid)))[0];
  const grants = await db()
    .select()
    .from(s.premiumGrants)
    .where(
      and(
        eq(s.premiumGrants.userId, uid),
        sql`${s.premiumGrants.revokedAt} IS NULL AND (${s.premiumGrants.expiresAt} IS NULL OR ${s.premiumGrants.expiresAt}>${now.toISOString()}::timestamptz)`,
      ),
    );
  if (template === 'premium_expiry') {
    const ends =
      sub?.subscriptionId && sub.status === 'active' && sub.cancelAtPeriodEnd
        ? sub.periodEnd
        : null;
    // Auto-renewing subscriptions and longer/lifetime grants never receive expiry warnings.
    if (
      sub?.subscriptionId &&
      ['active', 'trialing'].includes(sub.status) &&
      !sub.cancelAtPeriodEnd
    )
      return false;
    if (grants.some((g) => !g.expiresAt)) return false;
    const date = context.grantId ? grants.find((g) => g.id === context.grantId)?.expiresAt : ends;
    const expiry =
      date ||
      (!sub?.subscriptionId
        ? grants.map((g) => g.expiresAt!).sort((a, b) => b.getTime() - a.getTime())[0]
        : null);
    if (!expiry || expiry <= now || expiry.getTime() - now.getTime() > 7 * 86400000) return false;
    if (grants.some((g) => g.expiresAt && g.expiresAt > expiry)) return false;
    if (context.periodEnd && expiry.toISOString() !== context.periodEnd) return false;
    return true;
  }
  if (
    !sub?.subscriptionId ||
    (context.subscriptionId && context.subscriptionId !== sub.subscriptionId)
  )
    return false;
  if (context.periodEnd && sub.periodEnd?.toISOString() !== context.periodEnd) return false;
  if (template === 'payment_failed')
    return ['past_due', 'unpaid', 'incomplete', 'pending_payment'].includes(sub.status);
  if (sub.status !== 'active' || !sub.periodEnd || sub.periodEnd <= now) return false;
  if (context.invoiceId) {
    const inv = (
      await db()
        .select()
        .from(s.invoices)
        .where(and(eq(s.invoices.id, context.invoiceId), eq(s.invoices.userId, uid)))
    )[0];
    return inv?.status === 'paid';
  }
  return (
    (
      await db()
        .select()
        .from(s.invoices)
        .where(and(eq(s.invoices.userId, uid), eq(s.invoices.status, 'paid')))
    ).length > 0
  );
}
