import {accountPreferences,reminderPreference} from './account-preferences';
import {sendNativePush} from './native-push';
import {userLanguage} from './user-language';
import { calendarRecordDate, isPlannedService } from './planned-service';
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
import { automationState, scheduleMonthlyVehicleMail, scheduleSubscriptionMail } from './mail-automation';
import { dispatchMailSafely } from './mail-dispatch';
import { communicationPreference } from './mail-policy';
import { emailSuppressed } from './mail-consent';
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
  const preferences = new Map<string,Awaited<ReturnType<typeof accountPreferences>>>();
  const mailPreferences = new Map<string, Awaited<ReturnType<typeof communicationPreference>>>();
  const entitlements = new Map<string, boolean>();
  for (const { r, v, p, u } of rows) {
    const preference=preferences.get(u.id)??await accountPreferences(u.id); preferences.set(u.id,preference);
    if(!preference.alerts[reminderPreference(r.category||r.title,r.kind)])continue;
    const hour = Number(
      new Intl.DateTimeFormat('en-GB', {
        timeZone: p.timezone,
        hour: '2-digit',
        hourCycle: 'h23',
      }).format(now),
    );
    if (hour < p.hour) continue;
    const paid = entitlements.get(u.id) ?? await premium(u.id, now);
    entitlements.set(u.id, paid);
    const en=(await userLanguage(u.id))==='en';
    const today = localDate(now, p.timezone);
    const planned = isPlannedService(r, today);
    const deadline = calendarRecordDate(r, today);
    const days = deadline ? daysRemaining(deadline, now, p.timezone) : null;
    const due = planned ? (days !== null && [7, 3, 1, 0].includes(days) ? ['plan-' + days] : []) : reminderOffsets({parts:r.parts,paid,defaults:p.offsets,days,nextKm:r.kind==='service'?r.nextKm:null,odometer:v.odometer,afterExpiry:p.afterExpiry});
    for (const offset of due)
      for (const channel of ['email', 'push', 'app']) {
        if (channel === 'email') {
          if (!u.emailVerified) continue;
          const mail = mailPreferences.get(u.id) ?? await communicationPreference(u.id);
          mailPreferences.set(u.id,mail);
          if (!mail.categories[r.kind === 'service' ? 'maintenance' : 'documents']) continue;
        }
        if ((channel === 'email' && !p.emailEnabled) || (channel === 'push' && !p.pushEnabled))
          continue;
        const subject = `${r.category || r.title}: ${v.brand} ${v.model} (${v.plate})`;
        const reminder = planned ? (days === 0 ? 'Lucrarea programată este astăzi.' : `Lucrarea programată se apropie. Mai sunt ${days} ${days === 1 ? 'zi' : 'zile'}.`) : offset.startsWith('km-before-') ? `Mai sunt ${Math.max(0,(r.nextKm??v.odometer)-v.odometer)} km până la intervenția programată.` : offset === 'km'
          ? `Ai atins ${r.nextKm} km. Verifică lucrarea programată.`
          : days === 0
            ? `Astăzi expiră ${r.category || r.title}.`
            : days! < 0
              ? `${r.category || r.title} a expirat de ${Math.abs(days!)} ${Math.abs(days!) === 1 ? 'zi' : 'zile'}.`
              : `În ${days} ${days === 1 ? 'zi' : 'zile'} expiră ${r.category || r.title}.`;
        const englishReminder=planned ? (days===0?'Your scheduled service is today.':`Your scheduled service is in ${days} ${days===1?'day':'days'}.`) : offset.startsWith('km-before-') ? `${Math.max(0,(r.nextKm??v.odometer)-v.odometer)} km until your scheduled service.` : offset==='km' ? `You have reached ${r.nextKm} km. Check your scheduled service.` : days===0 ? 'Expires today.' : days!<0 ? `Expired ${Math.abs(days!)} ${Math.abs(days!)===1?'day':'days'} ago.` : `Expires in ${days} ${days===1?'day':'days'}.`;
        const message = `${subject} — ${en?englishReminder:reminder}`;
        const out = await db()
          .insert(s.notifications)
          .values({
            id: crypto.randomUUID(),
            userId: u.id,
            recordId: r.id,
            revision: r.revision,
            channel,
            status:channel==='app'?'delivered':'pending',
            offset,
            localDate: localDate(now, p.timezone),
            message,
            nextAttemptAt: now,
            createdAt: now,
          })
          .onConflictDoNothing()
          .returning({ id: s.notifications.id });
        if(channel!=='app')queued += out.length;
      }
  }
  return queued;
}
export type Transport = (
  item: typeof s.notifications.$inferSelect,
  email: string,
) => Promise<string>;
export const realTransport: Transport = async (n, email) => {
  if (n.channel === 'email') {
    const [record] = await db().select().from(s.records).where(eq(s.records.id,n.recordId));
    const language = await userLanguage(n.userId);
    const en = language === 'en';
    const deadline = record && calendarRecordDate(record,n.localDate);
    const facts = [];
    if (deadline) facts.push({label:en?'Due date':'Termen',value:new Intl.DateTimeFormat(en?'en-GB':'ro-RO',{dateStyle:'long',timeZone:'UTC'}).format(new Date(deadline+'T12:00:00Z'))});
    if (record?.nextKm != null && record.kind==='service') facts.push({label:en?'Service mileage':'Kilometraj revizie',value:record.nextKm.toLocaleString(en?'en-GB':'ro-RO')+' km'});
    const service = record?.kind==='service';
    const content = renderEmail('reminder', {language, message:n.message, name:await userEmailName(n.userId), facts,
      ctaLabel:en ? (service?'Open maintenance':'Open documents') : (service?'Vezi întreținerea':'Vezi documentele'),
      ctaPath:'/cont?tab='+encodeURIComponent(service?'Întreținere':'Documente'),
      preheader:en?'Review the deadline in your AutoCare garage.':'Verifică termenul în garajul tău AutoCare.'});
    return sendMail(email,content.subject,content.text,`reminder/${n.id}`,content);
  }
  return sendPushNotification(n.userId, { id: n.id, title: 'AutoCare', body: n.message });
};

export async function sendPushNotification(
  uid: string,
  payload: { id: string; title: string; body: string },
  nativeTransport = sendNativePush,
) {
  // Prefer native delivery so Android users do not also get the alert from Chrome.
  let nativeSent = 0;
  let nativeError: unknown;
  try { nativeSent = await nativeTransport(uid, payload); } catch (error) { nativeError = error; }
  if (nativeSent) return 'push-accepted';
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    if (nativeError) throw nativeError;
    throw new Error('PUSH_NOT_CONFIGURED');
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );
  const list = await db().select().from(s.pushes).where(eq(s.pushes.userId, uid));
  if (!list.length) { if(nativeError) throw nativeError; throw new Error('PUSH_NO_SUBSCRIPTION'); }
  let sent = 0;
  let providerFailed = false;
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
      else providerFailed = true;
    }
  }
  if (!sent) throw new Error(providerFailed ? 'PUSH_PROVIDER_ERROR' : 'PUSH_NO_SUBSCRIPTION');
  return 'push-accepted';
}
export async function deliverReminders(now = new Date(), transport: Transport = realTransport) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    await db().update(s.notifications).set({status:'failed',error:'EMAIL_GMAIL_UNCONFIRMED'})
      .where(and(eq(s.notifications.channel,'email'),eq(s.notifications.status,'sending'),
        lte(s.notifications.lockedAt,new Date(now.getTime()-120000))));
  }
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
  const deadline = Date.now() + 26000;
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
      (await accountPreferences(context.u.id)).alerts[reminderPreference(context.r.category||context.r.title,context.r.kind)] &&
      !context.r.cancelled &&
      !context.v.archived &&
      context.r.revision === n.revision &&
      (n.channel !== 'email' || (context.u.emailVerified &&
        (await communicationPreference(context.u.id)).categories[context.r.kind==='service'?'maintenance':'documents'] &&
        !(await emailSuppressed(context.u.email)))) &&
      (n.channel === 'email' ? context.p.emailEnabled : context.p.pushEnabled) &&
      (n.offset.startsWith('plan-')
        ? isPlannedService(context.r, n.localDate) && calendarRecordDate(context.r, n.localDate) != null
          && n.offset === 'plan-' + daysRemaining(calendarRecordDate(context.r, n.localDate)!, now, context.p.timezone)
        : alertOffsetAllowed(n.offset,context.r.parts,paid,context.p.offsets,context.p.afterExpiry)) &&
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
        const failed = events.some((e) => ['email.failed', 'email.bounced','email.complained'].includes(e.status));
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
      const permanent = /CONFIGURED|NO_SUBSCRIPTION|EMAIL_PROVIDER_4(?!29)|EMAIL_GMAIL_UNCONFIRMED|EMAIL_ADDRESS_SUPPRESSED|INVALID_EMAIL_HEADERS/.test(code);
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
    if ((await automationState()).enabled) await scheduleMonthlyVehicleMail(now);
    const queued = await scheduleReminders(now);
    const sent = await deliverReminders(now);
    await dispatchMailSafely(now);
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
