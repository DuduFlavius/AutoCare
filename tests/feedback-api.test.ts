import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {eq} from 'drizzle-orm';
import {migrate} from '../scripts/migrate';
import {db,closeLocalDb} from '../src/lib/db';
import * as s from '../src/lib/schema';
import {auth} from '../src/lib/auth';
import {GET,POST} from '../src/app/api/v1/[...path]/route';
process.env.LOCAL_DATABASE_PATH='memory';process.env.APP_URL='http://localhost:3000';process.env.BETTER_AUTH_SECRET='feedback-api-isolated-secret-never-production-1234';process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION='false';delete process.env.AUTOCARE_FOUNDER_USER_ID;delete process.env.RESEND_API_KEY;
delete process.env.AUTOCARE_MAIL_AUTOMATIONS_ENABLED;
let cookie='',otherCookie='',uid='',other='';
async function signIn(email:string){
 const response=await auth().handler(new Request('http://localhost:3000/api/auth/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3000'},body:JSON.stringify({name:'Feedback Test',email,password:'Strong-test-only-password-12345'})}));assert.equal(response.status,200);
 const user=(await db().select().from(s.user).where(eq(s.user.email,email)))[0];
 const login=await auth().handler(new Request('http://localhost:3000/api/auth/sign-in/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost:3000'},body:JSON.stringify({email,password:'Strong-test-only-password-12345'})}));assert.equal(login.status,200);
 return {id:user.id,cookie:login.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')};
}
async function call(path:string,method='GET',body?:BodyInit,session=cookie,origin='http://localhost:3000'){
 const headers:Record<string,string>={Cookie:session,Origin:origin};if(body&&!(body instanceof FormData))headers['Content-Type']='application/json';
 const req=new Request('http://localhost:3000/api/v1/'+path,{method,headers,body});return (method==='GET'?GET:POST)(req,{params:Promise.resolve({path:path.split('?')[0].split('/')})});
}
before(async()=>{await migrate();const one=await signIn('feedback-one@example.invalid'),two=await signIn('feedback-two@example.invalid');cookie=one.cookie;uid=one.id;other=two.id;otherCookie=two.cookie;});
after(closeLocalDb);
test('Authenticated multipart feedback API saves a free-account submission and enforces CSRF and file privacy',async()=>{
 assert.equal((await call('feedback','GET',undefined,'')).status,401);
 assert.equal((await call('feedback','POST','{}',cookie,'http://untrusted.invalid')).status,403);
 const data=new FormData();data.set('payload',JSON.stringify({clientId:crypto.randomUUID(),category:'problem',area:'documents',rating:3,message:'Un raport de test trimis prin API cu o captură.'}));
 const image=await sharp({create:{width:10,height:10,channels:3,background:'#fff'}}).png().toBuffer();data.append('screenshots',new File([new Uint8Array(image)],'private-filename.png',{type:'image/png'}));
 const created=await call('feedback','POST',data);assert.equal(created.status,201);const {id}=await created.json();
 assert.equal((await call('feedback/'+id,'GET',undefined,otherCookie)).status,404);
 const detailResponse=await call('feedback/'+id);assert.equal(detailResponse.status,200);assert.equal(detailResponse.headers.get('Cache-Control'),'private, no-store');const detail=await detailResponse.json();assert.equal(detail.item.message,'Un raport de test trimis prin API cu o captură.');assert.equal(detail.files.length,1);assert.notEqual(detail.files[0].name,'private-filename.png');
 const file=await call('feedback/files/'+detail.files[0].id);assert.equal(file.status,200);assert.equal(file.headers.get('Content-Type'),'image/png');assert.equal(file.headers.get('X-Content-Type-Options'),'nosniff');assert.ok((await file.arrayBuffer()).byteLength>0);
 assert.equal((await call('feedback/files/'+detail.files[0].id,'GET',undefined,otherCookie)).status,404);
 assert.equal((await call('feedback?scope=admin')).status,403);assert.equal((await call('feedback/statistics')).status,403);
 await db().update(s.profiles).set({role:'admin'}).where(eq(s.profiles.userId,other));
 const adminList=await call('feedback?scope=admin','GET',undefined,otherCookie);assert.equal(adminList.status,200);assert.equal((await adminList.json()).total,1);
 assert.equal((await call('feedback/files/'+detail.files[0].id,'GET',undefined,otherCookie)).status,200);
 assert.equal((await db().select().from(s.feedbackItems).where(eq(s.feedbackItems.userId,uid))).length,1);
});
