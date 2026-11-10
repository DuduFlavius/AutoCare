import { financeGroup, financeGroups, isFinancialEntry } from '@/lib/finance-overview';
import { isPlannedService } from '@/lib/planned-service';
import { localDate } from '@/lib/config';
import { aiModes, askAutoAssistant, autoAssistantHistory, clearAutoAssistantHistory, scanAutoDocument } from '@/lib/auto-assistant';
import { findRoadDestinations } from '@/lib/road-geocoding';
import { loadDrivingRoutes, roadCoordinate } from '@/lib/road-navigation-server';
import { autoPointCategories } from '@/lib/auto-points';
import { loadAutoPoints } from '@/lib/auto-points-server';
import {automaticTripBatch} from '@/lib/automatic-trips';
import { revalidatePath, revalidateTag } from 'next/cache';
import { filterRecords } from '@/lib/record-filters';
import * as founder from '@/lib/founder';
import { pricing, savings } from '@/lib/pricing';
import * as supportChat from '@/lib/support-chat';
import { emailWebhook } from '@/lib/email-events';
import { and, eq, desc, sql, isNull, inArray } from 'drizzle-orm';
import { ZodError, z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import * as s from '@/lib/schema';
import * as svc from '@/lib/service';
import { origin } from '@/lib/config';
import { runJob, sendPushNotification } from '@/lib/reminders';
import { sendMail } from '@/lib/mail';
import * as googleMail from '@/lib/google-mail';
import * as mailCenter from '@/lib/mail-center';
import { renderEmail } from '@/lib/email-templates';
import { stripe, checkout, billingPortal, billingInvoice, processStripeEvent } from '@/lib/billing';
import {createMechanicShare,listMechanicShares,revokeMechanicShare} from '@/lib/mechanic-shares';
import {syncPaidExtensions} from '@/lib/subscription-extensions';
import {vehicleReport} from '@/lib/vehicle-report';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const json = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  });
const uuid = z.string().uuid();
async function rate(uid: string, bucket = 'api', limit = 90, windowMs = 60000) {
  const key = `${bucket}:${uid}:${Math.floor(Date.now() / windowMs)}`;
  const out = await db()
    .insert(s.requestLimits)
    .values({ key, window: new Date() })
    .onConflictDoUpdate({
      target: s.requestLimits.key,
      set: { count: sql`${s.requestLimits.count}+1` },
    })
    .returning();
  if (out[0].count > limit)
    throw new svc.AppError(429, windowMs === 60000 ? 'Prea multe cereri. Reîncearcă într-un minut.' : 'Limita zilnică pentru AI a fost atinsă. Reîncearcă mâine.');
}
function secret(req: Request) {
  const value = req.headers.get('authorization') || '';
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  return (
    !!process.env.CRON_SECRET &&
    value.length === expected.length &&
    timingSafeEqual(Buffer.from(value), Buffer.from(expected))
  );
}
async function bounded(req: Request, max: number) {
  if (Number(req.headers.get('content-length') || 0) > max)
    throw new svc.AppError(413, 'Cerere prea mare.');
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new svc.AppError(413, 'Cerere prea mare.');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
async function body(req: Request) {
  return JSON.parse(Buffer.from(await bounded(req, 65536)).toString('utf8'));
}
async function form(req: Request) {
  const bytes = await bounded(req, 2200000);
  return new Response(bytes, {
    headers: { 'Content-Type': req.headers.get('content-type') || '' },
  }).formData();
}
async function handle(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  try {
    const path = (await ctx.params).path;
    const route = path.join('/');
    const method = req.method;
    if (route === 'jobs/reminders' && method === 'GET') {
      if (!secret(req)) return json({ error: 'Neautorizat' }, 401);
      return json(await runJob());
    }
    if (route === 'email/webhook' && method === 'POST') {
      const raw = Buffer.from(await bounded(req, 1048576)).toString('utf8');
      if (raw.length > 65536) throw new svc.AppError(413, 'Cerere prea mare.');
      return json(await emailWebhook(raw, req.headers));
    }
    if (route === 'billing/webhook' && method === 'POST') {
      const sig = req.headers.get('stripe-signature');
      if (!sig || !process.env.STRIPE_WEBHOOK_SECRET)
        return json({ error: 'Webhook neconfigurat' }, 400);
      const raw = Buffer.from(await bounded(req, 1048576)).toString('utf8');
      if (raw.length > 1024 * 1024) return json({ error: 'Cerere prea mare' }, 413);
      let event;
      try {
        event = stripe().webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
      } catch {
        return json({ error: 'Semnătură invalidă' }, 400);
      }
      return json(await processStripeEvent(event, stripe()));
    }
    if (route === 'pricing' && method === 'GET') {
      const p = await pricing();
      return json({
        monthlyBani: p.monthlyBani,
        annualBani: p.annualBani,
        currency: p.currency,
        ...savings(p.monthlyBani, p.annualBani),
      });
    }
    if (method !== 'GET' && req.headers.get('origin') !== origin())
      return json({ error: 'Origine invalidă' }, 403);
    const sess = await auth().api.getSession({ headers: req.headers });
    if (
      !sess?.user ||
      (process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION === 'true' && !sess.user.emailVerified)
    )
      return json({ error: 'Autentifică-te și confirmă emailul.' }, 401);
    const uid = sess.user.id;
    await svc.assertActiveAccount(uid);
    await rate(uid);
    if (route === 'auto-assistant/history' && method === 'DELETE') {
      const { vehicleId } = z.object({ vehicleId: uuid }).parse(await body(req));
      return json(await clearAutoAssistantHistory(uid, vehicleId));
    }
    if (path[0] === 'auto-assistant') {
      if (!await svc.premium(uid)) throw new svc.AppError(403, 'Asistentul AI este disponibil în Premium.');
      if (route === 'auto-assistant/history' && method === 'GET')
        return json(await autoAssistantHistory(uid, uuid.parse(new URL(req.url).searchParams.get('vehicleId'))));
      if (route === 'auto-assistant' && method === 'POST') {
        const { vehicleId, question, language, mode, localFallback } = z.object({
          vehicleId: uuid,
          question: z.string().trim().min(1).max(600),
          language: z.enum(['ro', 'en']).default('ro'),
          mode: z.enum(aiModes).default('chat'),
          localFallback: z.boolean().default(false),
        }).parse(await body(req));
        await rate(uid, 'auto-assistant', 4);
        await rate(uid, 'auto-assistant-day', 24, 86400000);
        await rate('all', 'ai-provider-day', 600, 86400000);
        return json(await askAutoAssistant(uid, vehicleId, question, language, mode, localFallback));
      }
      if (route === 'auto-assistant/scan' && method === 'POST') {
        await rate(uid, 'auto-assistant-scan-day', 6, 86400000);
        await rate('all', 'ai-provider-scan-day', 100, 86400000);
        const data = await form(req);
        const file = data.get('file');
        if (!(file instanceof File) || file.size < 1 || file.size > 2097152)
          throw new svc.AppError(400, 'Încarcă un document de maximum 2 MB.');
        return json(await scanAutoDocument(uid, uuid.parse(data.get('vehicleId')), Buffer.from(await file.arrayBuffer())));
      }
    }
    if (route === 'smartdrive/destinations' && method === 'POST') {
      await rate(uid, 'smartdrive-destinations', 12);
      const { query, area } = z.object({ query: z.string().trim().min(3).max(160), area: roadCoordinate }).parse(await body(req));
      return json(await findRoadDestinations(query, area.latitude, area.longitude));
    }
    if (route === 'smartdrive/directions' && method === 'POST') {
      await rate(uid, 'smartdrive-directions', 8);
      const { start, end, startAccuracy } = z.object({ start: roadCoordinate, end: roadCoordinate, startAccuracy: z.number().min(0).max(500).optional() }).parse(await body(req));
      return json(await loadDrivingRoutes(start, end, startAccuracy));
    }
    if (route === 'smartdrive/auto-points' && method === 'POST') {
      await rate(uid, 'auto-points', 10);
      const { latitude, longitude, category } = z.object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
        category: z.enum(Object.keys(autoPointCategories) as [keyof typeof autoPointCategories, ...(keyof typeof autoPointCategories)[]]),
      }).parse(await body(req));
      try {
        return json(await loadAutoPoints(Number(latitude.toFixed(2)), Number(longitude.toFixed(2)), category));
      } catch {
        throw new svc.AppError(503, 'Punctele auto sunt temporar indisponibile. Reîncearcă.');
      }
    }
    if (path[0] === 'mail' && path[1] === 'google') {
      await founder.requireFounder(uid);
      if (route === 'mail/google/status' && method === 'GET')
        return json(await googleMail.googleMailStatus(uid));
      if (route === 'mail/google/disconnect' && method === 'POST')
        return json(await googleMail.disconnectGoogleMail(uid));
      if (new URL(req.url).origin !== new URL(googleMail.googleMailCallback()).origin)
        return json({ error: 'Conectarea și testarea Gmail sunt disponibile pe domeniul de producție configurat.' }, 403);
      if (route === 'mail/google/connect' && method === 'POST') {
        const result = await googleMail.beginGoogleMail(uid, sess.session.id);
        return Response.json({ url: result.url }, { headers: {
          'Cache-Control': 'private, no-store', 'Set-Cookie': result.cookie,
          'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
        } });
      }
      if (route === 'mail/google/callback' && method === 'GET') {
        let outcome = 'connected';
        try { await googleMail.completeGoogleMail(uid, sess.session.id, req); }
        catch { outcome = 'failed'; }
        return new Response(null, { status: 303, headers: {
          Location: '/admin?gmail=' + outcome, 'Cache-Control': 'private, no-store',
          'Referrer-Policy': 'no-referrer', 'Set-Cookie': googleMail.clearGoogleMailCookie,
          'X-Robots-Tag': 'noindex, nofollow',
        } });
      }
      if (route === 'mail/google/test' && method === 'POST')
        return json(await googleMail.testGoogleMail(uid));
      return json({ error: 'Rută inexistentă.' }, 404);
    }
    if (route === 'communication-preferences') {
      if (method === 'GET') return json(await mailCenter.getCommunicationPreference(uid));
      if (method === 'PUT') return json(await mailCenter.saveCommunicationPreference(uid, await body(req)));
    }
    if (path[0] === 'founder') {
      // Deny before reading inputs or dispatching any founder operation, including future routes.
      if (path[1] === 'mail') await mailCenter.requireMailStaff(uid);
      else await founder.requireFounder(uid);
      if (route === 'founder/mail' && method === 'GET') return json(await mailCenter.mailCenterOverview(uid));
      if (route === 'founder/mail/approval-request' && method === 'POST') return json(await mailCenter.requestAutomationApproval(uid));
      if (path.length === 5 && path[1] === 'mail' && path[2] === 'campaigns' && path[4] === 'request-approval' && method === 'POST') return json(await mailCenter.requestCampaignApproval(uid, path[3]));
      if (path.length === 5 && path[1] === 'mail' && path[2] === 'campaigns' && path[4] === 'review' && method === 'POST') return json(await mailCenter.reviewCampaign(uid, path[3], await body(req)));
      if (route === 'founder/mail/library' && method === 'POST') return json(await mailCenter.saveMailLibraryEntry(uid, await body(req)));
      if (path.length === 4 && path[1] === 'mail' && path[2] === 'library' && method === 'DELETE') return json(await mailCenter.deleteMailLibraryEntry(uid, path[3]));
      if (route === 'founder/mail/approve' && method === 'POST') return json(await mailCenter.approveMailAutomation(uid, await body(req)));
      if (route === 'founder/mail/preview' && method === 'POST') return json(await mailCenter.previewMail(uid, await body(req)));
      if (route === 'founder/mail/campaigns' && method === 'POST') return json(await mailCenter.saveCampaign(uid, await body(req)));
      if (path[1] === 'mail' && path[2] === 'campaigns' && path[3]) {
        if (path.length === 4 && method === 'GET') return json(await mailCenter.campaignDetail(uid, path[3]));
        if (path.length === 5 && path[4] === 'retry-failed' && method === 'POST') return json(await mailCenter.retryFailedCampaign(uid, path[3]));
        if (path.length === 5 && path[4] === 'publish-release' && method === 'POST') return json(await mailCenter.publishReleaseNews(uid, path[3], await body(req)));
        if (path.length === 5 && path[4] === 'send' && method === 'POST') return json(await mailCenter.sendCampaign(uid, path[3]));
      }

      if (route === 'founder/seo' && method === 'GET') return json({ ...await founder.founderSeo(uid), appURL: origin() });
      if (route === 'founder/seo' && method === 'PUT') {
        const result = await founder.saveFounderSeo(uid, await body(req));
        revalidateTag('autocare-google-verification', { expire: 0 });
        revalidatePath('/');
        return json(result);
      }
      if (route === 'founder/team' && method === 'POST')
        return json(await founder.addTeamMember(uid, await body(req)));
      if (route === 'founder/overview' && method === 'GET')
        return json(await founder.founderOverview(uid));
      if (route === 'founder/users' && method === 'GET')
        return json(await founder.founderUsers(uid, new URL(req.url).searchParams));
      if (path[1] === 'users' && path[2]) {
        const id = path[2];
        if (path.length === 3 && method === 'GET')
          return json(await founder.founderUserDetail(uid, id));
        if (path[3] === 'role' && method === 'POST')
          return json(await founder.changeRole(uid, id, await body(req)));
        if (path[3] === 'premium' && method === 'POST')
          return json(await founder.grantPremium(uid, id, await body(req)));
        if (path[3] === 'premium' && method === 'DELETE')
          return json(await founder.revokePremium(uid, id, await body(req)));
        if (path[3] === 'access' && method === 'POST')
          return json(await founder.suspendAccount(uid, id, await body(req)));
      }
      if (route === 'founder/pricing' && method === 'POST')
        return json(await founder.changePricing(uid, await body(req)));
      if (route === 'founder/audit' && method === 'GET')
        return json(await founder.founderAudit(uid, new URL(req.url).searchParams));
      await founder.requireFounder(uid);
      return json({ error: 'Rută inexistentă.' }, 404);
    }
    if (path.length === 3 && path[0] === 'vehicles' && path[2] === 'daily-usage' && (method === 'GET' || method === 'POST')) {
      const vehicleId = uuid.parse(path[1]);
      const car = (await db().select({ id: s.vehicles.id }).from(s.vehicles).where(and(eq(s.vehicles.id, vehicleId), eq(s.vehicles.userId, uid))))[0];
      if (!car) throw new svc.AppError(404, 'Mașină inexistentă.');
      const key = `daily-usage:${uid}:${vehicleId}`;
      if (method === 'POST') {
        const value = z.object({ dailyKm: z.number().min(1).max(2000).nullable() }).parse(await body(req));
        await db().insert(s.settings).values({ key, value }).onConflictDoUpdate({ target: s.settings.key, set: { value } });
        return json(value);
      }
      const row = (await db().select().from(s.settings).where(eq(s.settings.key, key)))[0];
      return json(row?.value ?? { dailyKm: null });
    }
    if (route === 'finance/budget' && method === 'PUT') {
      if (!await svc.premium(uid)) throw new svc.AppError(403, 'Bugetele pe vehicul sunt disponibile în Premium.');
      const { vehicleId, amountBani } = z.object({ vehicleId: uuid, amountBani: z.number().int().min(1).max(100000000).nullable() }).parse(await body(req));
      return json(await svc.saveFinanceBudget(uid, vehicleId, amountBani));
    }
    if (route === 'vehicles/primary' && method === 'PUT') {
      const { vehicleId } = z.object({ vehicleId: uuid }).parse(await body(req));
      return json(await svc.setPrimaryVehicle(uid, vehicleId));
    }
    if (route === 'dashboard' && method === 'GET') return json(await svc.dashboard(uid));
    if (path.length === 2 && path[0] === 'notifications' && method === 'DELETE') {
      const id = uuid.parse(path[1]);
      const notice=(await db().select().from(s.notifications).where(and(eq(s.notifications.id,id),eq(s.notifications.userId,uid))))[0];
      if(!notice)throw new svc.AppError(404,'Notificare inexistentă.');
      const group=and(eq(s.notifications.userId,uid),eq(s.notifications.recordId,notice.recordId),eq(s.notifications.revision,notice.revision),eq(s.notifications.offset,notice.offset),eq(s.notifications.localDate,notice.localDate));
      await db().update(s.notifications).set({readAt:new Date()}).where(group);
      await db().insert(s.notifications).values({...notice,id:crypto.randomUUID(),channel:'app',status:'dismissed',readAt:new Date()}).onConflictDoNothing();
      await db().update(s.notifications).set({status:'dismissed'}).where(and(group,eq(s.notifications.channel,'app')));
      return json({ ok: true });
    }
    if (route === 'notifications/read' && method === 'POST') {
      await db()
        .update(s.notifications)
        .set({ readAt: new Date() })
        .where(and(eq(s.notifications.userId, uid), isNull(s.notifications.readAt)));
      return json({ ok: true });
    }
    if (
      path.length === 3 &&
      path[0] === 'notifications' &&
      path[2] === 'read' &&
      method === 'PATCH'
    ) {
      const id = uuid.parse(path[1]);
      const input = z.object({ read: z.boolean() }).parse(await body(req));
      const updated = await db()
        .update(s.notifications)
        .set({ readAt: input.read ? new Date() : null })
        .where(and(eq(s.notifications.id, id), eq(s.notifications.userId, uid)))
        .returning({ id: s.notifications.id });
      if (!updated.length) throw new svc.AppError(404, 'Notificare inexistentă.');
      return json({ ok: true });
    }

    // Authenticated SmartDrive history; every read/write is scoped to the session user.
    if (route === 'smartdrive/preferences') {
      if (method === 'GET') {
        const row = (await db().select().from(s.mileageReminderPreferences).where(eq(s.mileageReminderPreferences.userId, uid)))[0];
        return json(row || { frequencyDays: 3, enabled: true, lastSentAt: null });
      }
      if (method === 'PUT') {
        const value = z.object({ frequencyDays: z.number().int().min(1).max(90), enabled: z.boolean() }).parse(await body(req));
        const row = (await db().insert(s.mileageReminderPreferences).values({ userId: uid, ...value })
          .onConflictDoUpdate({ target: s.mileageReminderPreferences.userId, set: { ...value, updatedAt: new Date() } }).returning())[0];
        return json(row);
      }
    }
    if (path[0] === 'smartdrive' && path[1] === 'vehicles' && path[2] && path.length === 4) {
      const vehicleId = uuid.parse(path[2]);
      await svc.ownedVehicle(uid, vehicleId);
      if (path[3] === 'readings') {
        if (method === 'GET') return json(await db().select().from(s.mileageReadings)
          .where(and(eq(s.mileageReadings.userId, uid), eq(s.mileageReadings.vehicleId, vehicleId)))
          .orderBy(desc(s.mileageReadings.recordedAt)).limit(200));
        if (method === 'POST') {
          const value = z.object({ odometer: z.number().int().min(0).max(99999999) }).parse(await body(req));
          const result = await db().transaction(async tx => {
            const current = (await tx.select().from(s.vehicles).where(and(eq(s.vehicles.id, vehicleId), eq(s.vehicles.userId, uid))).for('update'))[0];
            if (!current) throw new svc.AppError(404, 'Mașina nu există.');
            if (value.odometer < current.odometer) throw new svc.AppError(400, 'Kilometrajul nu poate fi mai mic decât citirea confirmată.');
            const updated = (await tx.update(s.vehicles).set({ odometer: value.odometer }).where(and(eq(s.vehicles.id, vehicleId), eq(s.vehicles.userId, uid))).returning())[0];
            const reading = (await tx.insert(s.mileageReadings).values({ id: crypto.randomUUID(), userId: uid, vehicleId, odometer: value.odometer, source: 'manual' }).returning())[0];
            return { vehicle: updated, reading };
          });
          return json(result, 201);
        }
      }
      if(path[3]==='trip-batch'&&method==='POST'){
        const input=automaticTripBatch.parse(await body(req));
        if(input.trips.some(t=>Date.parse(t.endedAt)>Date.now()+60000))throw new svc.AppError(400,'Data traseului nu poate fi în viitor.');
        const result=await db().transaction(async tx=>{
          const vehicle=(await tx.select().from(s.vehicles).where(and(eq(s.vehicles.id,vehicleId),eq(s.vehicles.userId,uid))).for('update'))[0];
          if(!vehicle)throw new svc.AppError(404,'Mașina nu există.');
          const ids=input.trips.map(t=>t.id),existing=await tx.select().from(s.gpsTrips).where(inArray(s.gpsTrips.id,ids));
          if(existing.some(t=>t.userId!==uid||t.vehicleId!==vehicleId))throw new svc.AppError(409,'Identificator de traseu invalid.');
          const known=new Set(existing.map(t=>t.id)),fresh=input.trips.filter(t=>!known.has(t.id));
          if(!fresh.length)return {ids,odometer:vehicle.odometer};
          let odometer=vehicle.odometer;
          if(input.syncMileage){
            if(vehicle.odometer!==input.expectedOdometer)throw new svc.AppError(409,'Kilometrajul a fost modificat între timp. Verifică traseele înainte de sincronizare.');
            const previous=(await tx.select({meters:sql<string>`coalesce(sum(${s.gpsTrips.distanceMeters}),0)`}).from(s.gpsTrips).where(and(eq(s.gpsTrips.userId,uid),eq(s.gpsTrips.vehicleId,vehicleId),eq(s.gpsTrips.source,'browser-gps-synced'))))[0];
            odometer+=Math.floor((Number(previous.meters)%1000+fresh.reduce((sum,t)=>sum+t.distanceMeters,0))/1000);
            if(odometer>99999999)throw new svc.AppError(400,'Kilometraj invalid.');
            await tx.update(s.vehicles).set({odometer}).where(and(eq(s.vehicles.id,vehicleId),eq(s.vehicles.userId,uid)));
          }
          await tx.insert(s.gpsTrips).values(fresh.map(t=>({...t,userId:uid,vehicleId,startedAt:new Date(t.startedAt),endedAt:new Date(t.endedAt),source:input.syncMileage?'browser-gps-synced':'browser-gps'})));
          return {ids,odometer};
        });
        return json(result,201);
      }
      if (method === 'GET' && ['trips', 'trip-stats'].includes(path[3])) {
        const query = new URL(req.url).searchParams;
        const date = z.iso.date().optional().parse(query.get('date') ?? undefined);
        const timezone = date ? (await svc.profile(uid)).timezone : undefined;
        const scope = and(eq(s.gpsTrips.userId, uid), eq(s.gpsTrips.vehicleId, vehicleId), date
          ? sql`${s.gpsTrips.startedAt} >= (${date}::date::timestamp AT TIME ZONE ${timezone})
            AND ${s.gpsTrips.startedAt} < ((${date}::date + 1)::timestamp AT TIME ZONE ${timezone})` : undefined);
        if (path[3] === 'trip-stats') {
          const [stats] = await db().select({
            count: sql<number>`count(*)`.mapWith(Number),
            meters: sql<number>`coalesce(sum(${s.gpsTrips.distanceMeters}), 0)`.mapWith(Number),
            seconds: sql<number>`coalesce(sum(${s.gpsTrips.durationSeconds}), 0)`.mapWith(Number),
          }).from(s.gpsTrips).where(scope);
          return json(stats);
        }
        const page = z.coerce.number().int().min(0).max(10000).parse(query.get('page') ?? 0);
        return json(await db().select().from(s.gpsTrips).where(scope)
          .orderBy(desc(s.gpsTrips.startedAt), desc(s.gpsTrips.id)).limit(100).offset(page * 100));
      }
      if (path[3] === 'trips') {
        if (method === 'POST') {
          const value = z.object({
            id: z.string().uuid().optional(),
            syncMileage: z.boolean().default(false),
            expectedOdometer: z.number().int().min(0).max(99999999).optional(),
            distanceMeters: z.number().int().min(0).max(2000000),
            durationSeconds: z.number().int().min(1).max(604800),
            startedAt: z.string().datetime(),
            endedAt: z.string().datetime(),
          }).parse(await body(req));
          const startedAt = new Date(value.startedAt), endedAt = new Date(value.endedAt);
          if (endedAt < startedAt || Math.abs((endedAt.getTime() - startedAt.getTime()) / 1000 - value.durationSeconds) > 60 || value.distanceMeters / value.durationSeconds > 65)
            throw new svc.AppError(400, 'Durata sau distanța călătoriei este invalidă.');
          if(value.syncMileage && !value.id)throw new svc.AppError(400,'Identificatorul călătoriei este necesar pentru sincronizare.');
          if (endedAt.getTime() > Date.now()+60000) throw new svc.AppError(400, 'Data călătoriei nu poate fi în viitor.');
          const result=await db().transaction(async tx=>{
            // Serialize saves on this vehicle, then deduplicate retries before changing mileage.
            const vehicle=(await tx.select().from(s.vehicles).where(and(eq(s.vehicles.id,vehicleId),eq(s.vehicles.userId,uid))).for('update'))[0];
            if(!vehicle) throw new svc.AppError(404,'Mașina nu există.');
            if(value.id){const existing=(await tx.select().from(s.gpsTrips).where(eq(s.gpsTrips.id,value.id)))[0];if(existing){if(existing.userId!==uid || existing.vehicleId!==vehicleId)throw new svc.AppError(409,'Identificator de călătorie invalid.');return existing;}}
            if(value.syncMileage){
              if(value.expectedOdometer===undefined || value.expectedOdometer!==vehicle.odometer)throw new svc.AppError(409,'Kilometrajul a fost modificat între timp. Debifează sincronizarea pentru a salva separat călătoria și verifică bordul.');
              const previous=(await tx.select({meters:sql<string>`coalesce(sum(${s.gpsTrips.distanceMeters}),0)`}).from(s.gpsTrips).where(and(eq(s.gpsTrips.vehicleId,vehicleId),eq(s.gpsTrips.userId,uid),eq(s.gpsTrips.source,'browser-gps-synced'))))[0];
              const carry=Number(previous.meters)%1000;
              const odometer=vehicle.odometer+Math.floor((carry+value.distanceMeters)/1000);
              if(odometer>99999999)throw new svc.AppError(400,'Kilometraj invalid.');
              await tx.update(s.vehicles).set({odometer}).where(and(eq(s.vehicles.id,vehicleId),eq(s.vehicles.userId,uid)));
            }
            return (await tx.insert(s.gpsTrips).values({id:value.id??crypto.randomUUID(),userId:uid,vehicleId,distanceMeters:value.distanceMeters,durationSeconds:value.durationSeconds,startedAt,endedAt,source:value.syncMileage?'browser-gps-synced':'browser-gps'}).returning())[0];
          });
          return json(result,201);
        }
      }
    }
    if (path[0] === 'vehicles' && path[2] === 'photo') {
      const id = uuid.parse(path[1]);
      await svc.ownedVehicle(uid, id);
      if (method === 'POST') {
        if (Number(req.headers.get('content-length') || 0) > 2200000)
          throw new svc.AppError(413, 'Maximum 2 MB.');
        const photoForm = await form(req);
        const file = photoForm.get('file');
        if (!(file instanceof File) || file.size > 2097152)
          throw new svc.AppError(400, 'Fotografie invalidă (maximum 2 MB).');
        await svc.uploadVehiclePhoto(uid, id, Buffer.from(await file.arrayBuffer()));
        return json({ ok: true });
      }
      if (method === 'GET') {
        const photo = (
          await db()
            .select()
            .from(s.vehiclePhotos)
            .where(and(eq(s.vehiclePhotos.vehicleId, id), eq(s.vehiclePhotos.userId, uid)))
        )[0];
        if (!photo) throw new svc.AppError(404, 'Fotografie inexistentă.');
        return new Response(Buffer.from(photo.data, 'base64'), {
          headers: {
            'Content-Type': photo.mime,
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
    }
    if (path[0] === 'vehicles') {
      if (method === 'POST' && path.length === 1)
        return json(await svc.createVehicle(uid, await body(req)), 201);
      if (method === 'PATCH' && path.length === 2)
        return json(await svc.editVehicle(uid, uuid.parse(path[1]), await body(req)));
      if (method === 'DELETE' && path.length === 2) {
        await svc.archiveVehicle(uid, uuid.parse(path[1]));
        return json({ ok: true });
      }
    }
    if (path[0] === 'records') {
      if (method === 'POST' && path.length === 1)
        return json(await svc.saveRecord(uid, await body(req)), 201);
      if (method === 'PATCH' && path.length === 2)
        return json(await svc.saveRecord(uid, await body(req), uuid.parse(path[1])));
      if (method === 'DELETE' && path.length === 2) {
        await svc.archiveRecord(uid, uuid.parse(path[1]));
        return json({ ok: true });
      }
      if (method === 'GET' && path[2] === 'history') {
        await svc.ownedRecord(uid, uuid.parse(path[1]));
        return json(
          await db()
            .select()
            .from(s.recordHistory)
            .where(and(eq(s.recordHistory.userId, uid), eq(s.recordHistory.recordId, path[1])))
            .orderBy(desc(s.recordHistory.createdAt)),
        );
      }
    }
    if (route === 'profile' && method === 'PUT') {
      await svc.saveProfile(uid, await body(req));
      return json({ ok: true });
    }
    if (route === 'files' && method === 'POST') {
      if (Number(req.headers.get('content-length') || 0) > 2200000)
        throw new svc.AppError(413, 'Maximum 2 MB.');
      const f = await form(req);
      const file = f.get('file');
      if (!(file instanceof File)) throw new svc.AppError(400, 'Alege un fișier.');
      if (file.size > 2097152) throw new svc.AppError(413, 'Maximum 2 MB.');
      return json(
        await svc.uploadFile(uid, uuid.parse(f.get('recordId')), {
          name: file.name,
          bytes: Buffer.from(await file.arrayBuffer()),
        }),
        201,
      );
    }
    if (path[0] === 'files' && path.length === 2) {
      const file = await svc.getFile(uid, uuid.parse(path[1]));
      if (method === 'GET')
        return new Response(Buffer.from(file.data, 'base64'), {
          headers: {
            'Content-Type': file.mime,
            'Content-Disposition': `${new URL(req.url).searchParams.get('view') === '1' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      if (method === 'DELETE') {
        await db()
          .delete(s.files)
          .where(and(eq(s.files.userId, uid), eq(s.files.id, file.id)));
        return json({ ok: true });
      }
    }
    if (route === 'push/test' && method === 'POST') {
      await sendPushNotification(uid, {
        id: crypto.randomUUID(),
        title: 'AutoCare · Notificări activate',
        body: 'Notificările AutoCare funcționează pe acest dispozitiv. Drum bun!',
      });
      return json({ ok: true, status: 'accepted' });
    }
    if (route === 'push' && method === 'POST') {
      const p = z
        .object({
          endpoint: z
            .string()
            .url()
            .max(2000)
            .refine((x) => {
              const u = new URL(x);
              return (
                u.protocol === 'https:' &&
                !u.port &&
                [
                  'fcm.googleapis.com',
                  'updates.push.services.mozilla.com',
                  'web.push.apple.com',
                ].some((h) => u.hostname === h || u.hostname.endsWith('.' + h))
              );
            }),
          keys: z.object({
            p256dh: z
              .string()
              .regex(/^[\w-]+$/)
              .max(200),
            auth: z
              .string()
              .regex(/^[\w-]+$/)
              .max(100),
          }),
        })
        .parse(await body(req));
      await db()
        .insert(s.pushes)
        .values({ ...p, id: crypto.randomUUID(), userId: uid })
        .onConflictDoUpdate({ target: s.pushes.endpoint, set: { userId: uid, keys: p.keys } });
      return json({ ok: true });
    }
    if (route === 'push' && method === 'DELETE') {
      await db().delete(s.pushes).where(eq(s.pushes.userId, uid));
      return json({ ok: true });
    }
    if(path[0]==='records' && path.length===3 && path[2]==='complete' && method==='POST') return json(await svc.saveRecord(uid,await body(req),undefined,uuid.parse(path[1])),201);
    if(route==='mechanic-shares' && method==='GET')return json(await listMechanicShares(uid));
    if(route==='mechanic-shares' && method==='POST')return json(await createMechanicShare(uid,await body(req)),201);
    if(path[0]==='mechanic-shares' && path.length===2 && method==='DELETE')return json(await revokeMechanicShare(uid,uuid.parse(path[1])));
    if (route === 'export' && method === 'GET') {
      const data = await svc.dashboard(uid);
      const format = new URL(req.url).searchParams.get('format');
      if (format === 'json') {
        const support = await db().select().from(s.support).where(eq(s.support.userId, uid));
        const supportThreads = await db()
          .select()
          .from(s.supportThreads)
          .where(eq(s.supportThreads.userId, uid));
        const supportMessages = await db()
          .select({
            id: s.supportChatMessages.id,
            threadId: s.supportChatMessages.threadId,
            authorName: s.supportChatMessages.authorName,
            authorRole: s.supportChatMessages.authorRole,
            body: s.supportChatMessages.body,
            createdAt: s.supportChatMessages.createdAt,
          })
          .from(s.supportChatMessages)
          .innerJoin(s.supportThreads, eq(s.supportThreads.id, s.supportChatMessages.threadId))
          .where(eq(s.supportThreads.userId, uid));
        const history = await db()
          .select()
          .from(s.recordHistory)
          .where(eq(s.recordHistory.userId, uid));
        const attachments = await db().select().from(s.files).where(eq(s.files.userId, uid));
        const invoices = await db().select().from(s.invoices).where(eq(s.invoices.userId, uid));
        const photos = await db()
          .select()
          .from(s.vehiclePhotos)
          .where(eq(s.vehiclePhotos.userId, uid));
        const sessions = await db()
          .select({
            id: s.session.id,
            createdAt: s.session.createdAt,
            expiresAt: s.session.expiresAt,
            ipAddress: s.session.ipAddress,
            userAgent: s.session.userAgent,
          })
          .from(s.session)
          .where(eq(s.session.userId, uid));
        const aiHistory = await db().select().from(s.autoAiTurns).where(eq(s.autoAiTurns.userId, uid));
        const communicationPreferences = await mailCenter.getCommunicationPreference(uid);
        const emailHistory = await db().select({status:s.mailDeliveries.status,attemptedAt:s.mailDeliveries.attemptedAt,subject:s.mailCampaigns.subject,category:s.mailCampaigns.category}).from(s.mailDeliveries).innerJoin(s.mailCampaigns,eq(s.mailDeliveries.campaignId,s.mailCampaigns.id)).where(eq(s.mailDeliveries.userId,uid));
        const pushSubscriptions = await db()
          .select({ endpoint: s.pushes.endpoint })
          .from(s.pushes)
          .where(eq(s.pushes.userId, uid));
        return new Response(
          JSON.stringify(
            {
              user: { name: sess.user.name, email: sess.user.email },
              ...data,
              support,
              supportThreads,
              supportMessages,
              history,
              attachments,
              invoices,
              photos,
              sessions,
              communicationPreferences,
              aiHistory,
              emailHistory,
              pushSubscriptions,
            },
            null,
            2,
          ),
          {
            headers: {
              'Content-Type': 'application/json',
              'Content-Disposition': 'attachment; filename="autocare-date-personale.json"',
              'Cache-Control': 'no-store',
            },
          },
        );
      }
      if (!data.premium)
        throw new svc.AppError(
          403,
          'Exportul rapoartelor necesită Premium. Exportul datelor personale JSON este gratuit.',
        );
      const params = new URL(req.url).searchParams;
      const filters = z
        .object({
          kind: z.enum(['document', 'service', 'expense']).optional(),
          finance: z.literal('1').optional(),
          financeCategory: z.enum(financeGroups).optional(),
          journal: z.literal('1').optional(),
          vehicleId: z.string().uuid().optional(),
          category: z.string().max(250).optional(),
          status: z.enum(['valid', 'soon', 'expired', 'incomplete', 'archived']).optional(),
          archived: z.enum(['all', 'active', 'only']).optional(),
          q: z.string().max(250).optional(),
          from: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
          to: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/)
            .optional(),
        })
        .parse(
          Object.fromEntries(Array.from(params.entries()).filter(([key]) => key !== 'format')),
        );
      const today = localDate(new Date(), data.profile.timezone);
      const selection = filters.finance
        ? data.records.filter(row => isFinancialEntry(row, today) && (!filters.financeCategory || financeGroup(row) === filters.financeCategory))
        : filters.journal ? data.records.filter(row => !isPlannedService(row, today)) : data.records;
      const selected = filterRecords(selection, filters, new Date(), data.profile.timezone);
      const rows = selected.map(
        ({
          id,
          vehicleId,
          kind,
          category,
          title,
          date,
          expiresAt,
          odometer,
          amountBani,
          amountKnown,
        }) => ({
          id,
          vehicleId,
          kind,
          category,
          title,
          date,
          expiresAt,
          odometer,
          amountBani: amountKnown === false ? null : amountBani,
          amountKnown,
        }),
      );
      if (format === 'pdf') {
        const vehicleIds=new Set(selected.map(r=>r.vehicleId));
        const report=await vehicleReport({vehicles:data.vehicles.filter(v=>vehicleIds.has(v.id)),records:selected,generatedAt:new Date().toLocaleDateString('ro-RO',{timeZone:data.profile.timezone})});
        return new Response(report, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="autocare-raport.pdf"',
            'Cache-Control': 'no-store',
          },
        });
      }
      return new Response(svc.csv(rows), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="autocare-istoric.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }
    if (route === 'account' && method === 'DELETE') {
      const data = z
        .object({ password: z.string().min(1), confirm: z.literal('ȘTERGE') })
        .parse(await body(req));
      const sub = (
        await db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid))
      )[0];
      if (sub?.subscriptionId && ['active', 'past_due', 'trialing'].includes(sub.status))
        throw new svc.AppError(409, 'Anulează abonamentul înainte de ștergerea contului.');
      await auth().api.deleteUser({ headers: req.headers, body: { password: data.password } });
      return json({ ok: true });
    }
    if (route === 'billing/checkout' && method === 'POST')
      return json(
        await checkout(
          uid,
          z.object({ interval: z.enum(['monthly', 'quarterly', 'annual']) }).parse(await body(req)).interval,
        ),
      );
    if(route==='billing/sync' && method==='POST')return json(await syncPaidExtensions(uid,stripe()));
    if(route==='billing/extend' && method==='POST')return json(await checkout(uid,z.object({interval:z.enum(['monthly','quarterly','annual'])}).parse(await body(req)).interval,true));
    if (route === 'billing/portal' && method === 'POST') return json(await billingPortal(uid));
    if (path[0] === 'billing' && path[1] === 'invoices' && path.length === 3 && method === 'GET')
      return new Response(null, { status: 303, headers: { Location: (await billingInvoice(uid, path[2])).toString(), 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } });
    if (route === 'billing/invoices' && method === 'GET')
      return json(
        await db()
          .select()
          .from(s.invoices)
          .where(eq(s.invoices.userId, uid))
          .orderBy(desc(s.invoices.createdAt)),
      );
    if (route === 'support/statistics' && method === 'GET') return json(await supportChat.supportStatistics(uid));
    if (route === 'support/guide' && method === 'POST') {
      await rate(uid, 'support-guide-day', 5, 86400000);
      await rate('all', 'support-guide-global-day', 180, 86400000);
      return json(await supportChat.draftSupportReply(uid, await body(req), true));
    }
    if (route === 'support/draft' && method === 'POST') {
      if (!supportChat.isSupportStaff((await svc.profile(uid)).role)) throw new svc.AppError(403, 'Acces rezervat echipei.');
      await rate(uid, 'support-ai-day', 20, 86400000);
      await rate('all', 'ai-provider-day', 600, 86400000);
      return json(await supportChat.draftSupportReply(uid, await body(req)));
    }
    if (route === 'support/team' && method === 'GET')
      return json(await supportChat.supportTeam(uid));
    if (route === 'support/unread' && method === 'GET')
      return json(await supportChat.supportUnread(uid));
    if (path[0] === 'support' && path[1] === 'files' && path.length === 3 && method === 'GET') {
      const file = await supportChat.getSupportFile(uid, path[2]);
      return new Response(Buffer.from(file.data, 'base64'), {
        headers: {
          'Content-Type': file.mime,
          'Content-Disposition': `${new URL(req.url).searchParams.get('view') === '1' ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Robots-Tag': 'noindex',
        },
      });
    }
    if (path[0] === 'support' && path[1] === 'chat') {
      if (path.length === 4 && path[3] === 'context' && method === 'GET')
        return json(await supportChat.supportCustomerContext(uid, path[2]));
      if (path.length === 4 && path[3] === 'operations' && method === 'POST')
        return json(await supportChat.updateSupportOperations(uid, path[2], await body(req)));
      if (path.length === 4 && path[3] === 'typing' && method === 'POST')
        return json(await supportChat.setSupportTyping(uid, path[2], await body(req)));
      if (path.length === 4 && path[3] === 'rating' && method === 'POST')
        return json(await supportChat.rateSupportThread(uid, path[2], await body(req)));
      if (path.length === 4 && path[3] === 'assign' && method === 'POST')
        return json(await supportChat.assignSupportThread(uid, path[2], await body(req)));
      if (path.length === 4 && path[3] === 'read' && method === 'POST')
        return json(await supportChat.markSupportRead(uid, path[2], await body(req)));
      if (path.length === 4 && path[3] === 'files' && method === 'POST') {
        const data = await form(req);
        const file = data.get('file');
        if (!(file instanceof File) || file.size > 2097152)
          throw new svc.AppError(400, 'Atașament invalid. Maximum 2 MB.');
        return json(
          await supportChat.attachSupportFile(uid, path[2], {
            name: file.name,
            bytes: Buffer.from(await file.arrayBuffer()),
          }),
          201,
        );
      }

      if (path.length === 2 && method === 'GET')
        return json(
          await supportChat.listSupportThreads(
            uid,
            new URL(req.url).searchParams.get('status') || 'open',
            new URL(req.url).searchParams.get('q') || '',
          ),
        );
      if (path.length === 2 && method === 'POST') {
        const result = await supportChat.sendSupportMessage(uid, await body(req));
        // Push is best-effort: never fail or duplicate a saved message because delivery failed.
        try {
          const messageResult = result as { threadId: string; message: { id: string } };
          const thread = (await db().select({
            userId: s.supportThreads.userId,
            assignedTo: s.supportThreads.assignedTo,
          }).from(s.supportThreads).where(eq(s.supportThreads.id, messageResult.threadId)))[0];
          if (thread) {
            const recipients = thread.userId === uid
              ? thread.assignedTo
                ? [thread.assignedTo]
                : (await db().select({ userId: s.profiles.userId, role: s.profiles.role }).from(s.profiles))
                    .filter((p) => supportChat.isSupportStaff(p.role)).map((p) => p.userId)
              : [thread.userId];
            const recipientIds = [...new Set(recipients)].filter((id) => id !== uid);
            const title = thread.userId === uid ? 'AutoCare · Mesaj nou pentru suport' : 'AutoCare · Răspuns de la suport';
            const bodyText = thread.userId === uid
              ? 'A sosit un mesaj nou în Centrul de suport.'
              : 'Echipa AutoCare ți-a răspuns în Centrul de suport.';
            const users = recipientIds.length
              ? await db().select({
                  id: s.user.id, name: s.user.name, email: s.user.email, verified: s.user.emailVerified,
                  emailEnabled: s.profiles.emailEnabled, pushEnabled: s.profiles.pushEnabled,
                }).from(s.user).innerJoin(s.profiles, eq(s.user.id, s.profiles.userId))
                  .where(sql`${s.user.id} IN (${sql.join(recipientIds.map((id) => sql`${id}`), sql`, `)})`)
              : [];
            await Promise.allSettled(users.flatMap((user) => {
              const tasks: Promise<unknown>[] = [];
              if (user.pushEnabled) tasks.push(sendPushNotification(user.id, {
                id: 'support-' + messageResult.message.id, title, body: bodyText,
              }));
              if (user.emailEnabled && user.verified) tasks.push(sendMail(
                user.email, title,
                bodyText + '\n\nDeschide AutoCare: ' + origin() + '/cont?tab=Centru%20de%20suport\n\nPoți dezactiva notificările e-mail din Setări.',
                'support/' + messageResult.message.id + '/' + user.id,
                renderEmail('administrative', {name:user.name,subject:title,message:bodyText,ctaLabel:'Vezi mesajul de suport',ctaPath:'/cont?tab=Centru%20de%20suport'}),
              ));
              return tasks;
            }));
          }
        } catch { /* A push failure must not affect a successfully saved message. */ }
        return json(result, 201);
      }
      if (path.length === 3 && method === 'GET')
        return json(
          await supportChat.readSupportThread(
            uid,
            path[2],
            new URL(req.url).searchParams.get('cursor') || undefined,
          ),
        );
      if (path.length === 3 && method === 'PATCH')
        return json(await supportChat.changeSupportThread(uid, path[2], await body(req)));
      if (path.length === 4 && path[3] === 'join' && method === 'POST')
        return json(await supportChat.joinSupportThread(uid, path[2]));
    }
    if (route === 'support' && method === 'POST') {
      const input = z
        .object({ message: z.string().trim().min(10).max(4000) })
        .parse(await body(req));
      await db().transaction(async (tx) => {
        const id = crypto.randomUUID();
        await tx.insert(s.support).values({ id, userId: uid, ...input });
        await tx
          .insert(s.supportThreads)
          .values({ id, userId: uid, title: input.message.slice(0, 80) });
        await tx.insert(s.supportChatMessages).values({
          id: 'legacy-' + id,
          threadId: id,
          authorId: uid,
          authorName: sess.user.name,
          authorRole: 'user',
          body: input.message,
        });
      });
      return json({ ok: true });
    }
    if (path[0] === 'admin') {
      const p = await svc.profile(uid);
      if (!['admin', 'founder'].includes(p.role)) throw new svc.AppError(403, 'Acces interzis.');
      if (method === 'GET') {
        const [users, subscriptions, jobs, failed, messages, audit, totals, active, revenues] =
          await Promise.all([
            db()
              .select({
                id: s.user.id,
                name: s.user.name,
                email: s.user.email,
                createdAt: s.user.createdAt,
              })
              .from(s.user)
              .limit(200),
            db().select().from(s.subscriptions).limit(200),
            db().select().from(s.jobRuns).orderBy(desc(s.jobRuns.startedAt)).limit(30),
            db()
              .select({
                id: s.notifications.id,
                status: s.notifications.status,
                error: s.notifications.error,
                attempts: s.notifications.attempts,
                createdAt: s.notifications.createdAt,
              })
              .from(s.notifications)
              .where(eq(s.notifications.status, 'failed'))
              .limit(100),
            db().select().from(s.support).orderBy(desc(s.support.createdAt)).limit(100),
            db().select().from(s.audit).orderBy(desc(s.audit.createdAt)).limit(50),
            db()
              .select({ users: sql<number>`count(*)::int` })
              .from(s.user),
            db()
              .select({ active: sql<number>`count(distinct ${s.session.userId})::int` })
              .from(s.session)
              .where(
                sql`${s.session.expiresAt}>now() AND ${s.session.updatedAt}>now()-interval '30 days'`,
              ),
            db()
              .select({
                currency: s.invoices.currency,
                total: sql<number>`sum(${s.invoices.amountBani})::int`,
              })
              .from(s.invoices)
              .where(and(eq(s.invoices.status, 'paid'), eq(s.invoices.livemode, true)))
              .groupBy(s.invoices.currency),
          ]);
        return json({
          users,
          subscriptions,
          jobs,
          failed,
          messages,
          audit,
          totals: totals[0],
          active: active[0],
          revenues,
          limits: await svc.limits(),
        });
      }
      if (route === 'admin/limits' && method === 'PUT') {
        await founder.requireFounder(uid);
        const value = z
          .object({
            premiumCars: z.number().int().min(2).max(50),
            maxFiles: z.number().int().min(2).max(100),
          })
          .parse(await body(req));
        await db().transaction(async (tx) => {
          await tx
            .insert(s.settings)
            .values({ key: 'limits', value })
            .onConflictDoUpdate({ target: s.settings.key, set: { value } });
          await tx.insert(s.audit).values({
            id: crypto.randomUUID(),
            actorId: uid,
            action: 'limits.updated',
            target: 'plans',
          });
        });
        return json({ ok: true });
      }
      if (path[1] === 'support' && method === 'PATCH') {
        const id = uuid.parse(path[2]);
        await db().transaction(async (tx) => {
          await tx.update(s.support).set({ status: 'closed' }).where(eq(s.support.id, id));
          await tx
            .update(s.supportThreads)
            .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(s.supportThreads.id, id), eq(s.supportThreads.status, 'open')));
          await tx.insert(s.audit).values({
            id: crypto.randomUUID(),
            actorId: uid,
            action: 'support.closed',
            target: id,
          });
        });
        return json({ ok: true });
      }
    }
    return json({ error: 'Ruta nu există.' }, 404);
  } catch (e) {
    if (e instanceof ZodError)
      return json(
        { error: e.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') },
        400,
      );
    if (e instanceof svc.AppError) return json({ error: e.message }, e.status);
    if (e instanceof Error && e.name.startsWith('Stripe')) {
      const stripeError = e as Error & { code?: string; statusCode?: number; type?: string };
      const trace = crypto.randomUUID();
      console.error(JSON.stringify({
        event: 'stripe_api_error', trace, type: stripeError.name,
        code: stripeError.code || null, statusCode: stripeError.statusCode || null,
      }));
      const message = stripeError.code === 'resource_missing'
        ? 'Prețul Stripe configurat nu există în contul LIVE. Verifică ID-urile price_ din Vercel.'
        : stripeError.code === 'api_key_expired' || stripeError.code === 'invalid_api_key'
          ? 'Cheia Stripe LIVE este invalidă sau expirată.'
          : stripeError.statusCode === 403
            ? 'Cheia Stripe nu are permisiunile necesare pentru Checkout.'
            : 'Stripe nu a putut iniția plata. Verifică înregistrarea erorii în Vercel.';
      return json({ error: message, trace }, stripeError.statusCode === 401 || stripeError.statusCode === 403 ? 503 : 502);
    }
    if (e instanceof SyntaxError) return json({ error: 'Cerere invalidă.' }, 400);
    const trace = crypto.randomUUID();
    console.error(
      JSON.stringify({
        event: 'api_error', trace, type: e instanceof Error ? e.name : 'unknown',
        message: e instanceof Error
          ? e.message.replace(/(?:sk|rk|whsec)_(?:live|test)?_[A-Za-z0-9]+/g, '[redacted]')
              .replace(/:\/\/[^\s]+/g, '[redacted-url]').slice(0, 400)
          : 'unknown',
        route: new URL(req.url).pathname.endsWith('/billing/checkout') ? 'billing/checkout' : 'other',
      }),
    );
    return json(
      { error: 'Operațiunea nu a reușit. Verifică configurarea serviciilor.', trace },
      500,
    );
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const PUT = handle;
export const DELETE = handle;
