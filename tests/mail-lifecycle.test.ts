import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { eq } from 'drizzle-orm';
import { db, closeLocalDb } from '../src/lib/db';
import { migrate } from '../scripts/migrate';
import * as s from '../src/lib/schema';
import { automationOverview, automationSettings, saveAutomationSettings } from '../src/lib/mail-lifecycle';
import { automationState, queueAutomatedMail } from '../src/lib/mail-automation';
import { deliverCampaign } from '../src/lib/mail-center';
import { GoogleDeliveryError } from '../src/lib/google-mail';

process.env.LOCAL_DATABASE_PATH = 'memory';
process.env.APP_URL = 'https://local-lifecycle.test';
process.env.BETTER_AUTH_SECRET = 'isolated-mail-lifecycle-tests-only-auth-secret';
process.env.AUTOCARE_MAIL_AUTOMATIONS_ENABLED = 'true';
const founder = crypto.randomUUID();
const user = crypto.randomUUID();
process.env.AUTOCARE_FOUNDER_USER_ID = founder;

before(async()=>{
  await migrate();
  await db().insert(s.user).values([
    {id:founder,name:'Operator test',email:'operator@example.invalid',emailVerified:true},
    {id:user,name:'Avery',email:'avery@example.invalid',emailVerified:true},
  ]);
  await db().insert(s.profiles).values([{userId:founder},{userId:user}]);
  await db().insert(s.settings).values([
    {key:'mail-automation-approval',value:{approvedBy:founder,approvedAt:'2026-11-26',testedAt:'2026-11-26'}},
    {key:'interface-language:'+user,value:{language:'en'}},
  ]);
});
after(closeLocalDb);

test('only Founder can change automation settings; pause protects persisted queue; retry retains a single English delivery',async()=>{
  const config=await automationSettings();
  assert.equal(config.autoWeb,false);
  assert.equal(config.autoAndroid,false);
  await assert.rejects(()=>saveAutomationSettings(user,{...config,welcome:false}),{status:403});
  await saveAutomationSettings(founder,{...config,welcome:false});
  const key='welcome:'+user;
  await queueAutomatedMail(user,'welcome',key);
  const [delivery]=await db().select().from(s.mailDeliveries).where(eq(s.mailDeliveries.dedupeKey,key));
  let calls=0;
  const transport=async(address:string,content:{subject:string;text:string;html:string})=>{
    calls++;
    assert.equal(address,'avery@example.invalid');
    assert.match(content.html,/<html lang="en">/);
    assert.match(content.text,/Hello, Avery!/);
    assert.match(content.text,/Contact support/);
    if (calls===1) throw new GoogleDeliveryError('failed','GMAIL_HTTP_429');
    return 'isolated-provider-id';
  };
  await deliverCampaign(delivery.campaignId,transport);
  assert.equal(calls,0);
  assert.equal((await automationOverview()).stats.welcome.pending,1);
  await saveAutomationSettings(founder,config);
  const now=new Date();
  await deliverCampaign(delivery.campaignId,transport,now);
  await deliverCampaign(delivery.campaignId,transport,new Date(+now+10*60000));
  assert.equal(calls,1);
  await deliverCampaign(delivery.campaignId,transport,new Date(+now+16*60000));
  await deliverCampaign(delivery.campaignId,transport,new Date(+now+16*60000));
  assert.equal(calls,2);
  const overview=await automationOverview();
  assert.equal(overview.stats.welcome.accepted,1);
  assert.equal(overview.stats.welcome.delivered,0);
});

test('Vercel Preview cannot run automations even with a completed approval',async()=>{
  const old=process.env.VERCEL_ENV;
  try {
    process.env.VERCEL_ENV='preview';
    assert.equal((await automationState()).enabled,false);
  } finally {
    if (old===undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV=old;
  }
});
