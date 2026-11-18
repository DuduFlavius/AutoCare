import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {eq,sql} from 'drizzle-orm';
import {migrate} from '../scripts/migrate';
import {db,closeLocalDb} from '../src/lib/db';
import * as s from '../src/lib/schema';
import {auth} from '../src/lib/auth';
process.env.LOCAL_DATABASE_PATH='memory';process.env.APP_URL='http://localhost:3000';process.env.BETTER_AUTH_SECRET='email-identity-test-only-secret-more-than-32';process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION='true';process.env.RESEND_API_KEY='test';process.env.EMAIL_FROM='test@example.invalid';
const password='Test-only-secure-password-2026',originalFetch=globalThis.fetch,mails:{to:string[];text:string;html:string}[]=[];
async function request(path:string,body?:unknown,cookie='',origin='http://localhost:3000') {await db().delete(s.rateLimit);return auth().handler(new Request('http://localhost:3000/api/auth/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie,'x-real-ip':'127.0.0.1'},body:body?JSON.stringify(body):undefined}));}
const otp=()=>mails.at(-1)!.text.match(/(?:este|is): (\d{6})/)![1];
const cookie=(r:Response)=>r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
async function signup(email:string){return request('sign-up/email',{email,name:'Synthetic test',password});}
before(async()=>{await migrate();globalThis.fetch=async(input,init)=>{assert.equal(String(input),'https://api.resend.com/emails');mails.push(JSON.parse(String(init?.body)));return Response.json({id:'synthetic-'+mails.length});};});
after(async()=>{globalThis.fetch=originalFetch;await closeLocalDb();});
test('Signup requires a hashed expiring email code; rejects wrong codes and consumes the correct one once',async()=>{
 const email='new@example.invalid',r=await signup(' New@Example.invalid ');assert.equal(r.status,200);assert.equal((await r.json()).token,null);assert.equal(r.headers.get('set-cookie'),null);
 const person=(await db().select().from(s.user).where(eq(s.user.email,email)))[0];assert.equal(person.emailVerified,false);assert.deepEqual(mails.at(-1)!.to,[email]);const code=otp();assert.match(code,/^\d{6}$/);
 const token=(await db().select().from(s.verification).where(eq(s.verification.identifier,'email-verification-otp-'+email)))[0];assert.ok(token);assert.ok(!token.value.startsWith(code+':'));assert.ok(token.expiresAt.getTime()-Date.now()>590000);assert.match(mails.at(-1)!.html,/letter-spacing:8px/);
 assert.equal((await request('sign-in/email',{email,password})).status,403);
 assert.equal((await request('email-otp/verify-email',{email,otp:'abcdef'})).status,400);
 assert.equal((await db().select().from(s.user).where(eq(s.user.id,person.id)))[0].emailVerified,false);
 const verified=await request('email-otp/verify-email',{email,otp:code});assert.equal(verified.status,200);assert.ok(cookie(verified));assert.equal((await db().select().from(s.user).where(eq(s.user.id,person.id)))[0].emailVerified,true);
 assert.equal((await request('email-otp/verify-email',{email,otp:code})).status,400);assert.equal((await request('sign-in/email',{email,password})).status,200);
 assert.equal((await request('email-otp/send-verification-otp',{email,type:'email-verification'})).status,400);
});
test('Duplicate and case-variant emails are rejected by auth and by the database; change email cannot reuse an address',async()=>{
 const r=await signup('NEW@example.invalid');assert.equal(r.status,409);assert.equal((await r.json()).code,'USER_ALREADY_EXISTS');
 await assert.rejects(()=>db().insert(s.user).values({id:crypto.randomUUID(),name:'Duplicate',email:'NEW@EXAMPLE.INVALID'}));
 assert.equal((await db().select().from(s.user).where(sql`lower(${s.user.email})='new@example.invalid'`)).length,1);
 await signup('other@example.invalid');const code=otp();const verified=await request('email-otp/verify-email',{email:'other@example.invalid',otp:code});
 const change=await request('change-email',{newEmail:' NEW@example.invalid ',callbackURL:'/cont'},cookie(verified));assert.equal(change.status,409);
 assert.equal((await db().select().from(s.user).where(eq(s.user.email,'other@example.invalid'))).length,1);
});
test('Expired, exhausted and superseded codes cannot verify; resend and origin protection work',async()=>{
 const email='retry@example.invalid';await signup(email);const first=otp();await db().update(s.verification).set({expiresAt:new Date(Date.now()-1000)}).where(eq(s.verification.identifier,'email-verification-otp-'+email));
 assert.equal((await request('email-otp/verify-email',{email,otp:first})).status,400);
 assert.equal((await request('email-otp/send-verification-otp',{email,type:'email-verification'})).status,200);const second=otp();
 for(let i=0;i<5;i++)assert.ok((await request('email-otp/verify-email',{email,otp:'WRONG'})).status>=400);
 assert.ok((await request('email-otp/verify-email',{email,otp:second})).status>=400);
 assert.equal((await request('email-otp/send-verification-otp',{email,type:'email-verification'},'','https://evil.invalid')).status,403);
 await request('email-otp/send-verification-otp',{email,type:'email-verification'});const third=otp();assert.equal((await request('email-otp/verify-email',{email,otp:third})).status,200);
});
test('Resending replaces the usable code and server rate limits repeated sends',async()=>{
 const email='resend@example.invalid';await signup(email);const old=otp();await request('email-otp/send-verification-otp',{email,type:'email-verification'});const latest=otp();if(old!==latest)assert.equal((await request('email-otp/verify-email',{email,otp:old})).status,400);assert.equal((await request('email-otp/verify-email',{email,otp:latest})).status,200);
 const limited='limited@example.invalid';await signup(limited);await db().delete(s.rateLimit);
 for(let i=0;i<4;i++){const response=await auth().handler(new Request('http://localhost:3000/api/auth/email-otp/send-verification-otp',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json','x-real-ip':'127.0.0.1'},body:JSON.stringify({email:limited,type:'email-verification'})}));assert.equal(response.status,i<3?200:429);}
});
test('Confirmed account deletion removes the user, credentials, sessions, private data and codes; only then can email register again',async()=>{
 const email='delete@example.invalid';await signup(email);const verified=await request('email-otp/verify-email',{email,otp:otp()}),headers=cookie(verified);const person=(await db().select().from(s.user).where(eq(s.user.email,email)))[0];const vid=crypto.randomUUID(),rid=crypto.randomUUID(),fid=crypto.randomUUID();
 await db().insert(s.vehicles).values({id:vid,userId:person.id,brand:'Test',model:'Test',plate:'TEST',year:2020,fuel:'Diesel'});await db().insert(s.records).values({id:rid,userId:person.id,vehicleId:vid,kind:'document',category:'ITP',title:'Synthetic'});await db().insert(s.files).values({id:fid,userId:person.id,recordId:rid,name:'test.png',mime:'image/png',size:1,data:'AA=='});await db().insert(s.feedbackItems).values({id:crypto.randomUUID(),userId:person.id,clientId:crypto.randomUUID(),category:'suggestion',message:'Synthetic feedback content',fingerprint:'test'});await db().insert(s.verification).values({id:crypto.randomUUID(),identifier:'email-verification-otp-'+email,value:'hashed:0',expiresAt:new Date(Date.now()+60000)});
 const pending=await request('delete-user',{password,callbackURL:'/stergere-cont?completed=1'},headers);assert.equal(pending.status,200);assert.equal((await signup(email)).status,409);
 assert.equal((await db().select().from(s.user).where(eq(s.user.id,person.id))).length,1);
 const url=mails.at(-1)!.text.match(/http:\/\/localhost:3000\/api\/auth\/delete-user\/callback[^\s]+/)![0];const done=await auth().handler(new Request(url,{headers:{Cookie:headers}}));assert.ok([200,302].includes(done.status));
 for(const table of [s.account,s.session,s.vehicles,s.records,s.files,s.feedbackItems])assert.equal((await db().select().from(table).where(eq(table.userId,person.id))).length,0);
 assert.equal((await db().select().from(s.user).where(eq(s.user.email,email))).length,0);assert.equal((await db().select().from(s.verification).where(eq(s.verification.identifier,'email-verification-otp-'+email))).length,0);
 assert.equal((await signup(email)).status,200);const created=(await db().select().from(s.user).where(eq(s.user.email,email)))[0];assert.notEqual(created.id,person.id);assert.equal(created.emailVerified,false);
});
