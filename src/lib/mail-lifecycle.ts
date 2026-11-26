import { and, eq, sql, type SQLWrapper } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import { requireFounder } from './founder';
import type { ReleaseProof } from './mail-release-proof';
import { audit, jobRuns, mailCampaigns, mailDeliveries, notifications, records, settings, user } from './schema';

const lifecycleKey = 'mail-lifecycle-controls';
const controls = z.object({
  welcome:z.boolean(), releaseWeb:z.boolean(), releaseAndroid:z.boolean(),
  documents:z.boolean(), premium:z.boolean(), monthly:z.boolean(), support:z.boolean(),
  autoWeb:z.boolean().default(false), autoAndroid:z.boolean().default(false),
}).strict();
export type LifecycleControl = Exclude<keyof z.infer<typeof controls>, 'autoWeb' | 'autoAndroid'>;
const defaults = controls.parse({
  welcome:true, releaseWeb:true, releaseAndroid:true,
  documents:true, premium:true, monthly:true, support:true,
});

export async function automationSettings() {
  const [row] = await db().select({value:settings.value}).from(settings).where(eq(settings.key,lifecycleKey));
  const result = controls.partial().safeParse(row?.value ?? {});
  return {...defaults,...(result.success ? result.data : {})};
}

export async function saveAutomationSettings(uid: string, input: unknown) {
  await requireFounder(uid);
  const value = controls.parse(input);
  await db().transaction(async tx => {
    await tx.insert(settings).values({key:lifecycleKey,value}).onConflictDoUpdate({target:settings.key,set:{value}});
    await tx.insert(audit).values({id:crypto.randomUUID(),actorId:uid,action:'mail.lifecycle.updated',target:lifecycleKey});
  });
  return value;
}

export function releaseChannel(proof: ReleaseProof) { return proof.android ? 'android' : 'web'; }

export function automationGroup(template: string, channel?: 'web' | 'android'): LifecycleControl | undefined {
  if (template === 'release_news') return channel === 'android' ? 'releaseAndroid' : 'releaseWeb';
  if (template === 'welcome' || template === 'vehicle_added') return 'welcome';
  if (template === 'premium_grant') return 'premium';
  if (template === 'monthly_report') return 'monthly';
  if (['support_reply','support_received','support_resolved'].includes(template)) return 'support';
}

export async function readReleaseSettings(id: string) {
  const [row] = await db().select({value:settings.value}).from(settings)
    .where(sql`${settings.key} like 'mail-release:%' and ${settings.value}->>'campaignId' = ${id}`).limit(1);
  return row?.value as {proof?:ReleaseProof;releaseDate:string;mode?:'approval'|'auto'} | undefined;
}

/** Unverified welcome emails must wait without blocking the front of the persistent queue. */
export function eligibleAutomationDelivery(template: string | SQLWrapper, now: Date) {
  const time = now.toISOString();
  const expired = new Date(now.getTime()-14*86400000).toISOString();
  return sql`(
      ${template} <> 'welcome'
      or ${mailDeliveries.createdAt} < ${expired}::timestamptz
      or exists (select 1 from ${user} where ${user.id} = ${mailDeliveries.userId} and ${user.emailVerified})
    ) and (
      ${mailDeliveries.error} is distinct from 'GMAIL_HTTP_429'
      or ${mailDeliveries.attemptedAt} + (interval '15 minutes' * power(2,
        greatest(0, coalesce((${mailDeliveries.context}->>'retryCount')::int,1)-1))) <= ${time}::timestamptz
    )`;
}

export async function automationOverview() {
  const [configuration, deliveries, documentStats, jobs] = await Promise.all([
    automationSettings(),
    db().select({
      template:mailCampaigns.template, status:mailDeliveries.status,
      platform:sql<string|null>`max(case when ${settings.value}->'proof' ? 'android' then 'android' else 'web' end)`,
      campaignId:mailCampaigns.id, count:sql<number>`count(*)::int`,
      lastAttempt:sql<string|null>`max(${mailDeliveries.attemptedAt})::text`,
    }).from(mailCampaigns).innerJoin(mailDeliveries,eq(mailCampaigns.id,mailDeliveries.campaignId))
      .leftJoin(settings,sql`${settings.key} like 'mail-release:%' and ${settings.value}->>'campaignId' = ${mailCampaigns.id}`)
      .where(eq(mailCampaigns.source,'automation')).groupBy(mailCampaigns.id,mailCampaigns.template,mailDeliveries.status),
    db().select({
      status:notifications.status,count:sql<number>`count(*)::int`,
      lastAttempt:sql<string|null>`max(${notifications.lockedAt})::text`,
    }).from(notifications).innerJoin(records,eq(notifications.recordId,records.id))
      .where(and(eq(notifications.channel,'email'),eq(records.kind,'document'))).groupBy(notifications.status),
    db().select({status:jobRuns.status,time:sql<string|null>`max(${jobRuns.finishedAt})::text`})
      .from(jobRuns).where(eq(jobRuns.status,'completed')).groupBy(jobRuns.status),
  ]);
  const stats = Object.fromEntries(Object.keys(configuration).filter(key=>key!=='autoWeb'&&key!=='autoAndroid').map(key => [key,{
    pending:0, accepted:0, delivered:0, failed:0, suppressed:0, lastAttempt:null as string|null,
  }])) as Record<LifecycleControl,{pending:number;accepted:number;delivered:number;failed:number;suppressed:number;lastAttempt:string|null}>;
  function tally(key:LifecycleControl, row: {status:string;count:number;lastAttempt:string|null}) {
    const item = stats[key];
    if (['pending','held','retry','sending'].includes(row.status)) item.pending += row.count;
    if (['accepted','delivered'].includes(row.status)) item.accepted += row.count;
    if (row.status === 'delivered') item.delivered += row.count;
    if (['unknown','failed'].includes(row.status)) item.failed += row.count;
    if (['cancelled','suppressed'].includes(row.status)) item.suppressed += row.count;
    if (row.lastAttempt && (!item.lastAttempt || Date.parse(row.lastAttempt)>Date.parse(item.lastAttempt))) item.lastAttempt = row.lastAttempt;
  }
  for (const row of deliveries) {
    const key = automationGroup(row.template,row.platform === 'android' ? 'android' : 'web');
    if (key) tally(key,row);
  }
  for (const row of documentStats) tally('documents',row);
  return {configuration,stats,lastJob:jobs[0]?.time??null};
}
