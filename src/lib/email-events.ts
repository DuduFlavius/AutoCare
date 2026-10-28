import { z } from 'zod';
import { Webhook } from 'svix';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
import { AppError } from './service';
export async function emailWebhook(raw: string, headers: Headers) {
  if (!process.env.RESEND_WEBHOOK_SECRET) throw new AppError(503, 'Webhook email neconfigurat.');
  let event: { type: string; data: { email_id: string } };
  try {
    new Webhook(process.env.RESEND_WEBHOOK_SECRET).verify(raw, {
      'svix-id': headers.get('svix-id') || '',
      'svix-timestamp': headers.get('svix-timestamp') || '',
      'svix-signature': headers.get('svix-signature') || '',
    });
    event = z
      .object({ type: z.string(), data: z.object({ email_id: z.string() }) })
      .parse(JSON.parse(raw));
  } catch {
    throw new AppError(400, 'Semnătură email invalidă.');
  }
  const id = headers.get('svix-id')!;
  await db()
    .insert(s.emailEvents)
    .values({ id, providerId: event.data.email_id, status: event.type })
    .onConflictDoNothing();
  if (event.type === 'email.delivered')
    await db()
      .update(s.notifications)
      .set({ status: 'delivered', error: null })
      .where(
        and(
          eq(s.notifications.providerId, event.data.email_id),
          eq(s.notifications.channel, 'email'),
          eq(s.notifications.status, 'accepted'),
        ),
      );
  if (['email.bounced', 'email.failed'].includes(event.type))
    await db()
      .update(s.notifications)
      .set({
        status: 'failed',
        error: event.type === 'email.bounced' ? 'EMAIL_BOUNCED' : 'EMAIL_FAILED',
      })
      .where(
        and(
          eq(s.notifications.providerId, event.data.email_id),
          eq(s.notifications.channel, 'email'),
          sql`${s.notifications.status} IN ('accepted','delivered')`,
        ),
      );
  if (['email.delivered', 'email.bounced', 'email.failed'].includes(event.type))
    await db().update(s.mailDeliveries).set({
      status: event.type === 'email.delivered' ? 'delivered' : 'failed',
      error: event.type === 'email.delivered' ? null : 'EMAIL_DELIVERY_FAILED',
    }).where(and(eq(s.mailDeliveries.providerId, event.data.email_id), sql`${s.mailDeliveries.status} IN ('accepted','delivered')`));
  return { ok: true };
}
