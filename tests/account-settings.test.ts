import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {eq,and} from 'drizzle-orm';
import {migrate} from '../scripts/migrate';
import {db,closeLocalDb} from '../src/lib/db';
import * as s from '../src/lib/schema';
import {auth} from '../src/lib/auth';
import {GET,PUT} from '../src/app/api/v1/[...path]/route';
import {sendSupportMessage} from '../src/lib/support-chat';
import {saveRecord,createVehicle} from '../src/lib/service';
import {scheduleReminders,deliverReminders} from '../src/lib/reminders';
process.env.LOCAL_DATABASE_PATH='memory';process.env.APP_URL='http://localhost:3000';process.env.BETTER_AUTH_SECRET='account-settings-test-only-secret-32-characters';process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION='true';process.env.RESEND_API_KEY='test-only';process.env.EMAIL_FROM='test@example.invalid';
const originalFetch=globalThis.fetch,mails:{to:string[];text:string}[]=[],people:{id:string;cookie:string;email:string;role:string}[]=[];
const password='account-settings-password-123';
async function request(path:string,body?:unknown,cookie=''){
 return auth().handler(new Request('http://localhost:3000/api/auth/'+path,{method:body?'POST':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie,'x-real-ip':'127.0.0.1'},body:body?JSON.stringify(body):undefined}));
}
async function api(cookie:string,body?:unknown){const r=new Request('http://localhost:3000/api/v1/account/settings',{method:body?'PUT':'GET',headers:{Origin:'http://localhost:3000','Content-Type':'application/json',Cookie:cookie},body:body?JSON.stringify(body):undefined});return (body?PUT:GET)(r,{params:Promise.resolve({path:['account','settings']})});}
function verifyURL(){return mails.at(-1)!.text.match(/http:\/\/localhost:3000\/api\/auth\/verify-email[^\s]+/)![0];}
before(async()=>{
 globalThis.fetch=async(input,init)=>{assert.equal(String(input),'https://api.resend.com/emails');mails.push(JSON.parse(String(init?.body)));return Response.json({id:'test-mail-'+mails.length});};
 await migrate();
 for(const [index,role] of ['founder','admin','assistant','user'].entries()){
  await db().delete(s.rateLimit);
  const email='role'+index+'@example.invalid';
  assert.equal((await request('sign-up/email',{email,password,name:'Role '+index})).status,200);
  await auth().handler(new Request(verifyURL()));
  const response=await request('sign-in/email',{email,password});assert.equal(response.status,200);
  const id=(await db().select().from(s.user).where(eq(s.user.email,email)))[0].id;
  await db().insert(s.profiles).values({userId:id,role});
  if(role==='founder')process.env.AUTOCARE_FOUNDER_USER_ID=id;
  people.push({id,email,role,cookie:response.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')});
 }
});
after(async()=>{globalThis.fetch=originalFetch;await closeLocalDb();});
test('Account settings isolate each of four roles, reject role/owner injection and persist explicit category preferences',async()=>{
 assert.equal((await api('')).status,401);
 for(const person of people){
  const response=await api(person.cookie);assert.equal(response.status,200);const value=await response.json();assert.equal(value.email,person.email);assert.deepEqual(value.providers,['credential']);assert.ok(value.createdAt);
  const input={firstName:'Test',lastName:'Account',alerts:{itp:false,rca:true,rovinieta:true,service:true,chat:false,updates:true,account:true}};
  assert.equal((await api(person.cookie,{...input,userId:people[0].id,role:'founder'})).status,400);
  assert.equal((await api(person.cookie,input)).status,200);
  assert.equal((await (await api(person.cookie)).json()).alerts.itp,false);
  assert.equal((await db().select().from(s.profiles).where(eq(s.profiles.userId,person.id)))[0].role,person.role);
 }
});
test('Changing display name synchronizes existing support messages without allowing a role change',async()=>{
 const customer=people[3],thread=await sendSupportMessage(customer.id,{message:'A real test-only message'});
 const response=await request('update-user',{name:'Updated display name'},customer.cookie);assert.equal(response.status,200);
 const message=(await db().select().from(s.supportChatMessages).where(and(eq(s.supportChatMessages.threadId,thread.threadId),eq(s.supportChatMessages.authorId,customer.id))))[0];
 assert.equal(message.authorName,'Updated display name');assert.equal(message.authorRole,'user');
});
test('Email change waits for old-address approval and new-address verification, keeps the same user and notifies the old address',async()=>{
 const customer=people[3],newEmail='changed@example.invalid';
 assert.equal((await request('change-email',{newEmail,callbackURL:'/cont'},customer.cookie)).status,200);
 assert.deepEqual(mails.at(-1)!.to,[customer.email]);
 assert.equal((await db().select().from(s.user).where(eq(s.user.id,customer.id)))[0].email,customer.email);
 await auth().handler(new Request(verifyURL(),{headers:{Cookie:customer.cookie}}));
 assert.deepEqual(mails.at(-1)!.to,[newEmail]);
 assert.equal((await db().select().from(s.user).where(eq(s.user.id,customer.id)))[0].email,customer.email);
 const response=await auth().handler(new Request(verifyURL(),{headers:{Cookie:customer.cookie}}));assert.ok([200,302].includes(response.status));
 assert.equal((await db().select().from(s.user).where(eq(s.user.id,customer.id)))[0].email,newEmail);
 assert.deepEqual(mails.at(-1)!.to,[customer.email]);assert.match(mails.at(-1)!.text,/schimbată/);
 assert.equal((await db().select().from(s.user).where(eq(s.user.email,newEmail))).length,1);
});
test('Fifteen-day document reminders respect category opt-out at scheduling and again before transport',async()=>{
 const customer=people[0],now=new Date('2030-03-10T12:00:00Z');
 const car=await createVehicle(customer.id,{brand:'Test',model:'Only',plate:'TEST15',year:2020,fuel:'Diesel',odometer:1000});
 await saveRecord(customer.id,{vehicleId:car.id,kind:'document',category:'ITP',title:'ITP test',expiresAt:'2030-03-25'});
 await scheduleReminders(now);
 assert.equal((await db().select().from(s.notifications).where(eq(s.notifications.userId,customer.id))).length,0);
 const prefs=await (await api(customer.cookie)).json();prefs.alerts.itp=true;await api(customer.cookie,{firstName:prefs.firstName,lastName:prefs.lastName,alerts:prefs.alerts});
 await db().update(s.profiles).set({emailEnabled:true,pushEnabled:true}).where(eq(s.profiles.userId,customer.id));
 await scheduleReminders(now);
 const notices=await db().select().from(s.notifications).where(eq(s.notifications.userId,customer.id));assert.ok(notices.some(n=>n.offset==='15'));
 prefs.alerts.itp=false;await api(customer.cookie,{firstName:prefs.firstName,lastName:prefs.lastName,alerts:prefs.alerts});
 let attempts=0;await deliverReminders(now,async()=>{attempts++;return 'not-expected';});assert.equal(attempts,0);
});
