import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { db } from './db';
import * as s from './schema';
import { requireFounder } from './founder';
import { AppError, assertActiveAccount } from './service';
import {
  emailTemplates,
  renderEmail,
  appLink,
  type EmailTemplate,
  type EmailContent,
} from './email-templates';
import { gmailReady, GoogleDeliveryError, sendGoogleMail } from './google-mail';
import { billingMailValid, communicationPreference, recipientAllowed } from './mail-policy';
import { automationState } from './mail-automation';
const templateIds = Object.keys(emailTemplates) as [EmailTemplate, ...EmailTemplate[]];
const inputSchema = z
  .object({
    id: z.uuid(),
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
export async function mailCenterOverview(uid: string) {
  await requireFounder(uid);
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
    templates: emailTemplates,
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
  await requireFounder(uid);
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
  await requireFounder(uid);
  const data = inputSchema.parse(input);
  if (['verification', 'password_reset', 'gmail_test'].includes(data.template))
    throw new AppError(
      400,
      'Acest șablon se trimite exclusiv din fluxul securizat dedicat. Poți vedea previzualizarea aici.',
    );
  if (data.template === 'promotional' && data.category !== 'promotional')
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
  await requireFounder(uid);
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
  return { campaign, deliveries };
}
export type MailTransport = (to: string, content: EmailContent, id: string) => Promise<string>;
export async function deliverCampaign(
  id: string,
  transport: MailTransport = sendGoogleMail,
  now = new Date(),
) {
  const campaign = (await db().select().from(s.mailCampaigns).where(eq(s.mailCampaigns.id, id)))[0];
  if (!campaign) return { accepted: 0 };
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
        await db()
          .update(s.mailDeliveries)
          .set({
            status: e instanceof GoogleDeliveryError ? e.deliveryStatus : 'unknown',
            error: e instanceof GoogleDeliveryError ? e.code : 'DELIVERY_UNCONFIRMED',
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
  await requireFounder(uid);
  const { campaign } = await campaignDetail(uid, id);
  if (campaign.source !== 'manual')
    throw new AppError(403, 'Automatizările necesită aprobarea și activarea separată.');
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
export async function deliverAutomatedMail() {
  if (!(await automationState()).enabled) return { enabled: false, accepted: 0 };
  if (!(await gmailReady())) return { enabled: true, accepted: 0, blocked: 'GMAIL_TEST_REQUIRED' };
  const campaigns = await db()
    .select({ id: s.mailCampaigns.id })
    .from(s.mailCampaigns)
    .where(
      and(
        eq(s.mailCampaigns.source, 'automation'),
        inArray(s.mailCampaigns.status, ['held', 'sending']),
      ),
    )
    .orderBy(s.mailCampaigns.createdAt)
    .limit(1);
  return campaigns.length ? deliverCampaign(campaigns[0].id) : { enabled: true, accepted: 0 };
}

export async function approveMailAutomation(uid: string, input: unknown) {
  await requireFounder(uid);
  z.object({
    confirmAllTemplatesTested: z.literal(true),
    confirmInboxDeliveryVerified: z.literal(true),
  })
    .strict()
    .parse(input);
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
  return automationState();
}
