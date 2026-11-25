import { z } from 'zod';
import { Webhook } from 'svix';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
import { AppError } from './service';
import { emailAddressHash } from './mail-consent';

const eventSchema = z.object({
  type:z.string(),
  data:z.object({email_id:z.string().min(1).max(180), to:z.array(z.string().max(254)).max(50).optional()}),
});

export async function emailWebhook(raw: string, headers: Headers) {
  if (!process.env.RESEND_WEBHOOK_SECRET) throw new AppError(503, 'Webhook email neconfigurat.');
  let event: z.infer<typeof eventSchema>;
  const id = headers.get('svix-id') || '';
  try {
    new Webhook(process.env.RESEND_WEBHOOK_SECRET).verify(raw, {
      'svix-id': id,
      'svix-timestamp': headers.get('svix-timestamp') || '',
      'svix-signature': headers.get('svix-signature') || '',
    });
    event = eventSchema.parse(JSON.parse(raw));
  } catch {
    throw new AppError(400, 'Semnătură email invalidă.');
  }
  await db().transaction(async tx => {
    const rows = await tx.insert(s.emailEvents).values({id,providerId:event.data.email_id,status:event.type})
      .onConflictDoNothing().returning({id:s.emailEvents.id});
    if (!rows.length) return;
    const error = { 'email.bounced':'EMAIL_BOUNCED', 'email.failed':'EMAIL_FAILED', 'email.complained':'EMAIL_COMPLAINT' }[event.type];
    const delivered = event.type === 'email.delivered';
    if (error || delivered) {
      await tx.update(s.notifications).set({status:delivered?'delivered':'failed',error:error??null})
        .where(and(eq(s.notifications.providerId,event.data.email_id),eq(s.notifications.channel,'email'),
          sql`${s.notifications.status} IN ('accepted','delivered')`));
      await tx.update(s.mailDeliveries).set({status:delivered?'delivered':'failed',error:error??null})
        .where(and(eq(s.mailDeliveries.providerId,event.data.email_id),
          sql`${s.mailDeliveries.status} IN ('accepted','delivered')`));
    }
    if (event.type === 'email.bounced' || event.type === 'email.complained') {
      const tracked = await tx.select({email:s.mailDeliveries.recipientEmail}).from(s.mailDeliveries)
        .where(eq(s.mailDeliveries.providerId,event.data.email_id));
      const addresses = [...new Set([...(event.data.to ?? []), ...tracked.map(x=>x.email)])]
        .filter((email):email is string=>z.email().safeParse(email).success);
      if (addresses.length) await tx.insert(s.mailSuppressions).values(addresses.map(email=>({
        addressHash:emailAddressHash(email),reason:event.type,
      }))).onConflictDoNothing();
    }
  });
  return {ok:true};
}
