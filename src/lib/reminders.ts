import {reminderOffsets,alertOffsetAllowed} from './maintenance-alerts';
import { and, eq, sql, lte, or } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
import { daysRemaining, localDate } from './config';
import { premium } from './service';
import { sendMail } from './mail';
import { renderEmail } from './email-templates';
import { userEmailName } from './mail-log';
import webpush from 'web-push';
import { scheduleSubscriptionMail } from './mail-automation';
import { deliverAutomatedMail } from './mail-center';
export async function scheduleReminders(now = new Date()) {
  const rows = await db()
    .select({ r: s.records, v: s.vehicles, p: s.profiles, u: s.user, sub: s.subscriptions })
    .from(s.records)
    .innerJoin(s.vehicles, eq(s.records.vehicleId, s.vehicles.id))
    .innerJoin(s.profiles, eq(s.records.userId, s.profiles.userId))
    .innerJoin(s.user, eq(s.records.userId, s.user.id))
    .leftJoin(s.subscriptions, eq(s.records.userId, s.subscriptions.userId))
    .where(and(eq(s.records.cancelled, false), eq(s.vehicles.archived, false)));
  let queued = 0;
  for (const { r, v, p, u } of rows) {
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: p.timezone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    );
    if (hour < p.hour) continue;
    const paid = await premium(u.id, now);
    const days = r.expiresAt ? daysRemaining(r.expiresAt, now, p.timezone) : null;
    const due=reminderOffsets({parts:r.parts,paid,defaults:p.offsets,days,nextKm:r.kind==='service'?r.nextKm:null,odometer:v.odometer,afterExpiry:p.afterExpiry});
    for (const offset of due)
      for (const channel of ['email', 'push']) {
        if (channel === 'email' && !u.emailVerified) continue;
        if ((channel === 'email' && !p.emailEnabled) || (channel === 'push' && !p.pushEnabled))
          continue;
        const subject = `${r.category || r.title}: ${v.brand} ${v.model} (${v.plate})`;
        const reminder = offset.startsWith('km-before-') ? `Mai sunt ${Math.max(0,(r.nextKm??v.odometer)-v.odometer)} km până la intervenția programată.` : offset === 'km'
          ? `Ai atins ${r.nextKm} km. Verifică lucrarea programată.`
          : days === 0
            ? `Astăzi expiră ${r.category || r.title}.`
            : days! < 0
              ? `${r.category || r.title} a expirat de ${Math.abs(days!)} ${Math.abs(days!) === 1 ? 'zi' : 'zile'}.`
              : `În ${days} ${days === 1 ? 'zi' : 'zile'} expiră ${r.category || r.title}.`;
        const message = `${subject} — ${reminder}`;
        const out = await db()
          .insert(s.notifications)
          .values({
            id: crypto.randomUUID(),
            userId: u.id,
            recordId: r.id,
            revision: r.revision,
            channel,
            offset,
            localDate: localDate(now, p.timezone),
            message,
            nextAttemptAt: now,
            createdAt: now,
          })
          .onConflictDoNothing()
          .returning({ id: s.notifications.id });
        queued += out.length;
      }
  }
  return queued;
}
export type Transport = (
  item: typeof s.notifications.$inferSelect,
  email: string,
) => Promise<string>;
export const realTransport: Transport = async (n, email) => {
  if (n.channel === 'email')
    return sendMail(email, 'AutoCare — memento pentru mașina ta', n.message, `reminder/${n.id}`, renderEmail('reminder', { message: n.message, name: await userEmailName(n.userId) }));
  return sendPushNotification(n.userId, { id: n.id, title: 'AutoCare', body: n.message });
};

export async function sendPushNotification(
  uid: string,
  payload: { id: string; title: string; body: string },
) {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT)
    throw new Error('PUSH_NOT_CONFIGURED');
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  const list = await db().select().from(s.pushes).where(eq(s.pushes.userId, uid));
  if (!list.length) throw new Error('PUSH_NO_SUBSCRIPTION');
  let sent = 0;
  for (const p of list) {
    try {
      await webpush.sendNotification(
        { endpoint: p.endpoint, keys: p.keys },
        JSON.stringify(payload),
        { TTL: 3600, timeout: 10000 },
      );
      sent++;
    } catch (e) {
      if ([404, 410].includes((e as { statusCode: number }).statusCode))
        await db().delete(s.pushes).where(eq(s.pushes.id, p.id));
      else throw new Error('PUSH_PROVIDER_ERROR', { cause: e });
    }
  }
  if (!sent) throw new Error('PUSH_NO_SUBSCRIPTION');
  return 'push-accepted';
}
export async function deliverReminders(now = new Date(), transport: Transport = realTransport) {
  // Never retry ambiguous deliveries beyond the provider's 24h idempotency window.
  await db()
    .update(s.notifications)
    .set({ status: 'failed', error: 'RETRY_WINDOW_EXPIRED' })
    .where(
      and(
        sql`${s.notifications.status} IN ('pending','retry','sending')`,
        sql`${s.notifications.createdAt} < ${new Date(now.getTime() - 23 * 3600000)}`,
      ),
    );
  const candidates = await db()
    .select()
    .from(s.notifications)
    .where(
      and(
        or(
          sql`${s.notifications.status} IN ('pending','retry')`,
          and(
            eq(s.notifications.status, 'sending'),
            lte(s.notifications.lockedAt, new Date(now.getTime() - 120000)),
          ),
        ),
        lte(s.notifications.nextAttemptAt, now),
      ),
    )
    .limit(50);
  let accepted = 0;
  const deadline = Date.now() + 40000;
  for (const candidate of candidates) {
    if (Date.now() > deadline) break;
    const lease = new Date(now);
    const claimed = await db()
      .update(s.notifications)
      .set({ status: 'sending', lockedAt: lease, attempts: sql`${s.notifications.attempts}+1` })
      .where(
        and(
          eq(s.notifications.id, candidate.id),
          or(
            sql`${s.notifications.status} IN ('pending','retry')`,
            and(
              eq(s.notifications.status, 'sending'),
              lte(s.notifications.lockedAt, new Date(now.getTime() - 120000)),
            ),
          ),
        ),
      )
      .returning();
    if (!claimed.length) continue;
    const n = claimed[0];
    const context = (
      await db()
        .select({ r: s.records, v: s.vehicles, p: s.profiles, u: s.user, sub: s.subscriptions })
        .from(s.records)
        .innerJoin(s.vehicles, eq(s.records.vehicleId, s.vehicles.id))
        .innerJoin(s.profiles, eq(s.records.userId, s.profiles.userId))
        .innerJoin(s.user, eq(s.records.userId, s.user.id))
        .leftJoin(s.subscriptions, eq(s.subscriptions.userId, s.user.id))
        .where(eq(s.records.id, n.recordId))
    )[0];
    const paid = context ? await premium(context.u.id, now) : false;
    const valid =
      context &&
      !context.r.cancelled &&
      !context.v.archived &&
      context.r.revision === n.revision &&
      (n.channel !== 'email' || context.u.emailVerified) &&
      (n.channel === 'email' ? context.p.emailEnabled : context.p.pushEnabled) &&
      alertOffsetAllowed(n.offset,context.r.parts,paid,context.p.offsets,context.p.afterExpiry) &&
      localDate(now, context.p.timezone) === n.localDate;
    if (!valid) {
      await db()
        .update(s.notifications)
        .set({ status: 'cancelled' })
        .where(eq(s.notifications.id, n.id));
      continue;
    }
    try {
      const providerId = await transport(n, context.u.email);
      await db().transaction(async (tx) => {
        const events = await tx
          .select()
          .from(s.emailEvents)
          .where(eq(s.emailEvents.providerId, providerId));
        const failed = events.some((e) => ['email.failed', 'email.bounced'].includes(e.status));
        const delivered = events.some((e) => e.status === 'email.delivered');
        await tx
          .update(s.notifications)
          .set({
            status: failed ? 'failed' : delivered ? 'delivered' : 'accepted',
            providerId,
            error: failed ? 'EMAIL_FAILED' : null,
          })
          .where(eq(s.notifications.id, n.id));
        await tx
          .insert(s.deliveryAttempts)
          .values({ id: crypto.randomUUID(), notificationId: n.id, status: 'accepted' });
      });
      accepted++;
    } catch (e) {
      const raw = e instanceof Error ? e.message : 'PROVIDER_ERROR';
      const code = /^(EMAIL_|PUSH_)[A-Z0-9_]+$/.test(raw) ? raw : 'PROVIDER_ERROR';
      const permanent = /CONFIGURED|NO_SUBSCRIPTION|EMAIL_PROVIDER_4(?!29)/.test(code);
      const status = n.attempts >= 4 || permanent ? 'failed' : 'retry';
      await db().transaction(async (tx) => {
        await tx
          .update(s.notifications)
          .set({
            status,
            error: code,
            nextAttemptAt: new Date(now.getTime() + Math.pow(2, n.attempts) * 60000),
          })
          .where(eq(s.notifications.id, n.id));
        await tx
          .insert(s.deliveryAttempts)
          .values({ id: crypto.randomUUID(), notificationId: n.id, status, error: code });
      });
    }
  }
  return accepted;
}
export async function runJob(now = new Date()) {
  const id = crypto.randomUUID();
  await db().insert(s.jobRuns).values({ id, status: 'running' });
  try {
    await db()
      .delete(s.requestLimits)
      .where(lte(s.requestLimits.window, new Date(now.getTime() - 2 * 86400000)));
    await db()
      .delete(s.rateLimit)
      .where(lte(s.rateLimit.lastRequest, now.getTime() - 7 * 86400000));
    await db()
      .delete(s.emailEvents)
      .where(lte(s.emailEvents.createdAt, new Date(now.getTime() - 30 * 86400000)));
    await db()
      .delete(s.audit)
      .where(lte(s.audit.createdAt, new Date(now.getTime() - 90 * 86400000)));
    await scheduleSubscriptionMail(now);
    await deliverAutomatedMail();
    const queued = await scheduleReminders(now);
    const sent = await deliverReminders(now);
    await db()
      .update(s.jobRuns)
      .set({ status: 'completed', finishedAt: new Date(), queued, sent })
      .where(eq(s.jobRuns.id, id));
    return { queued, accepted: sent };
  } catch {
    await db()
      .update(s.jobRuns)
      .set({ status: 'failed', finishedAt: new Date() })
      .where(eq(s.jobRuns.id, id));
    throw new Error('REMINDER_JOB_FAILED');
  }
}
