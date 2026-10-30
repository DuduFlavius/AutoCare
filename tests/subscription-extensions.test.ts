import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {eq} from 'drizzle-orm';
import {migrate} from '../scripts/migrate';
import {db,closeLocalDb} from '../src/lib/db';
import * as s from '../src/lib/schema';
import {auth} from '../src/lib/auth';
import {profile,premium,dashboard} from '../src/lib/service';
import {extensionCheckout,extensionEvent} from '../src/lib/subscription-extensions';
import {addPaidMonths} from '../src/lib/paid-coverage';
delete process.env.DATABASE_URL;delete process.env.VERCEL;process.env.LOCAL_DATABASE_PATH='memory';process.env.BETTER_AUTH_SECRET='isolated-extensions-test-secret-32-characters';process.env.APP_URL='http://localhost:3000';process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION='false';
let uid='',paidEnd:Date;const sessions=new Map<string,Stripe.Checkout.Session>(),updates:Array<Record<string,unknown>>=[];
let remoteEnd=0;let failSync=false;
const client={checkout:{sessions:{create:async (params:Stripe.Checkout.SessionCreateParams)=>{const id='cs_'+crypto.randomUUID();const session={id,mode:'payment',payment_status:'paid',currency:'ron',amount_total:params.line_items![0].price_data!.unit_amount,client_reference_id:uid,metadata:params.metadata,livemode:false,payment_intent:'pi_'+id,url:'https://checkout.stripe.com/test'} as Stripe.Checkout.Session;sessions.set(id,session);return session;},retrieve:async(id:string)=>sessions.get(id),expire:async(id:string)=>{sessions.get(id)!.status='expired';return sessions.get(id)}}},subscriptions:{retrieve:async()=>({id:'sub_existing',metadata:{userId:uid},status:'active',trial_end:remoteEnd}),update:async(_id:string,params:Record<string,unknown>)=>{if(failSync)throw Error('temporary Stripe outage');updates.push(params);remoteEnd=Number(params.trial_end);return{id:'sub_existing'};}}} as unknown as Stripe;
function event(id:string):Stripe.Event{return{id:'evt_'+crypto.randomUUID(),type:'checkout.session.completed',livemode:false,data:{object:{id}}} as Stripe.Event;}
async function purchase(months=1,amount=15000){const before=new Set(sessions.keys());await extensionCheckout(uid,months,amount,client);return [...sessions.keys()].find(k=>!before.has(k))!;}
before(async()=>{await migrate();await auth().handler(new Request('http://localhost:3000/api/auth/sign-up/email',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({name:'Extensions QA',email:'extensions@autocare.invalid',password:'isolated-password-1234'})}));uid=(await db().select().from(s.user).where(eq(s.user.email,'extensions@autocare.invalid')))[0].id;await profile(uid);paidEnd=addPaidMonths(new Date(),1);await db().insert(s.subscriptions).values({userId:uid,customerId:'cus_existing',subscriptionId:'sub_existing',status:'active',periodEnd:paidEnd});});
after(closeLocalDb);
test('calendar months clamp leap years and preserve time of day',()=>{assert.equal(addPaidMonths(new Date('2028-01-31T12:30:00Z'),1).toISOString(),'2028-02-29T12:30:00.000Z');assert.equal(addPaidMonths(new Date('2027-01-31T12:30:00Z'),1).toISOString(),'2027-02-28T12:30:00.000Z');});
test('two purchases in the same month stack after the existing paid deadline and delay recurring billing without another subscription',async()=>{
 const first=await purchase(),evt=event(first);await extensionEvent(evt,client);
 const one=(await db().select().from(s.subscriptionExtensions).where(eq(s.subscriptionExtensions.sessionId,first)))[0];assert.equal(one.startsAt!.getTime(),paidEnd.getTime());assert.equal(one.endsAt!.getTime(),addPaidMonths(paidEnd,1).getTime());assert.equal(await premium(uid),true);
 const second=await purchase();await extensionEvent(event(second),client);const two=(await db().select().from(s.subscriptionExtensions).where(eq(s.subscriptionExtensions.sessionId,second)))[0];assert.equal(two.startsAt!.getTime(),one.endsAt!.getTime());assert.equal(two.endsAt!.getTime(),addPaidMonths(one.endsAt!,1).getTime());assert.equal(remoteEnd,Math.floor(two.endsAt!.getTime()/1000));assert.equal(updates[0].proration_behavior,'none');assert.equal((await db().select().from(s.subscriptions)).length,1);
 await extensionEvent(evt,client);await extensionEvent(event(second),client);assert.equal((await db().select().from(s.invoices)).length,2);
 await db().update(s.subscriptions).set({status:'trialing',periodEnd:two.endsAt}).where(eq(s.subscriptions.userId,uid));assert.equal(await premium(uid),true);const data=await dashboard(uid);assert.equal(data.premiumAccess.paidUntil.getTime(),two.endsAt!.getTime());
});
test('an abandoned checkout is reused for the same plan and safely replaced when changing the period',async()=>{
 const pending=await purchase();sessions.get(pending)!.payment_status='unpaid';sessions.get(pending)!.status='open';const count=sessions.size;await extensionCheckout(uid,1,15000,client);assert.equal(sessions.size,count);
 await extensionCheckout(uid,3,45000,client);assert.equal(sessions.get(pending)!.status,'expired');const next=[...sessions.keys()].at(-1)!;assert.notEqual(next,pending);await extensionEvent(event(next),client);
});
test('unpaid or wrong-amount sessions never add access, and interrupted billing synchronization retries the same dates',async()=>{
 const pending=await purchase();sessions.get(pending)!.payment_status='unpaid';await extensionEvent(event(pending),client);assert.equal((await db().select().from(s.subscriptionExtensions).where(eq(s.subscriptionExtensions.sessionId,pending)))[0].status,'pending');
 sessions.get(pending)!.payment_status='paid';sessions.get(pending)!.amount_total=1;await assert.rejects(extensionEvent(event(pending),client));
 sessions.get(pending)!.payment_status='unpaid';sessions.get(pending)!.status='expired';
 const retry=await purchase();failSync=true;await assert.rejects(extensionEvent(event(retry),client));const first=(await db().select().from(s.subscriptionExtensions).where(eq(s.subscriptionExtensions.sessionId,retry)))[0];assert.equal(first.status,'processing');failSync=false;await extensionEvent(event(retry),client);const second=(await db().select().from(s.subscriptionExtensions).where(eq(s.subscriptionExtensions.sessionId,retry)))[0];assert.equal(first.endsAt!.getTime(),second.endsAt!.getTime());assert.equal(second.status,'paid');
});
test('refund revokes its purchased period and unverified trial status never unlocks Premium by itself',async()=>{
 const rows=await db().select().from(s.subscriptionExtensions).where(eq(s.subscriptionExtensions.userId,uid));for(const row of rows.filter(r=>r.status==='paid'))await extensionEvent({id:'evt_refund_'+row.id,type:'charge.refunded',livemode:false,data:{object:{refunded:true,payment_intent:row.paymentIntent}}} as Stripe.Event,client);
 assert.equal(await premium(uid),false);
});

test('billing reconciliation and extension endpoints require a real authenticated session',async()=>{const {POST}=await import('../src/app/api/v1/[...path]/route');for(const path of ['billing/sync','billing/extend']){const res=await POST(new Request('http://localhost:3000/api/v1/'+path,{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({interval:'monthly'})}),{params:Promise.resolve({path:path.split('/')})});assert.equal(res.status,401);}});
