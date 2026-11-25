import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { origin } from './config';
import { emailCategories, optionalMarketingCategories } from './mail-preference-categories';
import { mailConsents, mailSuppressions, communicationPreferences, user } from './schema';

function digest(purpose: string, value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('EMAIL_CONSENT_UNAVAILABLE');
  return createHmac('sha256', secret).update(purpose + '\0' + value).digest('hex');
}
export function emailAddressHash(email: string) {
  return digest('email-suppression-v1', email.trim().toLowerCase());
}
export async function emailSuppressed(email: string) {
  if (!z.email().max(254).safeParse(email).success) return true;
  const [row] = await db().select({ key: mailSuppressions.addressHash }).from(mailSuppressions)
    .where(eq(mailSuppressions.addressHash, emailAddressHash(email)));
  return !!row;
}
export function unsubscribeLink(uid: string, email: string, english: boolean) {
  const token = Buffer.from(uid).toString('base64url') + '.' + digest('email-unsubscribe-v1', uid + '\0' + emailAddressHash(email));
  const url = new URL('/api/email/unsubscribe', origin());
  url.searchParams.set('token', token);
  if (english) url.searchParams.set('lang', 'en');
  return url.href;
}
export async function unsubscribeEmail(token: string) {
  const match = /^([A-Za-z0-9_-]{1,240})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const uid = Buffer.from(match[1], 'base64url').toString('utf8');
  return db().transaction(async tx => {
    const [account] = await tx.select({ email: user.email }).from(user).where(eq(user.id, uid)).for('update');
    if (!account) return false;
    const expected = digest('email-unsubscribe-v1', uid + '\0' + emailAddressHash(account.email));
    if (!timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(expected, 'hex'))) return false;
    const [before] = await tx.select().from(communicationPreferences).where(eq(communicationPreferences.userId, uid));
    const categories = emailCategories(before?.categories, before?.promotional ?? false);
    if (!before?.promotional && !optionalMarketingCategories.some(category => categories[category])) return true;
    for (const category of optionalMarketingCategories) categories[category] = false;
    await tx.update(communicationPreferences).set({ categories, promotional: false, updatedAt: new Date() })
      .where(eq(communicationPreferences.userId, uid));
    await tx.insert(mailConsents).values({ id: crypto.randomUUID(), userId: uid, source: 'unsubscribe',
      preferences: { transactional: before?.transactional ?? true, promotional: false, categories } });
    return true;
  });
}
