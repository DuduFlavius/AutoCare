import { recipientAllowed } from '@/lib/mail-policy';
import { effectiveRole } from '@/lib/permissions';
import { vehicleCatalog } from '@/lib/vehicle-catalog';
import { documentSheet, documentSheetName } from '@/lib/document-sheet';
import { updateSupportPresence, supportAvailabilitySettings } from '@/lib/support-availability';
import { loadSpeedRoads } from '@/lib/road-speed-server';
import {mileageOrder,mileageSeries} from '@/lib/mileage-history';
import {mileageReport} from '@/lib/mileage-report';
import {date as verifiedDate} from '@/lib/validation';
import {validTripTiming} from '@/lib/drive-session';
import {loadDrivingRoutes,loadRoadDestinations,roadCoordinate} from '@/lib/road-navigation-server';
import * as feedback from '@/lib/feedback';
import {documentDownloadName,documentDisposition} from '@/lib/document-presentation';
import {accountPreferences,accountPreferencesKey,accountPreferencesSchema} from '@/lib/account-preferences';
import {playBillingConfigured,playProducts,playAccountId,verifyPlayPurchase} from '@/lib/play-billing';
import {nativePushConfigured} from '@/lib/native-push';
import {dailyMileageProjection} from '@/lib/daily-mileage-projection';
import {languageCookie} from '@/lib/language-preference';
import {after} from 'next/server';
import {dispatchMailSafely} from '@/lib/mail-dispatch';
import {languagePreferenceKey, userLanguage} from '@/lib/user-language';
import { financeGroup, financeGroups, isFinancialEntry } from '@/lib/finance-overview';
import { isPlannedService } from '@/lib/planned-service';
import { localDate } from '@/lib/config';
import { aiModes, askAutoAssistant, autoAssistantHistory, clearAutoAssistantHistory, feedbackAutoAssistant, reportAutoAssistant, renameAiConversation, scanAutoDocument } from '@/lib/auto-assistant';
import { autoPointCategories } from '@/lib/auto-points';
import { loadAutoPoints } from '@/lib/auto-points-server';
import {automaticTripBatch} from '@/lib/automatic-trips';
import { revalidatePath, revalidateTag } from 'next/cache';
import { filterRecords } from '@/lib/record-filters';
import * as founder from '@/lib/founder';
import { pricing, publicPricing, savings } from '@/lib/pricing';
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
import {isGoogleMailProductionRequest} from '@/lib/google-mail-origin';
import * as mailCenter from '@/lib/mail-center';
import { renderEmail } from '@/lib/email-templates';
import {resolveBillingPrice} from '@/lib/stripe-catalog';
import { stripe, checkout, billingPortal, billingInvoice, processStripeEvent } from '@/lib/billing';
import {createMechanicShare,listMechanicShares,revokeMechanicShare} from '@/lib/mechanic-shares';
import {syncPaidExtensions} from '@/lib/subscription-extensions';
import {vehicleReport} from '@/lib/vehicle-report';
import {reportKinds} from '@/lib/report-analysis';
import {latestExchangeRate} from '@/lib/exchange-rate-server';
import {accountDisplayCurrency} from '@/lib/display-currency';
import {currencyPreference,currencyPreferenceKey} from '@/lib/exchange-rate';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
async function readCurrencyPreference(uid: string) {
  const [saved] = await db().select({value:s.settings.value}).from(s.settings).where(eq(s.settings.key,currencyPreferenceKey(uid)));
  return currencyPreference(saved?.value);
}

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
    if(route==='jobs/mail'&&method==='GET'){
      if(!secret(req))return json({error:'Neautorizat'},401);
      return json(await dispatchMailSafely());
    }
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
      const p = await publicPricing();
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
    const expectedAccount = req.headers.get('x-autocare-account');
    if (expectedAccount && expectedAccount !== uid) return json({ error: 'SESSION_CHANGED' }, 409);
    if (path[0] === 'support') {
      const background = method === 'GET' || ['read', 'typing', 'presence'].includes(path.at(-1) ?? '');
      await rate(uid, background ? 'support-background' : 'support-write', background ? 160 : 40);
    } else await rate(uid);
    if(path[0]==='feedback'){
      const params=new URL(req.url).searchParams;
      const publish=(result:{noticeIds:string[]})=>{if(result.noticeIds.length)after(()=>feedback.deliverFeedbackNotices(result.noticeIds).catch(()=>console.error(JSON.stringify({event:'feedback_notification_failed'}))));};
      if(route==='feedback'&&method==='GET')return json(await feedback.listFeedback(uid,params));
      if(route==='feedback'&&method==='POST'){
        let payload:unknown;const files:feedback.ScreenshotUpload[]=[];
        if(req.headers.get('content-type')?.startsWith('multipart/form-data')){
          const bytes=await bounded(req,4300000);
          const data=await new Response(bytes,{headers:{'Content-Type':req.headers.get('content-type')!}}).formData();
          payload=JSON.parse(String(data.get('payload')||'null'));
          const screenshots=data.getAll('screenshots');
          if(screenshots.length>2)throw new svc.AppError(400,'FEEDBACK_FILE_COUNT');
          for(const file of screenshots){if(!(file instanceof File)||file.size>2097152)throw new svc.AppError(413,'FEEDBACK_FILE_SIZE');files.push({bytes:Buffer.from(await file.arrayBuffer())});}
        }else payload=await body(req);
        const result=await feedback.createFeedback(uid,payload,files);
        publish(result);
        if(!result.duplicate&&process.env.AUTOCARE_MAIL_AUTOMATIONS_ENABLED==='true')after(async()=>{await dispatchMailSafely();});
        return json(result,result.duplicate?200:201);
      }
      if(route==='feedback/statistics'&&method==='GET')return json(await feedback.feedbackStatistics(uid));
      if(route==='feedback/notices'&&method==='GET')return json(await feedback.feedbackNotices(uid));
      if(route==='feedback/invitation'&&method==='GET')return json(await feedback.feedbackInvitation(uid));
      if(route==='feedback/invitation'&&method==='POST'){const input=z.object({action:z.enum(['shown','dismiss'])}).strict().parse(await body(req));return json(await feedback.feedbackInvitation(uid,input.action));}
      if(path[1]==='files'&&path.length===3&&method==='GET'){
        const file=await feedback.feedbackFile(uid,path[2]);
        return new Response(Buffer.from(file.data,'base64'),{headers:{'Content-Type':file.mime,'Content-Disposition':`inline; filename="${file.name}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Content-Security-Policy':"default-src 'none'; sandbox"}});
      }
      if(path.length===2&&method==='GET')return json(await feedback.readFeedback(uid,path[1]));
      if(path.length===2&&method==='PATCH'){const result=await feedback.updateFeedback(uid,path[1],await body(req));publish(result);return json(result);}
      if(path.length===3&&path[2]==='read'&&method==='POST')return json(await feedback.markFeedbackRead(uid,path[1]));
      if(path.length===3&&path[2]==='replies'&&method==='POST'){const result=await feedback.replyFeedback(uid,path[1],await body(req));publish(result);return json(result,201);}
      return json({error:'Ruta nu există.'},404);
    }
    if (route === 'preferences/currency' && (method === 'GET' || method === 'PUT')) {
      const key = currencyPreferenceKey(uid);
      if (method === 'GET') return json({currency:await readCurrencyPreference(uid)});
      const {currency} = z.object({currency:z.enum(['RON','EUR','auto'])}).strict().parse(await body(req));
      await db().insert(s.settings).values({key,value:currency}).onConflictDoUpdate({target:s.settings.key,set:{value:currency}});
      return json({currency});
    }
    if (route === 'preferences/language') {
      if (method === 'GET') return json({language:await userLanguage(uid)});
      if (method === 'PUT') {
        const value=z.object({language:z.enum(['ro','en'])}).strict().parse(await body(req));
        await db().insert(s.settings).values({key:languagePreferenceKey(uid),value}).onConflictDoUpdate({target:s.settings.key,set:{value}});
        return json(value);
      }
    }

    if (path[0] === 'auto-assistant') {
      if (route === 'auto-assistant/report' && method === 'POST') {
        await rate(uid, 'auto-assistant-report', 20);
        const { vehicleId, turnId } = z.object({ vehicleId: uuid, turnId: uuid }).strict().parse(await body(req));
        const result = await reportAutoAssistant(uid, vehicleId, turnId);
        if (result.noticeIds.length) after(() => feedback.deliverFeedbackNotices(result.noticeIds).catch(() => {
          console.error(JSON.stringify({ event:'ai_report_notification_failed' }));
        }));
        return json({ id:result.id }, result.duplicate ? 200 : 201);
      }
      if (!await svc.premium(uid)) throw new svc.AppError(403, 'Asistentul AI este disponibil în Premium.');
      const historyId = z.union([uuid, z.string().regex(/^legacy:\d{4}-\d{2}-\d{2}$/)]);
      if (route === 'auto-assistant/history' && method === 'PATCH') {
        await rate(uid,'auto-assistant-history-title',30);
        const { vehicleId, conversationId, title } = z.object({vehicleId:uuid,conversationId:historyId, title:z.string().trim().min(1).max(72)}).parse(await body(req));
        return json(await renameAiConversation(uid, vehicleId, conversationId, title));
      }
      if (route === 'auto-assistant/history' && method === 'DELETE') {
        const selection = z.union([
          z.object({ vehicleId: uuid, conversationId: historyId }).strict(),
          z.object({ vehicleId: uuid, turnIds: z.array(uuid).min(1).max(150).optional() }).strict(),
        ]).parse(await body(req));
        return json(await clearAutoAssistantHistory(uid, selection.vehicleId, 'conversationId' in selection ? selection.conversationId : selection.turnIds));
      }
      if (route === 'auto-assistant/feedback' && method === 'POST') {
        await rate(uid, 'auto-assistant-feedback', 60);
        const input = z.object({ vehicleId: uuid, turnId: uuid, feedback: z.union([z.literal(1), z.literal(-1), z.null()]) }).parse(await body(req));
        return json(await feedbackAutoAssistant(uid, input.vehicleId, input.turnId, input.feedback));
      }
      if (route === 'auto-assistant/history' && method === 'GET')
        return json(await autoAssistantHistory(uid, uuid.parse(new URL(req.url).searchParams.get('vehicleId'))));
      if (route === 'auto-assistant' && method === 'POST') {
        const { vehicleId, question, language, mode, localFallback, contextTurns, conversationId, excludeTurnId, contextIds, requestId } = z.object({
          vehicleId: uuid,
          question: z.string().trim().min(1).max(600),
          language: z.enum(['ro', 'en']).default('ro'),
          mode: z.enum(aiModes).default('chat'),
          localFallback: z.boolean().default(false),
          contextTurns: z.number().int().min(0).max(4).optional(),
          conversationId: uuid.optional(),
          excludeTurnId: uuid.optional(),
          contextIds: z.array(uuid).max(4).optional(),
          requestId: uuid.optional(),
        }).parse(await body(req));
        // Guard bursts and reserve provider capacity before opening streamed generation.
        await rate(uid, 'auto-assistant-minute-v3', 12);
        if (requestId && req.headers.get('Accept') === 'application/x-ndjson') {
          const controller = new AbortController();
          const signal = AbortSignal.any([req.signal, controller.signal]);
          const encoder = new TextEncoder();
          const stream = new ReadableStream<Uint8Array>({
            start(output) {
              void (async () => {
                const send = (payload: object) => {
                  if (!signal.aborted) output.enqueue(encoder.encode(JSON.stringify(payload) + '\n'));
                };
                try {
                  const result = await askAutoAssistant(uid, vehicleId, question, language, mode, false, contextTurns, conversationId, excludeTurnId, contextIds, {
                    requestId, signal, delta: text => send({ type: 'delta', text }),
                    beforeGenerate: async () => {
                      await rate(uid, 'auto-assistant-success-day-v3', 120, 86400000);
                      await rate('all', 'ai-provider-success-day-v3', 3000, 86400000);
                    },
                  });
                  send({ type: 'done', turn: result.turn });
                } catch (error) {
                  send({ type: 'error', message: error instanceof svc.AppError ? error.message : 'Răspunsul AI a fost întrerupt. Poți reîncerca.' });
                } finally {
                  if (!controller.signal.aborted) output.close();
                }
              })();
            },
            cancel() { controller.abort(); },
          });
          return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'private, no-store, no-transform', 'X-Robots-Tag': 'noindex, nofollow', 'X-Accel-Buffering': 'no' } });
        }
        const answer = await askAutoAssistant(uid, vehicleId, question, language, mode, localFallback, contextTurns, conversationId, excludeTurnId, contextIds);
        await rate(uid, 'auto-assistant-success-day-v3', 120, 86400000);
        await rate('all', 'ai-provider-success-day-v3', 3000, 86400000);
        return json(answer);
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
    if(route==='smartdrive/destinations'&&method==='POST'){
      await rate(uid,'drive-search',12);
      const input=roadCoordinate.extend({query:z.string().trim().min(3).max(160)}).parse(await body(req));
      return json(await loadRoadDestinations(input.query,input.latitude,input.longitude,req.signal));
    }
    if (route === 'smartdrive/speed-roads' && method === 'POST') {
      await rate(uid, 'drive-speed-roads', 24);
      const input = roadCoordinate.parse(await body(req));
      try {
        return json(await loadSpeedRoads({ latitude: Number(input.latitude.toFixed(4)), longitude: Number(input.longitude.toFixed(4)) }, req.signal));
      } catch {
        throw new svc.AppError(503, 'Limitele de viteză sunt temporar indisponibile.');
      }
    }
    if(route==='smartdrive/directions'&&method==='POST'){
      await rate(uid,'drive-route',8);
      const input=z.object({start:roadCoordinate,end:roadCoordinate,accuracy:z.number().min(0).max(500).default(0)}).parse(await body(req));
      return json(await loadDrivingRoutes(input.start,input.end,input.accuracy,req.signal));
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
      if (!isGoogleMailProductionRequest(req,googleMail.googleMailCallback(),process.env.RENDER==='true'))
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
      if (route === 'founder/mail/audience' && method === 'POST') return json(await mailCenter.countSegment(uid,await body(req)));
      if (route === 'founder/mail/preview' && method === 'POST') return json(await mailCenter.previewMail(uid, await body(req)));
      if (route === 'founder/mail/campaigns' && method === 'POST') return json(await mailCenter.saveCampaign(uid, await body(req)));
      if (path[1] === 'mail' && path[2] === 'campaigns' && path[3]) {
        if (path.length === 4 && method === 'GET') return json(await mailCenter.campaignDetail(uid, path[3]));
        if (path.length === 5 && path[4] === 'schedule' && method === 'POST') return json(await mailCenter.scheduleCampaign(uid,path[3],await body(req)));
        if (path.length === 5 && path[4] === 'cancel' && method === 'POST') return json(await mailCenter.cancelCampaign(uid,path[3]));
        if (path.length === 5 && path[4] === 'retry-failed' && method === 'POST') return json(await mailCenter.retryFailedCampaign(uid, path[3]));
        if (path.length === 5 && path[4] === 'publish-release' && method === 'POST') {
          return json(await mailCenter.publishReleaseNews(uid,path[3],await body(req)));
        }
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
      if(route==='founder/billing-catalog' && method==='GET') {
        const configured=await pricing(),client=stripe();
        const rows=await Promise.all((['ron','eur'] as const).flatMap(currency=>(['monthly','quarterly','annual'] as const).map(async interval=>{try {const result=await resolveBillingPrice(client,configured,interval,currency);return {interval,currency,priceId:result.price.id,amount:result.amount,livemode:result.price.livemode,ready:true};}catch(error){return {interval,currency,ready:false,error:(error as Error).message};}})));
        return json({rows});
      }
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
      const car = (await db().select({ id: s.vehicles.id, odometer:s.vehicles.odometer }).from(s.vehicles).where(and(eq(s.vehicles.id, vehicleId), eq(s.vehicles.userId, uid))))[0];
      if (!car) throw new svc.AppError(404, 'Mașină inexistentă.');
      const key = `daily-usage:${uid}:${vehicleId}`;
      if (method === 'POST') {
        const input = z.object({ dailyKm: z.number().min(1).max(2000).nullable() }).parse(await body(req));
        const previous=(await db().select().from(s.settings).where(eq(s.settings.key,key)))[0]?.value as {dailyKm?:number|null;anchorDay?:string}|undefined;
        const value={...input,anchorDay:previous?.dailyKm===input.dailyKm&&previous.anchorDay?previous.anchorDay:localDate(new Date(),(await svc.profile(uid)).timezone)};
        await db().insert(s.settings).values({ key, value }).onConflictDoUpdate({ target: s.settings.key, set: { value } });
        return json(value);
      }
      const row = (await db().select().from(s.settings).where(eq(s.settings.key, key)))[0];
      const value=(row?.value ?? { dailyKm:null }) as {dailyKm:number|null;anchorDay?:string};
      const timezone=(await svc.profile(uid)).timezone,today=localDate(new Date(),timezone);
      const latest=(await db().select().from(s.mileageReadings).where(and(eq(s.mileageReadings.userId,uid),eq(s.mileageReadings.vehicleId,vehicleId))).orderBy(desc(s.mileageReadings.recordedAt)).limit(1))[0];
      const anchor=[value.anchorDay||today,latest?localDate(latest.recordedAt,timezone):''].sort().at(-1)!;
      return json({...value,projection:dailyMileageProjection(car.odometer,value.dailyKm,anchor,today)});
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

    if (route==='reports/distances' && method==='GET') {
      if (!await svc.premium(uid)) throw new svc.AppError(403,'Premium necesar.');
      const params = z.object({vehicleId:z.string().uuid().optional(),from:verifiedDate.optional(),to:verifiedDate.optional()})
        .parse(Object.fromEntries(new URL(req.url).searchParams));
      if(params.from&&params.to&&params.from>params.to)throw new svc.AppError(400,'Interval invalid.');
      const [cars, profile] = await Promise.all([
        db().select({id:s.vehicles.id}).from(s.vehicles).where(and(eq(s.vehicles.userId,uid),eq(s.vehicles.archived,false),
          params.vehicleId?eq(s.vehicles.id,params.vehicleId):undefined)),svc.profile(uid),
      ]);
      const ids=cars.map(car=>car.id);
      if(!ids.length)return json({});
      const readings=await db().select().from(s.mileageReadings)
        .where(and(eq(s.mileageReadings.userId,uid),inArray(s.mileageReadings.vehicleId,ids)));
      const today=localDate(new Date(),profile.timezone);
      const end=params.to&&params.to<today?params.to:today;
      const results=ids.flatMap(id=>{
        const distance=mileageSeries(readings.filter(row=>row.vehicleId===id),profile.timezone,params.from,end).distance;
        return distance==null?[]:[[id,distance] as const];
      });
      return json(Object.fromEntries(results));
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
      const ownedCar=await svc.ownedVehicle(uid, vehicleId);
      if (path[3] === 'readings') {
        const scope=and(eq(s.mileageReadings.userId,uid),eq(s.mileageReadings.vehicleId,vehicleId));
        if (method === 'GET') {
          const params=new URL(req.url).searchParams;
          const query=z.object({from:verifiedDate.optional(),to:verifiedDate.optional(),language:z.enum(['ro','en']).optional()}).parse(Object.fromEntries(params));
          if(query.from&&query.to&&query.from>query.to)throw new svc.AppError(400,'Interval invalid.');
          const entries=await db().select().from(s.mileageReadings).where(scope);
          if(params.get('format')==='pdf'){
            const timezone=(await svc.profile(uid)).timezone;
            const report=await mileageReport(ownedCar,mileageSeries(entries,timezone,query.from,query.to),timezone,query.from,query.to,(query.language??languageCookie(req.headers.get('cookie'))??await userLanguage(uid))==='en');
            return new Response(report,{headers:{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="autocare-kilometraj.pdf"','Cache-Control':'private, no-store'}});
          }
          if(params.get('history')==='full'){
            const corrections=await db().select({readingId:s.mileageReadingCorrections.readingId}).from(s.mileageReadingCorrections)
              .innerJoin(s.mileageReadings,eq(s.mileageReadingCorrections.readingId,s.mileageReadings.id)).where(scope);
            const corrected=new Set(corrections.map(row=>row.readingId));
            return json(entries.sort((a,b)=>mileageOrder(b,a)).map(row=>({...row,corrected:corrected.has(row.id)})));
          }
          return json(entries.sort((a,b)=>mileageOrder(b,a)).slice(0,200));
        }
        if(method==='PATCH'){
          const value=z.object({id:uuid,odometer:z.number().int().min(0).max(99999999),previous:z.number().int(),reason:z.string().trim().min(3).max(500)}).parse(await body(req));
          await db().transaction(async tx=>{
            const [car]=await tx.select().from(s.vehicles).where(and(eq(s.vehicles.id,vehicleId),eq(s.vehicles.userId,uid))).for('update');
            if(!car||car.archived)throw new svc.AppError(404,'Vehiculul activ nu este disponibil.');
            const readings=(await tx.select().from(s.mileageReadings).where(scope)).sort(mileageOrder);
            const index=readings.findIndex(row=>row.id===value.id),reading=readings[index];
            if(!reading||reading.source!=='manual')throw new svc.AppError(400,'Se pot corecta doar citirile manuale.');
            if(reading.odometer!==value.previous)throw new svc.AppError(409,'Citirea a fost modificată. Reîncarcă istoricul.');
            const before=readings[index-1],after=readings[index+1];
            if(value.odometer<(before?.odometer??0)||value.odometer>(after?.odometer??99999999))
              throw new svc.AppError(400,'Valoarea trebuie să se încadreze între citirile vecine.');
            if(!after&&car.odometer!==reading.odometer)throw new svc.AppError(409,'Kilometrajul actual diferă de ultima citire.');
            if(value.odometer===reading.odometer)return;
            await tx.insert(s.mileageReadingCorrections).values({id:crypto.randomUUID(),readingId:reading.id,previousOdometer:reading.odometer,correctedOdometer:value.odometer,reason:value.reason});
            await tx.update(s.mileageReadings).set({odometer:value.odometer}).where(and(scope,eq(s.mileageReadings.id,reading.id)));
            if(!after)await tx.update(s.vehicles).set({odometer:value.odometer}).where(and(eq(s.vehicles.id,vehicleId),eq(s.vehicles.userId,uid)));
          });
          return json({ok:true});
        }
        if (method === 'POST') {
          const value = z.object({ odometer: z.number().int().min(0).max(99999999), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), notes:z.string().trim().max(500).optional() }).parse(await body(req));
          const timezone=(await svc.profile(uid)).timezone;
          const today=localDate(new Date(),timezone);
          if(value.date && (!Number.isFinite(Date.parse(value.date+'T12:00:00Z')) || new Date(value.date+'T12:00:00Z').toISOString().slice(0,10)!==value.date || value.date>today))throw new svc.AppError(400,'Alege o dată validă, cel mult ziua de azi.');
          const result = await db().transaction(async tx => {
            const current = (await tx.select().from(s.vehicles).where(and(eq(s.vehicles.id, vehicleId), eq(s.vehicles.userId, uid))).for('update'))[0];
            if (!current) throw new svc.AppError(404, 'Mașina nu există.');
            if (value.odometer < current.odometer) throw new svc.AppError(400, 'Kilometrajul nu poate fi mai mic decât citirea confirmată.');
            const previous=(await tx.select().from(s.mileageReadings).where(and(eq(s.mileageReadings.userId,uid),eq(s.mileageReadings.vehicleId,vehicleId))).orderBy(desc(s.mileageReadings.recordedAt)).limit(1))[0];
            if(value.date && previous && value.date<localDate(previous.recordedAt,timezone))throw new svc.AppError(400,'Data nu poate preceda ultima citire validată.');
            if(previous && previous.odometer===value.odometer && localDate(previous.recordedAt,timezone)===(value.date||today))return {vehicle:current,reading:previous};
            const updated = (await tx.update(s.vehicles).set({ odometer: value.odometer }).where(and(eq(s.vehicles.id, vehicleId), eq(s.vehicles.userId, uid))).returning())[0];
            const recordedAt=value.date&&value.date!==today
              ? new Date(Math.max(Date.parse(value.date+'T12:00:00Z'),previous&&localDate(previous.recordedAt,timezone)===value.date?previous.recordedAt.getTime()+1:0))
              : new Date();
            const reading = (await tx.insert(s.mileageReadings).values({ id: crypto.randomUUID(), userId: uid, vehicleId, odometer: value.odometer, source: 'manual',notes:value.notes||null,recordedAt }).returning())[0];
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
            await tx.insert(s.mileageReadings).values({id:crypto.randomUUID(),userId:uid,vehicleId,odometer,source:'gps'});
          }
          await tx.insert(s.gpsTrips).values(fresh.map(t=>({id:t.id,distanceMeters:t.distanceMeters,durationSeconds:t.durationSeconds,userId:uid,vehicleId,startedAt:new Date(t.startedAt),endedAt:new Date(t.endedAt),source:input.syncMileage?'browser-gps-synced':'browser-gps'})));
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
            pausedSeconds:z.number().int().min(0).max(604800).default(0),
            startedAt: z.string().datetime(),
            endedAt: z.string().datetime(),
          }).parse(await body(req));
          const startedAt = new Date(value.startedAt), endedAt = new Date(value.endedAt);
          if (!validTripTiming(startedAt.getTime(),endedAt.getTime(),value.durationSeconds,value.pausedSeconds) || value.distanceMeters / value.durationSeconds > 65)
            throw new svc.AppError(400, 'Durata sau distanța călătoriei este invalidă.');
          if(value.syncMileage && !value.id)throw new svc.AppError(400,'Identificatorul călătoriei este necesar pentru sincronizare.');
          if (endedAt.getTime() > Date.now()+60000) throw new svc.AppError(400, 'Data călătoriei nu poate fi în viitor.');
          const result=await db().transaction(async tx=>{
            // Serialize saves on this vehicle, then deduplicate retries before changing mileage.
            const vehicle=(await tx.select().from(s.vehicles).where(and(eq(s.vehicles.id,vehicleId),eq(s.vehicles.userId,uid))).for('update'))[0];
            if(!vehicle) throw new svc.AppError(404,'Mașina nu există.');
            if (value.id) {
              const [existing] = await tx.select().from(s.gpsTrips).where(eq(s.gpsTrips.id, value.id));
              if (existing) {
                if (existing.userId !== uid || existing.vehicleId !== vehicleId || existing.distanceMeters !== value.distanceMeters || existing.startedAt.getTime() !== startedAt.getTime())
                  throw new svc.AppError(409, 'Identificator de călătorie invalid.');
                return { ...existing, odometer: vehicle.odometer };
              }
            }
            let confirmedOdometer = vehicle.odometer;
            if(value.syncMileage){
              if(value.expectedOdometer===undefined || value.expectedOdometer!==vehicle.odometer)throw new svc.AppError(409,'Kilometrajul a fost modificat între timp. Debifează sincronizarea pentru a salva separat călătoria și verifică bordul.');
              const previous=(await tx.select({meters:sql<string>`coalesce(sum(${s.gpsTrips.distanceMeters}),0)`}).from(s.gpsTrips).where(and(eq(s.gpsTrips.vehicleId,vehicleId),eq(s.gpsTrips.userId,uid),eq(s.gpsTrips.source,'browser-gps-synced'))))[0];
              const carry=Number(previous.meters)%1000;
              const odometer=vehicle.odometer+Math.floor((carry+value.distanceMeters)/1000);
              confirmedOdometer = odometer;
              if(odometer>99999999)throw new svc.AppError(400,'Kilometraj invalid.');
              await tx.update(s.vehicles).set({odometer}).where(and(eq(s.vehicles.id,vehicleId),eq(s.vehicles.userId,uid)));
            await tx.insert(s.mileageReadings).values({id:crypto.randomUUID(),userId:uid,vehicleId,odometer,source:'gps'});
            }
            const trip = (await tx.insert(s.gpsTrips).values({id:value.id??crypto.randomUUID(),userId:uid,vehicleId,distanceMeters:value.distanceMeters,durationSeconds:value.durationSeconds,startedAt,endedAt,source:value.syncMileage?'browser-gps-synced':'browser-gps'}).returning())[0];
            return { ...trip, odometer: confirmedOdometer };
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
    if (route === 'vehicles/catalog' && method === 'GET') {
      await rate(uid, 'vehicle-catalog', 20);
      return json(await vehicleCatalog(new URL(req.url).searchParams));
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
    if (path[0] === 'records' && path.length === 3 && path[2] === 'sheet' && method === 'GET') {
      const record = await svc.ownedRecord(uid, uuid.parse(path[1]));
      if (record.kind !== 'document') throw new svc.AppError(404, 'Document inexistent.');
      const [vehicle, profile] = await Promise.all([svc.ownedVehicle(uid, record.vehicleId), svc.profile(uid)]);
      const params = new URL(req.url).searchParams;
      const language = z.enum(['ro','en']).optional().parse(params.get('language') ?? undefined) ?? languageCookie(req.headers.get('cookie')) ?? await userLanguage(uid);
      const currency = accountDisplayCurrency(language, await readCurrencyPreference(uid));
      const rate = currency === 'EUR' && record.amountKnown ? await latestExchangeRate() : null;
      const pdf = await documentSheet(record, vehicle, { language, currency, rate, timezone: profile.timezone });
      return new Response(new Uint8Array(pdf), { headers: {
        'Content-Type':'application/pdf',
        'Content-Disposition':documentDisposition(documentSheetName(record.category, vehicle.plate, language), params.get('view') === '1'),
        'Cache-Control':'private, no-store',
        'X-Content-Type-Options':'nosniff',
        'X-Robots-Tag':'noindex',
      } });
    }
    if (path[0] === 'records') {
      if (method === 'DELETE' && path.length === 3 && path[2] === 'permanent') { const input=z.object({confirmation:z.literal('DELETE'),revision:z.number().int().positive()}).strict().parse(await body(req)); return json(await svc.deleteRecord(uid,uuid.parse(path[1]),input.revision)); }
      if (method === 'POST' && path.length === 3 && path[2] === 'restore') { await svc.restoreRecord(uid, uuid.parse(path[1])); return json({ok:true}); }
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
          uploadId: f.has('uploadId') ? uuid.parse(f.get('uploadId')) : undefined,
          bytes: Buffer.from(await file.arrayBuffer()),
        }),
        201,
      );
    }
    if (path[0] === 'files' && path.length === 2) {
      const file = await svc.getFile(uid, uuid.parse(path[1]));
      if (method === 'GET') {
        const record=await svc.ownedRecord(uid,file.recordId);
        const vehicle=await svc.ownedVehicle(uid,record.vehicleId);
        const name=documentDownloadName(record,vehicle,file.mime);
        return new Response(Buffer.from(file.data, 'base64'), {
          headers: {
            'Content-Type': file.mime,
            'Content-Disposition': documentDisposition(name,new URL(req.url).searchParams.get('view')==='1'),
            'Cache-Control': 'private, no-store',
            'X-Robots-Tag': 'noindex',
            'X-Content-Type-Options': 'nosniff',
          },
        });
      }
      if (method === 'DELETE') {
        await db()
          .delete(s.files)
          .where(and(eq(s.files.userId, uid), eq(s.files.id, file.id)));
        return json({ ok: true });
      }
    }
    if(route==='billing/play' && method==='GET') {
      const current=(await db().select().from(s.subscriptions).where(eq(s.subscriptions.userId,uid)))[0];
      const existing=(await db().select().from(s.playSubscriptions).where(and(eq(s.playSubscriptions.userId,uid),eq(s.playSubscriptions.active,true),sql`${s.playSubscriptions.expiresAt}>now()`))).length>0;
      return json({configured:playBillingConfigured(),products:playProducts(),accountId:playAccountId(uid),hasActiveSubscription:existing||!!(current?.subscriptionId&&['active','trialing','past_due','unpaid'].includes(current.status))});
    }
    if(route==='billing/play' && method==='POST') {
      await rate(uid,'play-verify',20);
      const {token}=z.object({token:z.string().min(10).max(4096)}).parse(await body(req));
      try{return json(await verifyPlayPurchase(uid,token));}catch{throw new svc.AppError(400,'Achiziția Google Play nu a putut fi verificată. Reîncearcă restaurarea achizițiilor.');}
    }
    if (route === 'push/native' && method === 'GET') return json({configured:nativePushConfigured()});
    if (route === 'push/native' && (method === 'POST' || method === 'DELETE')) {
      const {token} = z.object({token:z.string().min(20).max(4096).regex(/^[A-Za-z0-9_:.-]+$/)}).parse(await body(req));
      if (method === 'DELETE') {
        await db().delete(s.nativePushTokens).where(and(eq(s.nativePushTokens.token,token),eq(s.nativePushTokens.userId,uid)));
      } else {
        if (!nativePushConfigured()) throw new svc.AppError(503,'Notificările Android nu sunt încă configurate.');
        await db().insert(s.nativePushTokens).values({token,userId:uid}).onConflictDoUpdate({target:s.nativePushTokens.token,set:{userId:uid,updatedAt:new Date()}});
        await db().update(s.profiles).set({pushEnabled:true}).where(eq(s.profiles.userId,uid));
      }
      return json({ok:true});
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
                  'push.apple.com',
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
        const ownFeedback=await db().select().from(s.feedbackItems).where(eq(s.feedbackItems.userId,uid));
        const feedbackIds=ownFeedback.map(row=>row.id);
        const feedbackReplies=feedbackIds.length?await db().select().from(s.feedbackReplies).where(inArray(s.feedbackReplies.feedbackId,feedbackIds)):[];
        const feedbackFiles=feedbackIds.length?await db().select().from(s.feedbackFiles).where(inArray(s.feedbackFiles.feedbackId,feedbackIds)):[];
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
              feedback:ownFeedback, feedbackReplies, feedbackFiles,
              invoices,
              photos,
              sessions,
              communicationPreferences,
              accountSettings:await accountPreferences(uid),
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
          report: z.enum(reportKinds).optional(),
          kind: z.enum(['document', 'service', 'expense']).optional(),
          language: z.enum(['ro','en']).optional(),
          currency: z.enum(['RON','EUR']).optional(),
          vehicleScope: z.literal('active').optional(),
          finance: z.literal('1').optional(),
          financeCategory: z.enum(financeGroups).optional(),
          journal: z.literal('1').optional(),
          vehicleId: z.string().uuid().optional(),
          category: z.string().max(250).optional(),
          status: z.enum(['valid', 'soon', 'expired', 'incomplete', 'archived']).optional(),
          archived: z.enum(['all', 'active', 'only']).optional(),
          q: z.string().max(250).optional(),
          from: verifiedDate.optional(),
          to: verifiedDate.optional(),
        })
        .parse(
          Object.fromEntries(Array.from(params.entries()).filter(([key]) => key !== 'format' && key !== 'view')),
        );
      if (filters.from && filters.to && filters.from > filters.to) throw new svc.AppError(400,'Interval invalid.');
      const today = localDate(new Date(), data.profile.timezone);
      const report = filters.report ?? (filters.finance || filters.kind==='expense' ? 'finance'
        : filters.kind==='service' ? 'service' : filters.kind==='document' ? 'documents' : 'journal');
      const reportCars = data.vehicles.filter(vehicle =>
        (!filters.vehicleId || vehicle.id === filters.vehicleId) && (filters.vehicleScope !== 'active' || !vehicle.archived));
      const allowed = new Set(reportCars.map(vehicle=>vehicle.id));
      const eligible = data.records.filter(row=>allowed.has(row.vehicleId));
      const kind = filters.kind ?? (report==='service'?'service':report==='documents'?'document':undefined);
      const selection = report==='finance' || filters.finance
        ? [...new Map(eligible.map(row => [row.id, row])).values()].filter(row => isFinancialEntry(row, today) && (!filters.financeCategory || financeGroup(row) === filters.financeCategory))
        : filters.journal ? eligible.filter(row => !isPlannedService(row, today)) : eligible;
      const selected = filterRecords(selection, {...filters,kind}, new Date(), data.profile.timezone);
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
          currency: 'RON',
        }),
      );
      if (format === 'pdf') {
        const language = filters.language ?? languageCookie(req.headers.get('cookie')) ?? await userLanguage(uid);
        const en = language === 'en';
        const currency = accountDisplayCurrency(language, filters.currency ?? await readCurrencyPreference(uid));
        const mileageIds = reportCars.map(car=>car.id);
        const upcoming = report==='annual' || report==='service'
          ? filterRecords(eligible,{...filters,archived:'active',kind,from:undefined,to:undefined},new Date(),data.profile.timezone)
            .filter(row=>row.kind==='service'&&isPlannedService(row,today)&&(!row.date||row.date>=today) ||
              report==='annual'&&row.kind==='document'&&row.expiresAt&&row.expiresAt>=today)
          : [];
        const [mileage,exchangeRate] = await Promise.all([
          (report==='annual'||report==='finance')&&mileageIds.length
            ? db().select().from(s.mileageReadings).where(and(eq(s.mileageReadings.userId,uid),inArray(s.mileageReadings.vehicleId,mileageIds))) : [],
          currency==='EUR' ? latestExchangeRate() : null,
        ]);
        const pdf = await vehicleReport({
          vehicles: reportCars, records: selected, variant:report,
          generatedAt: new Date().toLocaleDateString(en ? 'en-GB' : 'ro-RO', { timeZone: data.profile.timezone }),
          timezone:data.profile.timezone, language, currency, exchangeRate, mileage, upcoming,
          asOf: today, from:filters.from,to:filters.to,
        });
        const filenames={service:'autocare-revizii.pdf',finance:'autocare-cheltuieli.pdf',annual:'autocare-dosarul-garajului.pdf',documents:'autocare-documente.pdf',journal:'autocare-raport.pdf'};
        return new Response(pdf, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': (params.get('view')==='1'?'inline':'attachment')+'; filename="'+filenames[report]+'"',
            'Cache-Control': 'no-store',
          },
        });
      }
      return new Response(svc.csv(rows, ['id','vehicleId','kind','category','title','date','expiresAt','odometer','amountBani','amountKnown','currency']), {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="autocare-istoric.csv"',
          'Cache-Control': 'no-store',
        },
      });
    }
    if(route==='account/settings' && method==='GET') {
      const person=(await db().select({name:s.user.name,email:s.user.email,createdAt:s.user.createdAt,emailVerified:s.user.emailVerified,image:s.user.image}).from(s.user).where(eq(s.user.id,uid)))[0];
      const accounts=await db().select({provider:s.account.providerId}).from(s.account).where(eq(s.account.userId,uid));
      return json({...person,...await accountPreferences(uid),providers:accounts.map(row=>row.provider)});
    }
    if(route==='account/settings' && method==='PUT') {
      const value=accountPreferencesSchema.parse(await body(req));
      await db().insert(s.settings).values({key:accountPreferencesKey(uid),value}).onConflictDoUpdate({target:s.settings.key,set:{value}});
      return json(value);
    }
    if (route === 'account' && method === 'DELETE') {
      const input=z.object({password:z.string().optional(),confirm:z.literal('ȘTERGE')}).strict().parse(await body(req));
      const credential=(await db().select({provider:s.account.providerId}).from(s.account).where(eq(s.account.userId,uid))).some(account=>account.provider==='credential');
      if(credential&&!input.password)throw new svc.AppError(400,'Confirmă parola contului.');
      await auth().api.deleteUser({headers:req.headers,body:{...(input.password?{password:input.password}:{}),callbackURL:'/stergere-cont?completed=1'}});
      return json({ok:true,verificationRequired:true});
    }
    if (['billing/checkout','billing/extend'].includes(route) && method === 'POST') {
      const input=z.object({interval:z.enum(['monthly','quarterly','annual']),currency:z.enum(['RON','EUR','ron','eur']).default('RON'),language:z.enum(['ro','en']).default('ro')}).parse(await body(req));
      return json(await checkout(uid,input.interval,route==='billing/extend',input.currency.toLowerCase() as 'ron'|'eur',input.language));
    }
    if(route==='billing/sync' && method==='POST')return json(await syncPaidExtensions(uid,stripe()));
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
    if (route === 'support/availability' && method === 'GET') return json(await supportAvailabilitySettings(uid));
    if (route === 'support/availability' && method === 'PUT') return json(await supportAvailabilitySettings(uid, await body(req)));
    if (route === 'support/presence' && method === 'POST') return json(await updateSupportPresence(uid, await body(req)));
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
        if ('duplicate' in result && result.duplicate) return json(result);
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
                    .filter((p) => supportChat.isSupportStaff(effectiveRole(p.userId,p.role))).map((p) => p.userId)
              : [thread.userId];
            const recipientIds = [...new Set(recipients)].filter((id) => id !== uid);
            const users = recipientIds.length
              ? await db().select({
                  id: s.user.id, name: s.user.name, email: s.user.email, verified: s.user.emailVerified,
                  emailEnabled: s.profiles.emailEnabled, pushEnabled: s.profiles.pushEnabled,
                }).from(s.user).innerJoin(s.profiles, eq(s.user.id, s.profiles.userId))
                  .where(sql`${s.user.id} IN (${sql.join(recipientIds.map((id) => sql`${id}`), sql`, `)})`)
              : [];
            await Promise.allSettled(users.map(async (user) => {
              const tasks: Promise<unknown>[] = [];
              if (!(await accountPreferences(user.id)).alerts.chat) return;
              const language = await userLanguage(user.id);
              const en = language === 'en';
              const incoming = thread.userId === uid;
              const title = incoming ? (en ? 'AutoCare · New support message' : 'AutoCare · Mesaj nou pentru suport')
                : (en ? 'AutoCare · Support reply' : 'AutoCare · Răspuns de la suport');
              const bodyText = incoming
                ? (en ? 'A new message arrived in the support inbox.' : 'A sosit un mesaj nou în Centrul de suport.')
                : (en ? 'The AutoCare team has replied in your support conversation.' : 'Echipa AutoCare ți-a răspuns în Centrul de suport.');
              if (user.pushEnabled) tasks.push(sendPushNotification(user.id, {
                id: 'support-' + messageResult.message.id, title, body: bodyText,
              }));
              if (user.emailEnabled && user.verified && !('routesThroughMailStudio' in result && result.routesThroughMailStudio) &&
                await recipientAllowed(user.id, 'transactional', false, 'support_reply')) {
                const content = renderEmail('support_reply', {
                  name:user.name, language, subject:title, message:bodyText,
                  ctaLabel:en ? 'View support message' : 'Vezi mesajul de suport', ctaPath:'/cont?tab=Centru%20de%20suport',
                });
                tasks.push(sendMail(user.email, title, content.text,
                  'support/' + messageResult.message.id + '/' + user.id, content, {userId:user.id, template:'support_reply'}));
              }
              const results = await Promise.allSettled(tasks);
              if (results.some(task => task.status === 'rejected')) console.error(JSON.stringify({ event: 'support_notification_failed', messageId: messageResult.message.id }));
            }));
          }
        } catch { console.error(JSON.stringify({ event: 'support_notification_dispatch_failed' })); }
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
      const english=languageCookie(req.headers.get('cookie'))==='en';
      const message=english?'Payment could not be started. Please try again later or contact support with the reference below.':'Plata nu a putut fi inițiată. Încearcă mai târziu sau contactează suportul cu referința de mai jos.';
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
