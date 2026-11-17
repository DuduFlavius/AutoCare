import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {eq} from 'drizzle-orm';
import {PDFDocument} from 'pdf-lib';
import {migrate} from '../scripts/migrate';
import {db,closeLocalDb} from '../src/lib/db';
import * as s from '../src/lib/schema';
import {auth} from '../src/lib/auth';
import * as svc from '../src/lib/service';
import {GET} from '../src/app/api/v1/[...path]/route';
delete process.env.DATABASE_URL;delete process.env.VERCEL;
process.env.LOCAL_DATABASE_PATH='memory';process.env.APP_URL='http://localhost:3000';process.env.BETTER_AUTH_SECRET='document-download-test-secret-over-32-characters';process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION='false';
after(closeLocalDb);
test('private file downloads preserve PDF bytes and use the current document category and real dates for all policies',async()=>{
 await migrate();
 const signed=await auth().handler(new Request('http://localhost:3000/api/auth/sign-up/email',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({name:'Document Test',email:'document-test@example.invalid',password:'document-test-password-123'})}));assert.equal(signed.status,200);
 const cookie=signed.headers.getSetCookie().map(v=>v.split(';')[0]).join('; '),user=(await db().select().from(s.user).where(eq(s.user.email,'document-test@example.invalid')))[0];
 const car=await svc.createVehicle(user.id,{brand:'Test',model:'Documents',plate:'TM52RVX',year:2024,fuel:'Benzină',odometer:10000});
 const payload={kind:'document',vehicleId:car.id,category:'ITP',title:'ITP',date:'2026-11-17',expiresAt:'2027-11-17',amountBani:0};
 const record=await svc.saveRecord(user.id,payload),pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());
 const file=await svc.uploadFile(user.id,record.id,{name:'scan-original.pdf',bytes});
 const fetchFile=(view=false,authenticated=true)=>GET(new Request('http://localhost:3000/api/v1/files/'+file.id+(view?'?view=1':''),{headers:authenticated?{Cookie:cookie}:{}}),{params:Promise.resolve({path:['files',file.id]})});
 for(const category of ['ITP','RCA','CASCO','Rovinietă']){
  await svc.saveRecord(user.id,{...payload,category,title:category},record.id);
  const response=await fetchFile();assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');
  const disposition=response.headers.get('content-disposition')!;assert.match(disposition,/^attachment;/);assert.ok(decodeURIComponent(disposition).includes('TM52RVX '+category+' emis 17.11.2026 expira 17.11.2027.pdf'));assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes);
 }
 const inline=await fetchFile(true);assert.match(inline.headers.get('content-disposition')!,/^inline;/);assert.match(inline.headers.get('cache-control')!,/private, no-store/);assert.equal(inline.headers.get('x-content-type-options'),'nosniff');
 assert.equal((await fetchFile(false,false)).status,401);
});
