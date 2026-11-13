import {and,eq,gte} from 'drizzle-orm';
import {db} from './db';
import {mailCampaigns} from './schema';
import {deliverAutomatedMail,deliverCampaign} from './mail-center';
import {gmailReady,verifyGoogleMailAuthorization} from './google-mail';
/** Resume only explicitly started manual campaigns, or approved event-driven automations. */
export async function dispatchMailSafely(){
 try{
  const [manual]=await db().select({id:mailCampaigns.id}).from(mailCampaigns).where(and(eq(mailCampaigns.source,'manual'),eq(mailCampaigns.status,'sending'),gte(mailCampaigns.createdAt,new Date(Date.now()-86400000)))).limit(1);
  if(!manual)return await deliverAutomatedMail();
  if(!(await gmailReady()))return {accepted:0,blocked:'GMAIL_TEST_REQUIRED'};
  await verifyGoogleMailAuthorization();
  return await deliverCampaign(manual.id);
 }catch{console.error(JSON.stringify({event:'autocare_mail_dispatch',status:'retry_pending'}));return {accepted:0,blocked:'RETRY_PENDING'};}
}
