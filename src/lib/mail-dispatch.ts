import { and, eq, lte, or } from 'drizzle-orm';
import { db } from './db';
import { mailCampaigns } from './schema';
import { deliverAutomatedMail, deliverCampaign } from './mail-center';
import { gmailReady, verifyGoogleMailAuthorization } from './google-mail';

/** Work is claimed durably on each authenticated scheduler invocation. */
export async function dispatchMailSafely(now = new Date()) {
  try {
    const [scheduled] = await db().select({id:mailCampaigns.id}).from(mailCampaigns)
      .where(and(eq(mailCampaigns.source,'manual'),lte(mailCampaigns.scheduledAt,now),
        or(eq(mailCampaigns.status,'scheduled'),eq(mailCampaigns.status,'sending'))))
      .orderBy(mailCampaigns.scheduledAt).limit(1);
    if (!scheduled) return await deliverAutomatedMail();
    if (!(await gmailReady())) return {accepted:0,blocked:'GMAIL_TEST_REQUIRED'};
    await verifyGoogleMailAuthorization();
    const result = await deliverCampaign(scheduled.id,undefined,now);
    if (result.accepted === 0) return await deliverAutomatedMail();
    return result;
  } catch {
    console.error(JSON.stringify({event:'autocare_mail_dispatch',status:'RETRY_PENDING'}));
    return {accepted:0,blocked:'RETRY_PENDING'};
  }
}
