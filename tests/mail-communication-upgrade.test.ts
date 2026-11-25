import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Webhook } from 'svix';
import { migrate } from '../scripts/migrate';
import { closeLocalDb, db } from '../src/lib/db';
import * as s from '../src/lib/schema';
import * as center from '../src/lib/mail-center';
import { emailSuppressed, unsubscribeLink } from '../src/lib/mail-consent';
import { monthlyVehicleReport } from '../src/lib/mail-monthly-report';
import { scheduleMonthlyVehicleMail } from '../src/lib/mail-automation';
import { renderEmail } from '../src/lib/email-templates';
import { emailWebhook } from '../src/lib/email-events';
import { verifyPublishedRelease } from '../src/lib/mail-release-proof';
import { GET, POST } from '../src/app/api/email/unsubscribe/route';

delete process.env.DATABASE_URL;
process.env.LOCAL_DATABASE_PATH='memory';
process.env.APP_URL='https://www.autocareapp.ro';
process.env.BETTER_AUTH_SECRET='isolated-email-communication-qa-secret';
const founder='mail-qa-founder', uid='mail-qa-client', outsider='mail-qa-outsider', vehicle='qa-car';
const email=uid+'@example.invalid';
process.env.AUTOCARE_FOUNDER_USER_ID=founder;
before(async()=>{
  await migrate();
  for(const id of [founder,uid,outsider]){
    await db().insert(s.user).values({id,name:'QA account',email:id+'@example.invalid',emailVerified:true});
    await db().insert(s.profiles).values({userId:id});
  }
});
after(closeLocalDb);

test('new marketing and reports default off and one-click POST opts out without a session',async()=>{
  const original=await center.getCommunicationPreference(uid);
  assert.equal(original.categories.releases,false);
  assert.equal(original.categories.monthly,false);
  await center.saveCommunicationPreference(uid,{transactional:true,promotional:false,
    categories:{...original.categories,releases:true,news:true,offers:true,monthly:true}});
  const link=unsubscribeLink(uid,email,false);
  assert.equal((await GET(new Request(link))).status,200);
  assert.equal((await center.getCommunicationPreference(uid)).categories.releases,true);
  assert.equal((await POST(new Request(link+'x',{method:'POST'}))).status,400);
  for(let i=0;i<2;i++) assert.equal((await POST(new Request(link,{method:'POST'}))).status,200);
  const final=await center.getCommunicationPreference(uid);
  assert.equal(final.categories.releases,false);
  assert.equal(final.categories.news,false);
  assert.equal(final.categories.offers,false);
  assert.equal(final.categories.monthly,true);
  const audit=await db().select().from(s.mailConsents).where(eq(s.mailConsents.userId,uid));
  assert.equal(audit.filter(entry=>entry.source==='unsubscribe').length,1);
});

test('monthly vehicle report aggregates only verified owner data and queues once per period',async()=>{
  await db().insert(s.vehicles).values({id:vehicle,userId:uid,brand:'Dacia',model:'Logan',year:2020,plate:'QA 000',fuel:'Benzină',odometer:10500});
  await db().insert(s.vehicles).values({id:'qa-outsider-car',userId:outsider,brand:'Test',model:'Other',year:2020,plate:'QA 999',fuel:'Benzină'});
  const entries = [
    {id:'current',userId:uid,vehicleId:vehicle,kind:'expense',category:'Combustibil',title:'Alimentare',amountBani:16700,date:'2029-12-16'},
    {id:'previous',userId:uid,vehicleId:vehicle,kind:'expense',category:'Combustibil',title:'Alimentare',amountBani:11500,date:'2029-11-16'},
    {id:'other',userId:outsider,vehicleId:'qa-outsider-car',kind:'expense',category:'Combustibil',title:'Alimentare',amountBani:999999,date:'2029-12-16'},
    {id:'document',userId:uid,vehicleId:vehicle,kind:'document',category:'RCA',title:'RCA',expiresAt:'2030-01-24',amountKnown:false},
  ];
  await db().insert(s.records).values(entries);
  await db().insert(s.gpsTrips).values({id:'qa-trip',userId:uid,vehicleId:vehicle,distanceMeters:12300,durationSeconds:1200,startedAt:new Date('2029-12-16T10:00:00Z'),endedAt:new Date('2029-12-16T10:20:00Z')});
  const now=new Date('2030-01-12T10:00:00Z');
  const report=await monthlyVehicleReport(uid,'2029-12','ro',now);
  assert.ok(report);
  assert.equal(report.trend?.length,2);
  assert.ok(report.facts?.some(fact=>fact.value==='12,3 km'));
  assert.match(renderEmail('monthly_report',report).text,/167,00/);
  assert.doesNotMatch(renderEmail('monthly_report',report).text,/9.999|QA 000/);
  assert.equal(await monthlyVehicleReport(uid,'2029-11','ro',now),null);
  assert.equal(await scheduleMonthlyVehicleMail(now),1);
  assert.equal(await scheduleMonthlyVehicleMail(now),0);
});

test('staff segment resolves verified accounts and only Founder schedules or cancels drafts',async()=>{
  const audience={segment:'garage',template:'administrative',category:'transactional'};
  await assert.rejects(center.countSegment(outsider,audience), /autorizate/);
  assert.deepEqual(await center.countSegment(founder,audience),{count:2});
  const id=crypto.randomUUID();
  assert.equal((await center.saveCampaign(founder,{id,...audience,subject:'Schimbare importantă',
    message:'Detalii despre disponibilitatea serviciului.',ctaPath:'/cont',ctaLabel:'Deschide contul'})).count,2);
  const at=new Date(Date.now()+86400000).toISOString();
  await assert.rejects(center.scheduleCampaign(outsider,id,{at}));
  await center.scheduleCampaign(founder,id,{at});
  let deliveries=0;
  const transport=async()=>{deliveries++;return 'qa-provider';};
  await center.deliverCampaign(id,transport);
  await center.cancelCampaign(founder,id);
  await center.deliverCampaign(id,transport,new Date(Date.now()+2*86400000));
  const detail=await center.campaignDetail(founder,id);
  assert.equal(detail.campaign.status,'cancelled');
  assert.ok(detail.deliveries.every(row=>row.status==='suppressed'));
  assert.equal(deliveries,0);
});

test('signed bounce and spam complaint events suppress delivery and duplicate events are idempotent',async()=>{
  const secret=Buffer.from('isolated-qa-webhook-signing-secret').toString('base64');
  process.env.RESEND_WEBHOOK_SECRET='whsec_'+secret;
  const ex='qa-feedback@example.invalid';
  const raw=JSON.stringify({type:'email.complained',data:{email_id:'provider-complaint',to:[ex]}});
  const timestamp=new Date();
  const signed=new Webhook(process.env.RESEND_WEBHOOK_SECRET).sign('qa-event',timestamp,raw);
  const headers=new Headers({'svix-id':'qa-event','svix-timestamp':String(Math.floor(timestamp.getTime()/1000)),'svix-signature':signed});
  await assert.rejects(emailWebhook(raw+' ',headers),/Semnătură/);
  assert.equal(await emailSuppressed(ex),false);
  await emailWebhook(raw,headers);
  await emailWebhook(raw,headers);
  assert.equal(await emailSuppressed(ex),true);
  assert.equal((await db().select().from(s.emailEvents).where(eq(s.emailEvents.id,'qa-event'))).length,1);
});

test('release proof binds the live commit and published APK bytes',async()=>{
  const commit='a'.repeat(40), apk='qa bytes for APK hash matching';
  const proof={commit,testsPassed:true as const,android:{version:'1.7.5',sha256:createHash('sha256').update(apk).digest('hex'),signatureVerified:true as const}};
  const provider:typeof fetch=async(input)=>{
    const {pathname}=new URL(String(input));
    if(pathname==='/api/app-version')return Response.json({version:commit});
    if(pathname==='/api/android-update')return Response.json({available:true,version:'1.7.5',url:'/downloads/AutoCare-1.7.5.apk'});
    return new Response(apk);
  };
  await verifyPublishedRelease(proof,provider);
  await assert.rejects(verifyPublishedRelease({...proof,commit:'b'.repeat(40)},provider),/producție/);
  await assert.rejects(verifyPublishedRelease({...proof,android:{...proof.android,sha256:'b'.repeat(64)}},provider),/producție/);
});
