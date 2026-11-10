import { and, desc, eq, inArray, sql } from 'drizzle-orm';
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
import { automationState } from './mail-automation';
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
      .min(1)
      .max(50)
      .transform((x) => [...new Set(x)].sort()),
  })
  .strict();
export async function saveCommunicationPreference(uid: string, input: unknown) {
  await assertActiveAccount(uid);
  const prefs = z
    .object({ transactional: z.boolean(), promotional: z.boolean() })
    .strict()
    .parse(input);
  await db()
    .insert(s.communicationPreferences)
    .values({ userId: uid, ...prefs })
    .onConflictDoUpdate({
      target: s.communicationPreferences.userId,
      set: { ...prefs, updatedAt: new Date() },
    });
  return prefs;
}
export async function getCommunicationPreference(uid: string) {
  await assertActiveAccount(uid);
  return communicationPreference(uid);
}
const libraryEntrySchema = z.object({
  id: z.uuid(), kind: z.enum(['template', 'communication']),
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
  if (['verification', 'password_reset', 'gmail_test'].includes(entry.template))
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
        transactional: s.communicationPreferences.transactional,
      })
      .from(s.user)
      .leftJoin(s.profiles, eq(s.user.id, s.profiles.userId))
      .leftJoin(s.communicationPreferences, eq(s.user.id, s.communicationPreferences.userId))
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
  return {
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
  };
}
export async function previewMail(uid: string, input: unknown) {
  await requireMailStaff(uid);
  const data = z
    .object({
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
    return renderEmail(data.template, data);
  } catch {
    throw new AppError(400, 'Linkul CTA trebuie să fie o adresă din AutoCare.');
  }
}
export async function saveCampaign(uid: string, input: unknown) {
  await requireMailStaff(uid);
  const data = inputSchema.parse(input);
  if (['verification', 'password_reset', 'gmail_test'].includes(data.template))
    throw new AppError(
      400,
      'Acest șablon se trimite exclusiv din fluxul securizat dedicat. Poți vedea previzualizarea aici.',
    );
  if (templateCategory(data.template) === 'promotional' && data.category !== 'promotional')
    throw new AppError(400, 'Șablonul promoțional necesită categoria promoțională.');
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
    const users = await tx
      .select({ id: s.user.id })
      .from(s.user)
      .where(inArray(s.user.id, data.recipients));
    if (users.length !== data.recipients.length)
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
    await tx.insert(s.settings).values({ key: 'mail-kind:' + data.id, value: { label: data.communicationType } });
    await tx.insert(s.mailDeliveries).values(
      data.recipients.map((userId) => ({
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
    return { id: data.id, duplicate: false };
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
  const kind = (await db().select().from(s.settings).where(eq(s.settings.key, 'mail-kind:' + id)))[0]?.value as { label?: string } | undefined;
  return { campaign, deliveries, communicationType: kind?.label || 'Informare cont' };
}
export type MailTransport = (to: string, content: EmailContent, id: string) => Promise<string>;
export async function deliverCampaign(
  id: string,
  transport: MailTransport = sendGoogleMail,
  now = new Date(),
) {
  const campaign = (await db().select().from(s.mailCampaigns).where(eq(s.mailCampaigns.id, id)))[0];
  if (!campaign) return { accepted: 0 };
  if (campaign.source === 'manual' && campaign.actorId) {
    const author = await requireMailStaff(campaign.actorId);
    if (!author.directSend && !(await campaignApproved(id, campaign.fingerprint))) return { accepted: 0, held: true };
  }
  if (campaign.source === 'automation' && !(await automationState()).enabled)
    return { accepted: 0, held: true };
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
        sql`(${s.mailDeliveries.error} is distinct from 'GMAIL_HTTP_429' or ${s.mailDeliveries.attemptedAt} <= ${new Date(now.getTime() - 15 * 60000).toISOString()}::timestamptz)`,
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
          and(eq(s.mailDeliveries.id, candidate.id), eq(s.mailDeliveries.status, candidate.status)),
        )
        .returning();
      if (!claimed.length) return;
      if (
        (campaign.source === 'automation' &&
          campaign.template === 'welcome' &&
          now.getTime() - campaign.createdAt.getTime() > 86400000) ||
        !(await recipientAllowed(candidate.userId, campaign.category, campaign.source === 'manual')) ||
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
        const content = renderEmail(campaign.template as EmailTemplate, {
          name: user.name,
          subject: campaign.subject,
          message: campaign.message,
          ctaLabel: campaign.ctaLabel,
          ctaPath: campaign.ctaPath,
          promotional: campaign.category === 'promotional',
        });
        const providerId = await transport(user.email, content, candidate.id);
        await db()
          .update(s.mailDeliveries)
          .set({ status: 'accepted', providerId, error: null })
          .where(eq(s.mailDeliveries.id, candidate.id));
        accepted++;
      } catch (e) {
        const retryCount = candidate.context.retryCount ?? 0;
        const retry = campaign.source === 'automation' && e instanceof GoogleDeliveryError
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
    .where(eq(s.mailCampaigns.id, id));
  return { accepted, remaining: !!remaining.length };
}
export async function sendCampaign(uid: string, id: string) {
  await requireMailStaff(uid);
  const { campaign } = await campaignDetail(uid, id);
  if (campaign.template === 'release_news') throw new AppError(400, 'Publică lansarea prin AutoCare News.');
  if (campaign.source !== 'manual')
    throw new AppError(403, 'Automatizările necesită aprobarea și activarea separată.');
  const actor = await requireMailStaff(uid);
  if (!actor.directSend && !(await campaignApproved(id, campaign.fingerprint))) {
    await requestCampaignApproval(uid, id);
    throw new AppError(403, 'Comunicarea a fost trimisă Fondatorului pentru aprobare.');
  }
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
  if (!actor.directSend && !(await campaignApproved(id, campaign.fingerprint))) throw new AppError(403, 'Este necesară aprobarea Fondatorului.');
  const requeued = await db().update(s.mailDeliveries).set({status:'pending',error:null,attemptedAt:null})
    .where(and(eq(s.mailDeliveries.campaignId,id),eq(s.mailDeliveries.status,'failed'),sql`${s.mailDeliveries.providerId} IS NULL`)).returning({id:s.mailDeliveries.id});
  if (requeued.length) await db().update(s.mailCampaigns).set({status:'draft'}).where(eq(s.mailCampaigns.id,id));
  await db().insert(s.audit).values({id:crypto.randomUUID(),actorId:uid,action:'mail.failed.requeued',target:id});
  return { requeued: requeued.length };
}
export async function publishReleaseNews(uid: string, id: string, input: unknown) {
  await requireFounder(uid);
  const { version, releaseDate } = z.object({
    version: z.string().trim().regex(/^[0-9][A-Za-z0-9.+-]{0,39}$/),
    releaseDate: z.iso.date(),
  }).strict().parse(input);
  if (!(await automationState()).enabled || !(await gmailReady()))
    throw new AppError(409, 'Activează automatizările și verifică expeditorul înainte de publicare.');
  const key = 'mail-release:' + version.toLowerCase();
  return db().transaction(async tx => {
    const [campaign] = await tx.select().from(s.mailCampaigns).where(eq(s.mailCampaigns.id, id)).for('update');
    if (!campaign || campaign.template !== 'release_news' || campaign.category !== 'promotional' || campaign.source !== 'manual')
      throw new AppError(404, 'Alege o ciornă AutoCare News.');
    const [existing] = await tx.select().from(s.settings).where(eq(s.settings.key, key));
    if (existing) {
      if ((existing.value as { campaignId?: string }).campaignId === id) return { scheduled: true };
      throw new AppError(409, 'Versiunea are deja un anunț publicat.');
    }
    if (campaign.status !== 'draft') throw new AppError(409, 'Anunțul nu mai este o ciornă.');
    if (campaign.message === emailTemplates.release_news.body)
      throw new AppError(400, 'Completează funcțiile și schimbările reale ale versiunii.');
    const reserved = await tx.insert(s.settings).values({ key, value: { version, releaseDate, campaignId: id } })
      .onConflictDoNothing().returning({ key: s.settings.key });
    if (!reserved.length) throw new AppError(409, 'Versiunea are deja un anunț publicat.');
    await tx.update(s.mailCampaigns).set({
      source: 'automation', actorId: uid, status: 'held',
      message: `Versiunea ${version} · ${releaseDate}\n\n${campaign.message}`,
    }).where(eq(s.mailCampaigns.id, id));
    await tx.insert(s.audit).values({ id: crypto.randomUUID(), actorId: uid, action: 'mail.release.scheduled', target: id });
    return { scheduled: true };
  });
}
export async function deliverAutomatedMail() {
  if (!(await automationState()).enabled) return { enabled: false, accepted: 0 };
  if (!(await gmailReady().catch(() => false))) return { enabled: true, accepted: 0, blocked: 'GMAIL_TEST_REQUIRED' };
  const campaigns = await db()
    .select({ id: s.mailCampaigns.id })
    .from(s.mailCampaigns)
    .where(
      and(
        eq(s.mailCampaigns.source, 'automation'),
        inArray(s.mailCampaigns.status, ['held', 'sending']),
        sql`(${s.mailCampaigns.template} <> 'release_news' or exists (
          select 1 from ${s.settings} where ${s.settings.key} like 'mail-release:%'
          and ${s.settings.value}->>'campaignId' = ${s.mailCampaigns.id}
          and ${s.settings.value}->>'releaseDate' <= to_char(now() at time zone 'Europe/Bucharest', 'YYYY-MM-DD')
        ))`,
      ),
    )
    .orderBy(s.mailCampaigns.createdAt)
    .limit(1);
  return campaigns.length ? deliverCampaign(campaigns[0].id) : { enabled: true, accepted: 0 };
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
