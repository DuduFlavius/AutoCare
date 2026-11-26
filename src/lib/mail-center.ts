import {accountPreferences} from './account-preferences';
import {campaignEnglish,englishMailSchema} from './mail-localization';
import {userLanguage} from './user-language';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { emailCategorySchema, emailCategories, emailCategory } from './mail-preference-categories';
import { emailAddressHash, unsubscribeLink } from './mail-consent';
import { monthlyVehicleReport } from './mail-monthly-report';
import { releaseProofSchema, verifyPublishedRelease } from './mail-release-proof';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from './db';
import * as s from './schema';
import { requireFounder } from './founder';
import { isFounder } from './permissions';
import { AppError, assertActiveAccount, profile } from './service';
import {
  emailTemplates,
  templateCategory,
  renderEmail,
  appLink,
  type EmailTemplate,
  type EmailContent,
} from './email-templates';
import { gmailReady, GoogleDeliveryError, sendGoogleMail, verifyGoogleMailAuthorization } from './google-mail';
import { billingMailValid, communicationPreference, recipientAllowed } from './mail-policy';
import { automationState, queueAutomatedMail } from './mail-automation';
import { automationGroup, automationSettings, automationOverview, eligibleAutomationDelivery, releaseChannel, readReleaseSettings } from './mail-lifecycle';
export async function requireMailStaff(uid: string) {
  await assertActiveAccount(uid);
  const actor = await profile(uid);
  if (!['founder', 'superadmin', 'admin', 'assistant'].includes(actor.role))
    throw new AppError(403, 'Mail Center este disponibil doar echipei autorizate.');
  return { role: actor.role, canApprove: actor.role === 'founder', directSend: ['founder', 'superadmin'].includes(actor.role) };
}
const reviewKey = (id: string) => 'mail-review:' + id;
type MailReview = { campaignId: string; requestedBy: string; requestedAt: string; status: 'pending' | 'approved' | 'rejected'; reviewedBy?: string; reviewedAt?: string; fingerprint: string };
async function reviews() {
  return (await db().select().from(s.settings).where(sql`${s.settings.key} LIKE 'mail-review:%'`)).map(x => x.value as MailReview);
}
export async function requestCampaignApproval(uid: string, id: string) {
  await requireMailStaff(uid);
  const { campaign } = await campaignDetail(uid, id);
  if (campaign.source !== 'manual') throw new AppError(400, 'Alege o comunicare manuală.');
  const request: MailReview = { campaignId: id, requestedBy: uid, requestedAt: new Date().toISOString(), status: 'pending', fingerprint: campaign.fingerprint };
  await db().insert(s.settings).values({ key: reviewKey(id), value: request }).onConflictDoNothing();
  return { requested: true };
}
export async function reviewCampaign(uid: string, id: string, input: unknown) {
  await requireFounder(uid);
  const { approve } = z.object({ approve: z.boolean() }).strict().parse(input);
  const { campaign } = await campaignDetail(uid, id);
  const row = (await db().select().from(s.settings).where(eq(s.settings.key, reviewKey(id))))[0];
  if (!row) throw new AppError(404, 'Cererea nu există.');
  const review = row.value as MailReview;
  if (review.fingerprint !== campaign.fingerprint) throw new AppError(409, 'Conținutul comunicării s-a schimbat.');
  const value = { ...review, status: approve ? 'approved' : 'rejected', reviewedBy: uid, reviewedAt: new Date().toISOString() };
  await db().update(s.settings).set({ value }).where(eq(s.settings.key, reviewKey(id)));
  await db().insert(s.audit).values({ id: crypto.randomUUID(), actorId: uid, action: approve ? 'mail.review.approved' : 'mail.review.rejected', target: id });
  return { ok: true };
}
async function campaignApproved(id: string, fingerprint: string) {
  const row = (await db().select().from(s.settings).where(eq(s.settings.key, reviewKey(id))))[0];
  const review = row?.value as MailReview | undefined;
  return review?.status === 'approved' && review.fingerprint === fingerprint && !!review.reviewedBy && isFounder(review.reviewedBy);
}
export async function requestAutomationApproval(uid: string) {
  await requireMailStaff(uid);
  await db().insert(s.settings).values({ key: 'mail-automation-request:' + uid, value: { requestedBy: uid, requestedAt: new Date().toISOString() } }).onConflictDoUpdate({ target: s.settings.key, set: { value: { requestedBy: uid, requestedAt: new Date().toISOString() } } });
  return { requested: true };
}
const templateIds = Object.keys(emailTemplates) as [EmailTemplate, ...EmailTemplate[]];
const inputSchema = z
  .object({
    id: z.uuid(),
    communicationType: z.string().trim().min(2).max(100).default('Informare cont'),
    templateLabel:z.string().trim().max(100).optional(),
    categoryLabel:z.string().trim().max(100).optional(),
    englishContent:englishMailSchema.optional(),
    template: z.enum(templateIds),
    category: z.enum(['transactional', 'promotional']),
    subject: z
      .string()
      .trim()
      .min(3)
      .max(180)
      .refine((x) => !/[\r\n]/.test(x)),
    message: z.string().trim().min(10).max(8000),
    ctaLabel: z.string().trim().min(2).max(60),
    ctaPath: z
      .string()
      .max(400)
      .refine((x) => {
        try {
          appLink(x);
          return true;
        } catch {
          return false;
        }
      }),
    recipients: z
      .array(z.string().min(1).max(128))
      .max(50)
      .default([])
      .transform((x) => [...new Set(x)].sort()),
    segment: z.enum(['all','garage','no_garage']).optional(),
  })
  .strict();
export async function saveCommunicationPreference(uid: string, input: unknown) {
  await assertActiveAccount(uid);
  const prefs = z
    .object({ transactional: z.boolean(), promotional: z.boolean(), categories: emailCategorySchema.optional() })
    .strict()
    .parse(input);
  return db().transaction(async tx => {
    const [owner] = await tx.select({createdAt:s.user.createdAt}).from(s.user).where(eq(s.user.id,uid)).for('update');
    const [before] = await tx.select().from(s.communicationPreferences).where(eq(s.communicationPreferences.userId, uid));
    const categories = prefs.categories ?? { ...emailCategories(before?.categories, prefs.promotional), offers: prefs.promotional };
    const updated = { transactional: prefs.transactional, promotional: categories.offers, categories };
    await tx.insert(s.communicationPreferences).values({ userId: uid, ...updated })
      .onConflictDoUpdate({ target: s.communicationPreferences.userId, set: { ...updated, updatedAt: new Date() } });
    if (!before || JSON.stringify([before.transactional, before.promotional, emailCategories(before.categories, before.promotional)]) !==
        JSON.stringify([updated.transactional, updated.promotional, emailCategories(updated.categories, updated.promotional)])) {
      await tx.insert(s.mailConsents).values({ id: crypto.randomUUID(), userId: uid, preferences: updated, source: 'account' });
      if (categories.news && !emailCategories(before?.categories,before?.promotional??false).news && owner &&
          Date.now()-owner.createdAt.getTime() < 14*86400000)
        await queueAutomatedMail(uid,'onboarding_guide','onboarding-guide:'+uid,{},tx);
    }
    return updated;
  });
}
export async function getCommunicationPreference(uid: string) {
  await assertActiveAccount(uid);
  return communicationPreference(uid);
}
const libraryEntrySchema = z.object({
  id: z.uuid(), kind: z.enum(['template', 'communication']),
  englishContent:englishMailSchema.optional(),
  label: z.string().trim().min(2).max(100),
  category: z.enum(['transactional', 'promotional']),
  template: z.enum(templateIds).default('administrative'),
  subject: z.string().trim().min(3).max(180).refine(x => !/[\r\n]/.test(x)),
  message: z.string().trim().min(10).max(8000),
  ctaLabel: z.string().trim().min(2).max(60),
  ctaPath: z.string().max(400).refine(x => { try { appLink(x); return true; } catch { return false; } }),
}).strict();
export async function saveMailLibraryEntry(uid: string, input: unknown) {
  await requireMailStaff(uid);
  const entry = libraryEntrySchema.parse(input);
  if (['verification', 'password_reset', 'gmail_test', 'monthly_report', 'account_security'].includes(entry.template))
    throw new AppError(400, 'Șabloanele de securitate nu pot fi reutilizate manual.');
  if (templateCategory(entry.template) === 'promotional' && entry.category !== 'promotional')
    throw new AppError(400, 'Șablonul promoțional necesită acord promoțional.');
  await db().insert(s.settings).values({ key: 'mail-library:' + entry.id, value: entry })
    .onConflictDoUpdate({ target: s.settings.key, set: { value: entry } });
  return entry;
}
export async function deleteMailLibraryEntry(uid: string, id: string) {
  await requireMailStaff(uid);
  z.uuid().parse(id);
  await db().delete(s.settings).where(eq(s.settings.key, 'mail-library:' + id));
  return { ok: true };
}
async function mailLibrary() {
  const rows = await db().select().from(s.settings).where(sql`${s.settings.key} LIKE 'mail-library:%'`);
  return rows.flatMap(row => { const parsed = libraryEntrySchema.safeParse(row.value); return parsed.success ? [parsed.data] : []; });
}
export async function mailCenterOverview(uid: string) {
  await requireMailStaff(uid);
  const [campaigns, users, automation] = await Promise.all([
    db().select().from(s.mailCampaigns).orderBy(desc(s.mailCampaigns.createdAt)).limit(50),
    db()
      .select({
        id: s.user.id,
        name: s.user.name,
        email: s.user.email,
        emailVerified: s.user.emailVerified,
        emailEnabled: s.profiles.emailEnabled,
        promotional: s.communicationPreferences.promotional,
        categories: s.communicationPreferences.categories,
        suspendedAt: s.accountRestrictions.suspendedAt,
        transactional: s.communicationPreferences.transactional,
      })
      .from(s.user)
      .leftJoin(s.profiles, eq(s.user.id, s.profiles.userId))
      .leftJoin(s.communicationPreferences, eq(s.user.id, s.communicationPreferences.userId))
      .leftJoin(s.accountRestrictions, eq(s.user.id, s.accountRestrictions.userId))
      .orderBy(s.user.email)
      .limit(500),
    automationState(),
  ]);
  const counts = campaigns.length
    ? await db()
        .select({
          campaignId: s.mailDeliveries.campaignId,
          status: s.mailDeliveries.status,
          count: sql<number>`count(*)::int`,
        })
        .from(s.mailDeliveries)
        .where(
          inArray(
            s.mailDeliveries.campaignId,
            campaigns.map((x) => x.id),
          ),
        )
        .groupBy(s.mailDeliveries.campaignId, s.mailDeliveries.status)
    : [];
  const [deliverySummary, optOuts] = await Promise.all([
    db().select({status: s.mailDeliveries.status, error:s.mailDeliveries.error, count:sql<number>`count(*)::int`})
      .from(s.mailDeliveries).groupBy(s.mailDeliveries.status,s.mailDeliveries.error),
    db().select({ count:sql<number>`count(*)::int` }).from(s.mailConsents).where(eq(s.mailConsents.source,'unsubscribe')),
  ]);
  const total = (...statuses: string[]) => deliverySummary.filter(row=>statuses.includes(row.status)).reduce((sum,row)=>sum+row.count,0);
  return {
    stats: {
      accepted:total('accepted','delivered'), delivered:total('delivered'), failed:total('failed','unknown'),
      bounces:deliverySummary.filter(row=>row.error==='EMAIL_BOUNCED').reduce((sum,row)=>sum+row.count,0),
      unsubscribed:optOuts[0]?.count ?? 0,
    },
    permissions: await requireMailStaff(uid),
    reviews: await reviews(),
    automationRequests: (await db().select().from(s.settings).where(sql`${s.settings.key} LIKE 'mail-automation-request:%'`)).map(x => x.value as { requestedBy: string; requestedAt: string }),
    templates: emailTemplates,
    library: await mailLibrary(),
    campaigns: campaigns.map((c) => ({
      ...c,
      counts: Object.fromEntries(
        counts.filter((x) => x.campaignId === c.id).map((x) => [x.status, x.count]),
      ),
    })),
    users,
    automation,
    lifecycle: await automationOverview(),
  };
}
export async function previewMail(uid: string, input: unknown) {
  await requireMailStaff(uid);
  const data = z
    .object({
      language:z.enum(['ro','en']).optional(),
      template: z.enum(templateIds),
      name: z.string().max(100).optional(),
      subject: z.string().max(180).optional(),
      message: z.string().max(8000).optional(),
      ctaLabel: z.string().max(60).optional(),
      ctaPath: z.string().max(400).optional(),
      promotional: z.boolean().optional(),
    })
    .strict()
    .parse(input);
  try {
    return renderEmail(data.template, {...data,language:data.language??await userLanguage(uid)});
  } catch {
    throw new AppError(400, 'Linkul CTA trebuie să fie o adresă din AutoCare.');
  }
}
const segments = z.enum(['all','garage','no_garage']);
async function segmentRecipients(segment: z.infer<typeof segments>, template: EmailTemplate, category: string, store: Pick<ReturnType<typeof db>,'select'> = db()) {
  const [accounts,suppressed] = await Promise.all([
    store.select({id:s.user.id,email:s.user.email,transactional:s.communicationPreferences.transactional,
      promotional:s.communicationPreferences.promotional,categories:s.communicationPreferences.categories})
      .from(s.user).leftJoin(s.profiles,eq(s.profiles.userId,s.user.id))
      .leftJoin(s.accountRestrictions,eq(s.accountRestrictions.userId,s.user.id))
      .leftJoin(s.communicationPreferences,eq(s.communicationPreferences.userId,s.user.id))
      .where(and(eq(s.user.emailVerified,true),sql`${s.profiles.emailEnabled} is distinct from false`,
        sql`${s.accountRestrictions.suspendedAt} is null`,
        segment==='all' ? undefined : sql`
          (exists (select 1 from ${s.vehicles} where ${s.vehicles.userId}=${s.user.id} and not ${s.vehicles.archived}))
            = ${segment==='garage'}`)).orderBy(s.user.id),
    store.select({hash:s.mailSuppressions.addressHash}).from(s.mailSuppressions),
  ]);
  const blocked = new Set(suppressed.map(row=>row.hash));
  const pref = emailCategory(template,category==='promotional');
  return accounts.filter(row=>z.email().max(254).safeParse(row.email).success && !blocked.has(emailAddressHash(row.email)) &&
    (pref ? emailCategories(row.categories,row.promotional ?? false)[pref] : row.transactional !== false)).map(row=>row.id);
}

export async function countSegment(uid:string, input:unknown) {
  await requireMailStaff(uid);
  const {segment,template,category} = z.object({segment:segments,template:z.enum(templateIds),
    category:z.enum(['transactional','promotional'])}).strict().parse(input);
  return {count:(await segmentRecipients(segment,template,category)).length};
}

export async function saveCampaign(uid: string, input: unknown) {
  await requireMailStaff(uid);
  const data = inputSchema.parse(input);
  if (['verification', 'password_reset', 'gmail_test', 'monthly_report', 'account_security'].includes(data.template))
    throw new AppError(
      400,
      'Acest șablon se trimite exclusiv din fluxul securizat dedicat. Poți vedea previzualizarea aici.',
    );
  if (templateCategory(data.template) === 'promotional' && data.category !== 'promotional')
    throw new AppError(400, 'Șablonul promoțional necesită categoria promoțională.');
  if (!!data.segment === !!data.recipients.length) throw new AppError(400,'Alege un segment sau selectează destinatari individual.');
  const fingerprint = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return db().transaction(async (tx) => {
    await tx.select().from(s.user).where(eq(s.user.id, uid)).for('update');
    const existing = (
      await tx.select().from(s.mailCampaigns).where(eq(s.mailCampaigns.id, data.id))
    )[0];
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new AppError(
          409,
          'ID-ul este deja utilizat. Creează o ciornă nouă pentru conținut modificat.',
        );
      return { id: existing.id, duplicate: true };
    }
    const audience = data.segment ? await segmentRecipients(data.segment,data.template,data.category,tx) : data.recipients;
    if (!audience.length) throw new AppError(400,'Segmentul nu are destinatari eligibili.');
    const users = data.segment ? audience : await tx
      .select({ id: s.user.id })
      .from(s.user)
      .where(inArray(s.user.id, data.recipients));
    if (users.length !== audience.length)
      throw new AppError(400, 'Un destinatar nu mai există. Reîncarcă lista.');
    await tx.insert(s.mailCampaigns).values({
      id: data.id,
      actorId: uid,
      source: 'manual',
      template: data.template,
      category: data.category,
      subject: data.subject,
      message: data.message,
      ctaLabel: data.ctaLabel,
      ctaPath: data.ctaPath,
      fingerprint,
      status: 'draft',
    });
    if(data.englishContent)await tx.insert(s.settings).values({key:'mail-english:'+data.id,value:data.englishContent});
    await tx.insert(s.settings).values({ key: 'mail-kind:' + data.id, value: { label: data.communicationType,templateLabel:data.templateLabel,categoryLabel:data.categoryLabel } });
    for (let index=0; index<audience.length; index+=250) await tx.insert(s.mailDeliveries).values(
      audience.slice(index,index+250).map((userId) => ({
        id: crypto.randomUUID(),
        campaignId: data.id,
        userId,
        dedupeKey: `manual:${data.id}:${userId}`,
        status: 'pending',
      })),
    );
    await tx.insert(s.audit).values({
      id: crypto.randomUUID(),
      actorId: uid,
      action: 'mail.draft.created',
      target: data.id,
    });
    return { id: data.id, duplicate: false, count:audience.length };
  });
}
export async function campaignDetail(uid: string, id: string) {
  await requireMailStaff(uid);
  const campaign = (await db().select().from(s.mailCampaigns).where(eq(s.mailCampaigns.id, id)))[0];
  if (!campaign) throw new AppError(404, 'Email inexistent.');
  const deliveries = await db()
    .select({
      id: s.mailDeliveries.id,
      userId: s.mailDeliveries.userId,
      status: s.mailDeliveries.status,
      error: s.mailDeliveries.error,
      attemptedAt: s.mailDeliveries.attemptedAt,
      name: s.user.name,
      email: sql<string>`coalesce(${s.mailDeliveries.recipientEmail},${s.user.email})`,
    })
    .from(s.mailDeliveries)
    .innerJoin(s.user, eq(s.user.id, s.mailDeliveries.userId))
    .where(eq(s.mailDeliveries.campaignId, id))
    .limit(100);
  const kind = (await db().select().from(s.settings).where(eq(s.settings.key, 'mail-kind:' + id)))[0]?.value as { label?: string;templateLabel?:string;categoryLabel?:string } | undefined;
  return { campaign, deliveries, communicationType: kind?.label || 'Informare cont',templateLabel:kind?.templateLabel||'',categoryLabel:kind?.categoryLabel||'' };
}
export type MailTransport = (to: string, content: EmailContent, id: string) => Promise<string>;
async function lifecycleEventStillValid(userId: string, template: string, context: typeof s.mailDeliveries.$inferSelect.context) {
  if (context.threadId) {
    const [thread] = await db().select({status:s.supportThreads.status}).from(s.supportThreads)
      .where(and(eq(s.supportThreads.id,context.threadId),eq(s.supportThreads.userId,userId)));
    return !!thread && (template === 'support_resolved' ? thread.status === 'completed' : thread.status !== 'trashed');
  }
  if (context.vehicleId) {
    const [vehicle] = await db().select({archived:s.vehicles.archived}).from(s.vehicles)
      .where(and(eq(s.vehicles.id,context.vehicleId),eq(s.vehicles.userId,userId)));
    return !!vehicle && !vehicle.archived;
  }
  return true;
}

export async function deliverCampaign(
  id: string,
  transport: MailTransport = sendGoogleMail,
  now = new Date(),
) {
  const campaign = (await db().select().from(s.mailCampaigns).where(eq(s.mailCampaigns.id, id)))[0];
  if (!campaign || ['cancelled','completed'].includes(campaign.status) ||
      (campaign.scheduledAt && campaign.scheduledAt > now)) return { accepted: 0 };
  if (campaign.source === 'manual' && !campaign.scheduledAt && campaign.actorId) {
    const author = await requireMailStaff(campaign.actorId);
    if (!author.directSend && !(await campaignApproved(id, campaign.fingerprint))) return { accepted: 0, held: true };
  }
  if (campaign.source === 'automation' && !(await automationState()).enabled)
    return { accepted: 0, held: true };
  const operatorSettings = campaign.source === 'automation' ? await automationSettings() : null;
  const release = campaign.source === 'automation' && campaign.template === 'release_news'
    ? await readReleaseSettings(id) : undefined;
  const group = automationGroup(campaign.template, release?.proof ? releaseChannel(release.proof) : undefined);
  if (operatorSettings && group && !operatorSettings[group]) return { accepted: 0, held: true };
  if (campaign.source === 'automation' && campaign.template === 'release_news') {
    if (!release?.proof || release.releaseDate > new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Bucharest' }).format(now))
      return { accepted: 0, held: true };
    if (release.mode === 'auto' && !(group === 'releaseAndroid' ? operatorSettings?.autoAndroid : operatorSettings?.autoWeb))
      return { accepted:0,held:true };
    try { await verifyPublishedRelease(release.proof); }
    catch {
      await db().update(s.mailCampaigns).set({scheduledAt:new Date(now.getTime()+60*60000)})
        .where(and(eq(s.mailCampaigns.id,id),inArray(s.mailCampaigns.status,['held','sending'])));
      return { accepted: 0, held: true, blocked:'RELEASE_NOT_LIVE' };
    }
  }
  await db()
    .update(s.mailDeliveries)
    .set({ status: 'unknown', error: 'DELIVERY_INTERRUPTED_CHECK_MAILBOX' })
    .where(
      and(
        eq(s.mailDeliveries.campaignId, id),
        eq(s.mailDeliveries.status, 'sending'),
        sql`${s.mailDeliveries.attemptedAt}<${new Date(now.getTime() - 120000).toISOString()}::timestamptz`,
      ),
    );
  const candidates = await db()
    .select()
    .from(s.mailDeliveries)
    .where(
      and(
        eq(s.mailDeliveries.campaignId, id),
        inArray(
          s.mailDeliveries.status,
          campaign.source === 'automation' ? ['held', 'pending'] : ['pending'],
        ),
        eligibleAutomationDelivery(campaign.template, now),
      ),
    )
    .limit(2);
  let accepted = 0;
  await Promise.all(
    candidates.map(async (candidate) => {
      const claimed = await db()
        .update(s.mailDeliveries)
        .set({ status: 'sending', attemptedAt: now })
        .where(
          and(eq(s.mailDeliveries.id, candidate.id), eq(s.mailDeliveries.status, candidate.status),
            sql`exists (select 1 from ${s.mailCampaigns} where ${s.mailCampaigns.id} = ${id}
              and ${s.mailCampaigns.status} <> 'cancelled')`),
        )
        .returning();
      if (!claimed.length) return;
      const accountPrefs=await accountPreferences(candidate.userId);
      const categoryEnabled=(!['release_news','feature_news'].includes(campaign.template)||accountPrefs.alerts.updates) && (campaign.template!=='administrative'||accountPrefs.alerts.account);
      if (
        !categoryEnabled ||
        (campaign.source === 'automation' &&
          ((campaign.template === 'welcome' && (candidate.dedupeKey !== 'welcome:' + candidate.userId || now.getTime() - campaign.createdAt.getTime() > 14*86400000)) ||
           (campaign.template === 'onboarding_guide' && now.getTime() - campaign.createdAt.getTime() > 14*86400000))) ||
        !(await recipientAllowed(candidate.userId, campaign.category, campaign.source === 'manual', campaign.template)) ||
        !(await lifecycleEventStillValid(candidate.userId,campaign.template,candidate.context)) ||
        !(await billingMailValid(candidate.userId, campaign.template, candidate.context, now))
      ) {
        await db()
          .update(s.mailDeliveries)
          .set({ status: 'suppressed', error: 'PREFERENCES_OR_EVENT_CHANGED' })
          .where(eq(s.mailDeliveries.id, candidate.id));
        return;
      }
      const user = (await db().select().from(s.user).where(eq(s.user.id, candidate.userId)))[0];
      try {
        await db()
          .update(s.mailDeliveries)
          .set({ recipientEmail: user.email })
          .where(eq(s.mailDeliveries.id, candidate.id));
        const language=await userLanguage(candidate.userId);
        const english=language==='en'?await campaignEnglish(campaign.id):null;
        const report = campaign.template === 'monthly_report' && candidate.context.month
          ? await monthlyVehicleReport(candidate.userId, candidate.context.month, language, now) : null;
        if (campaign.template === 'monthly_report' && !report) {
          await db().update(s.mailDeliveries).set({ status:'suppressed', error:'NO_CURRENT_VEHICLE_DATA' })
            .where(eq(s.mailDeliveries.id,candidate.id));
          return;
        }
        const content = renderEmail(campaign.template as EmailTemplate, {
          name: user.name,
          language,
          subject: campaign.subject,
          message: campaign.message,
          ctaLabel: campaign.ctaLabel,
          ctaPath: campaign.ctaPath,
          promotional: campaign.category === 'promotional',
          ...(english??{}),
          ...(report ?? {}),
          ...(campaign.template==='welcome' ? {links:[
            {label:language==='en'?'Get started with AutoCare':'Descoperă AutoCare',path:language==='en'?'/en/how-it-works':'/cum-functioneaza'},
            {label:language==='en'?'Contact support':'Contactează echipa de suport',path:'/cont?tab=Centru+de+suport'},
          ]} : {}),
          ...(candidate.context.threadId ? {ctaPath:'/cont?tab=Centru+de+suport'+(language==='en'?'&lang=en':'')} : {}),
          ...(campaign.template==='onboarding_guide' ? {links:[
            {label:language==='en'?'Explore SmartDrive GPS':'Descoperă SmartDrive GPS',path:language==='en'?'/en/smartdrive-gps':'/smartdrive-gps'},
            {label:'AutoCare AI',path:language==='en'?'/en/automotive-ai':'/autocare-ai'},
            {label:language==='en'?'Download Android app':'Descarcă aplicația Android',path:language==='en'?'/en/download':'/descarca'},
          ]} : {}),
          ...(release ? { ctaLabel:language==='en'?'Open AutoCare':'Deschide AutoCare', links:[
            { label:language==='en'?'Read the release notes':'Vezi istoricul versiunilor',path:language==='en'?'/en/releases':'/noutati' },
            ...(release.proof?.android ? [{ label:language==='en'?'Update the app':'Actualizează aplicația',path:language==='en'?'/en/download':'/descarca' }] : []),
          ] } : {}),
          ...(campaign.category === 'promotional' ? { unsubscribeUrl: unsubscribeLink(candidate.userId, user.email, language === 'en') } : {}),
        });
        const providerId = await transport(user.email, content, candidate.id);
        await db()
          .update(s.mailDeliveries)
          .set({ status: 'accepted', providerId, error: null })
          .where(eq(s.mailDeliveries.id, candidate.id));
        accepted++;
      } catch (e) {
        const retryCount = candidate.context.retryCount ?? 0;
        const retry = (campaign.source === 'automation' || campaign.scheduledAt !== null) && e instanceof GoogleDeliveryError
          && e.code === 'GMAIL_HTTP_429' && retryCount < 3;
        await db()
          .update(s.mailDeliveries)
          .set({
            status: retry ? 'pending' : e instanceof GoogleDeliveryError ? e.deliveryStatus : 'unknown',
            error: e instanceof GoogleDeliveryError ? e.code : 'DELIVERY_UNCONFIRMED',
            ...(retry ? { context: { ...candidate.context, retryCount: retryCount + 1 } } : {}),
          })
          .where(eq(s.mailDeliveries.id, candidate.id));
      }
    }),
  );
  const remaining = await db()
    .select({ id: s.mailDeliveries.id })
    .from(s.mailDeliveries)
    .where(
      and(
        eq(s.mailDeliveries.campaignId, id),
        inArray(s.mailDeliveries.status, ['held', 'pending', 'sending']),
      ),
    )
    .limit(1);
  await db()
    .update(s.mailCampaigns)
    .set({ status: remaining.length ? 'sending' : 'completed' })
    .where(and(eq(s.mailCampaigns.id, id),sql`${s.mailCampaigns.status} <> 'cancelled'`));
  return { accepted, remaining: !!remaining.length };
}
export async function scheduleCampaign(uid: string, id: string, input: unknown) {
  await requireFounder(uid);
  const { at } = z.object({at:z.iso.datetime({offset:true})}).strict().parse(input);
  const scheduledAt = new Date(at);
  if (scheduledAt.getTime() <= Date.now()) throw new AppError(400,'Alege o dată viitoare.');
  await db().transaction(async tx=>{
    const [campaign] = await tx.select().from(s.mailCampaigns).where(eq(s.mailCampaigns.id,id)).for('update');
    if (!campaign || campaign.source!=='manual' || campaign.status!=='draft' || campaign.template==='release_news')
      throw new AppError(409,'Doar ciornele obișnuite se pot programa aici.');
    await tx.update(s.mailCampaigns).set({status:'scheduled',scheduledAt}).where(eq(s.mailCampaigns.id,id));
    await tx.insert(s.audit).values({id:crypto.randomUUID(),actorId:uid,action:'mail.campaign.scheduled',target:id});
  });
  return {scheduled:true};
}

export async function cancelCampaign(uid: string, id: string) {
  await requireFounder(uid);
  await db().transaction(async tx=>{
    const [campaign] = await tx.select().from(s.mailCampaigns).where(eq(s.mailCampaigns.id,id)).for('update');
    if (!campaign || !['draft','scheduled','held','sending'].includes(campaign.status) ||
        (campaign.source!=='manual' && campaign.template!=='release_news')) throw new AppError(409,'Campania nu mai poate fi anulată.');
    await tx.update(s.mailCampaigns).set({status:'cancelled'}).where(eq(s.mailCampaigns.id,id));
    await tx.update(s.mailDeliveries).set({status:'suppressed',error:'CAMPAIGN_CANCELLED'})
      .where(and(eq(s.mailDeliveries.campaignId,id),inArray(s.mailDeliveries.status,['pending','held'])));
    await tx.insert(s.audit).values({id:crypto.randomUUID(),actorId:uid,action:'mail.campaign.cancelled',target:id});
  });
  return {cancelled:true};
}

export async function sendCampaign(uid: string, id: string) {
  await requireMailStaff(uid);
  const { campaign } = await campaignDetail(uid, id);
  if (campaign.template === 'release_news') throw new AppError(400, 'Publică lansarea prin AutoCare News.');
  if (campaign.source !== 'manual')
    throw new AppError(403, 'Automatizările necesită aprobarea și activarea separată.');
  const actor = await requireMailStaff(uid);
  if (!actor.canApprove && !(await campaignApproved(id, campaign.fingerprint))) {
    await requestCampaignApproval(uid, id);
    throw new AppError(403, 'Comunicarea a fost trimisă Fondatorului pentru aprobare.');
  }
  if (campaign.status === 'cancelled' || campaign.scheduledAt && campaign.scheduledAt > new Date())
    throw new AppError(409,'Campania este anulată sau programată pentru mai târziu.');
  if (!(await gmailReady()))
    throw new AppError(409, 'Reconectează Gmail și finalizează testul înainte de trimitere.');
  await verifyGoogleMailAuthorization();
  if (!(await gmailReady()))
    throw new AppError(409, 'Conectează Gmail și finalizează testul manual înainte de trimitere.');
  const key = `mail-center:${uid}:${Math.floor(Date.now() / 60000)}`;
  const count = (
    await db()
      .insert(s.requestLimits)
      .values({ key, window: new Date() })
      .onConflictDoUpdate({
        target: s.requestLimits.key,
        set: { count: sql`${s.requestLimits.count}+1` },
      })
      .returning()
  )[0];
  if (count.count > 15)
    throw new AppError(429, 'Limita de trimitere a fost atinsă. Reîncearcă într-un minut.');
  await db().update(s.mailCampaigns).set({scheduledAt:new Date(),status:'sending'})
    .where(and(eq(s.mailCampaigns.id,id),inArray(s.mailCampaigns.status,['draft','sending'])));
  const result = await deliverCampaign(id);
  await db()
    .insert(s.audit)
    .values({ id: crypto.randomUUID(), actorId: uid, action: 'mail.manual.batch', target: id });
  return result;
}
export async function retryFailedCampaign(uid: string, id: string) {
  const actor = await requireMailStaff(uid);
  const { campaign } = await campaignDetail(uid, id);
  if (campaign.source !== 'manual') throw new AppError(403, 'Doar comunicările manuale pot fi reîncercate aici.');
  if (campaign.status==='cancelled') throw new AppError(409,'Campania este anulată.');
  if (!actor.canApprove && !(await campaignApproved(id, campaign.fingerprint))) throw new AppError(403, 'Este necesară aprobarea Fondatorului.');
  const requeued = await db().update(s.mailDeliveries).set({status:'pending',error:null,attemptedAt:null})
    .where(and(eq(s.mailDeliveries.campaignId,id),eq(s.mailDeliveries.status,'failed'),sql`${s.mailDeliveries.providerId} IS NULL`)).returning({id:s.mailDeliveries.id});
  if (requeued.length) await db().update(s.mailCampaigns).set({status:'draft',scheduledAt:null}).where(eq(s.mailCampaigns.id,id));
  await db().insert(s.audit).values({id:crypto.randomUUID(),actorId:uid,action:'mail.failed.requeued',target:id});
  return { requeued: requeued.length };
}
export async function publishReleaseNews(uid: string, id: string, input: unknown) {
  await requireFounder(uid);
  const { version, releaseDate, proof, mode } = z.object({
    version: z.string().trim().regex(/^[0-9][A-Za-z0-9.+-]{0,39}$/),
    releaseDate: z.iso.date(),
    proof: releaseProofSchema.optional(),
    mode: z.enum(['approval','auto']).default('approval'),
  }).strict().parse(input);
  if (!(await automationState()).enabled || !(await gmailReady()))
    throw new AppError(409, 'Activează automatizările și verifică expeditorul înainte de publicare.');
  if (!proof) throw new AppError(400,'Confirmă testele și introduce commitul publicat. Pentru Android este necesară verificarea APK-ului semnat.');
  const platform = releaseChannel(proof);
  if (proof.android && version !== proof.android.version) throw new AppError(400,'Versiunea anunțului trebuie să coincidă cu versiunea Android.');
  if (mode === 'auto') {
    const config = await automationSettings();
    if (!(platform === 'android' ? config.autoAndroid : config.autoWeb))
      throw new AppError(409,'Activează modul automat pentru această platformă.');
  } else {
    await verifyPublishedRelease(proof);
  }
  const key = 'mail-release:' + platform + ':' + version.toLowerCase();
  return db().transaction(async tx => {
    const [campaign] = await tx.select().from(s.mailCampaigns).where(eq(s.mailCampaigns.id, id)).for('update');
    if (!campaign || campaign.template !== 'release_news' || campaign.category !== 'promotional')
      throw new AppError(404, 'Alege o ciornă AutoCare News.');
    const [existing] = await tx.select().from(s.settings).where(sql`${s.settings.key} = ${key} or
      (${s.settings.key} = ${'mail-release:' + version.toLowerCase()} and
       ((${s.settings.value}->'proof' ? 'android') = ${platform === 'android'}))`);
    if (existing) {
      if ((existing.value as { campaignId?: string }).campaignId === id) return { scheduled: true };
      throw new AppError(409, 'Versiunea are deja un anunț publicat.');
    }
    if (campaign.source !== 'manual' || campaign.status !== 'draft') throw new AppError(409, 'Anunțul nu mai este o ciornă.');
    if (campaign.message === emailTemplates.release_news.body)
      throw new AppError(400, 'Completează funcțiile și schimbările reale ale versiunii.');
    const englishRow=(await tx.select().from(s.settings).where(eq(s.settings.key,'mail-english:'+id)))[0];
    const english=englishMailSchema.safeParse(englishRow?.value);
    if (!english.success) throw new AppError(400, 'Completează și notele aprobate în limba engleză.');
    const reserved = await tx.insert(s.settings).values({ key, value: { version, releaseDate, campaignId: id, proof, mode } })
      .onConflictDoNothing().returning({ key: s.settings.key });
    if (!reserved.length) throw new AppError(409, 'Versiunea are deja un anunț publicat.');
    await tx.update(s.mailCampaigns).set({
      source: 'automation', actorId: uid, status: 'held', ctaPath:'/cont', ctaLabel:'Deschide AutoCare',
      scheduledAt: null,
      message: `Versiunea ${version} · ${releaseDate}\n\n${campaign.message}`,
    }).where(eq(s.mailCampaigns.id, id));
    await tx.update(s.settings).set({value:{...english.data,message:`Version ${version} · ${releaseDate}\n\n${english.data.message}`,ctaLabel:'Open AutoCare'}}).where(eq(s.settings.key,'mail-english:'+id));
    await tx.insert(s.audit).values({ id: crypto.randomUUID(), actorId: uid, action: 'mail.release.scheduled', target: id });
    return { scheduled: true };
  });
}
export async function deliverAutomatedMail(now = new Date()) {
  if (!(await automationState()).enabled) return { enabled: false, accepted: 0 };
  if (!(await gmailReady().catch(() => false))) return { enabled: true, accepted: 0, blocked: 'GMAIL_TEST_REQUIRED' };
  const settings = await automationSettings();
  const campaigns = await db()
    .select({ id: s.mailCampaigns.id })
    .from(s.mailCampaigns)
    .where(
      and(
        eq(s.mailCampaigns.source, 'automation'),
        inArray(s.mailCampaigns.status, ['held', 'sending']),
        sql`(${s.mailCampaigns.scheduledAt} is null or ${s.mailCampaigns.scheduledAt} <= ${now.toISOString()}::timestamptz)`,
        sql`(${s.mailCampaigns.template} not in ('welcome','vehicle_added') or ${settings.welcome})
          and (${s.mailCampaigns.template} <> 'monthly_report' or ${settings.monthly})
          and (${s.mailCampaigns.template} <> 'premium_grant' or ${settings.premium})
          and (${s.mailCampaigns.template} not in ('support_reply', 'support_received', 'support_resolved') or ${settings.support})`,
        sql`exists (select 1 from ${s.mailDeliveries}
          where ${s.mailDeliveries.campaignId} = ${s.mailCampaigns.id}
          and ((${s.mailDeliveries.status} in ('held','pending') and ${eligibleAutomationDelivery(s.mailCampaigns.template, now)})
            or (${s.mailDeliveries.status} = 'sending' and ${s.mailDeliveries.attemptedAt} < ${new Date(now.getTime()-120000).toISOString()}::timestamptz)))`,
        sql`(${s.mailCampaigns.template} <> 'release_news' or exists (
          select 1 from ${s.settings} where ${s.settings.key} like 'mail-release:%'
          and ${s.settings.value}->>'campaignId' = ${s.mailCampaigns.id}
          and ${s.settings.value}->'proof' is not null
          and case when (${s.settings.value}->'proof' ? 'android')
            then ${settings.releaseAndroid} and (${s.settings.value}->>'mode' is distinct from 'auto' or ${settings.autoAndroid})
            else ${settings.releaseWeb} and (${s.settings.value}->>'mode' is distinct from 'auto' or ${settings.autoWeb}) end
          and ${s.settings.value}->>'releaseDate' <= to_char(now() at time zone 'Europe/Bucharest', 'YYYY-MM-DD')
        ))`,
      ),
    )
    .orderBy(s.mailCampaigns.createdAt)
    .limit(4);
  if(!campaigns.length)return {enabled:true,accepted:0};
  await verifyGoogleMailAuthorization();
  const results = await Promise.all(campaigns.map(campaign=>deliverCampaign(campaign.id, undefined, now)));
  return {enabled:true, accepted:results.reduce((sum,r)=>sum+r.accepted,0),
    remaining:results.some(result=>'remaining' in result && result.remaining)};

}

export async function approveMailAutomation(uid: string, input: unknown) {
  const actor = await requireMailStaff(uid);
  if (!actor.directSend) throw new AppError(403, 'Trimite cererea Fondatorului pentru aprobare.');
  z.union([z.object({ confirmEnable: z.literal(true) }).strict(), z.object({ confirmAllTemplatesTested: z.literal(true), confirmInboxDeliveryVerified: z.literal(true) }).strict()]).parse(input);
  if (!(await gmailReady()))
    throw new AppError(409, 'Finalizează mai întâi testul Gmail și verificarea livrării.');
  const approvedAt = new Date().toISOString();
  await db().transaction(async (tx) => {
    await tx
      .insert(s.settings)
      .values({
        key: 'mail-automation-approval',
        value: { approvedBy: uid, approvedAt, testedAt: approvedAt },
      })
      .onConflictDoUpdate({
        target: s.settings.key,
        set: { value: { approvedBy: uid, approvedAt, testedAt: approvedAt } },
      });
    await tx.insert(s.audit).values({
      id: crypto.randomUUID(),
      actorId: uid,
      action: 'mail.automation.test-approved',
      target: 'mail-center',
    });
  });
  await db().delete(s.settings).where(sql`${s.settings.key} LIKE 'mail-automation-request:%'`);
  return automationState();
}
