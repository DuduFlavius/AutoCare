import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {eq} from 'drizzle-orm';
import {migrate} from '../scripts/migrate';
import {db,closeLocalDb} from '../src/lib/db';
import * as s from '../src/lib/schema';
import {auth} from '../src/lib/auth';
import {createVehicle,saveRecord,saveProfile,dashboard} from '../src/lib/service';
import {scheduleReminders,deliverReminders} from '../src/lib/reminders';
process.env.LOCAL_DATABASE_PATH='memory';process.env.APP_URL='http://localhost:3000';process.env.BETTER_AUTH_SECRET='renewal-test-isolated-secret-32-characters-long';process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION='false';
after(closeLocalDb);
test('Free RCA/vignette renewals persist and all five reminders deduplicate; opted-out channels and old revisions never deliver',async()=>{
 await migrate();
 const response=await auth().handler(new Request('http://localhost:3000/api/auth/sign-up/email',{method:'POST',headers:{Origin:'http://localhost:3000','Content-Type':'application/json'},body:JSON.stringify({name:'Renewal test',email:'renewal@example.invalid',password:'renewal-test-password-123'})}));assert.equal(response.status,200);
 const user=(await db().select().from(s.user).where(eq(s.user.email,'renewal@example.invalid')))[0];await db().update(s.user).set({emailVerified:true}).where(eq(s.user.id,user.id));
 await saveProfile(user.id,{timezone:'Europe/Bucharest',emailEnabled:true,pushEnabled:true,offsets:[30,15,7,1,0],hour:9,afterExpiry:false});
 const car=await createVehicle(user.id,{brand:'Test',model:'Renewals',plate:'TM11TST',year:2024,fuel:'Benzină',odometer:1000});
 const record=await saveRecord(user.id,{kind:'document',vehicleId:car.id,category:'RCA',title:'RCA',date:'2026-01-01',expiresAt:'2026-12-31',amountBani:0});
 for(const n of [30,15,7,1,0]){
  const now=new Date(Date.parse('2026-12-31T12:00:00Z')-n*86400000);
  assert.equal(await scheduleReminders(now),2);assert.equal(await scheduleReminders(now),0);
  assert.equal(await deliverReminders(now,async()=> 'test-provider-'+n),2);
 }
 const alerts=await db().select().from(s.notifications).where(eq(s.notifications.recordId,record.id));assert.equal(alerts.length,15);
 assert.equal(alerts.filter(n=>n.channel==='app').length,5);
 await saveRecord(user.id,{kind:'document',vehicleId:car.id,category:'RCA',title:'RCA renewed',date:'2026-12-31',expiresAt:'2027-12-31',amountBani:0},record.id);
 const saved=await dashboard(user.id);assert.equal(saved.records.find(r=>r.id===record.id)?.expiresAt,'2027-12-31');assert.equal(saved.records.find(r=>r.id===record.id)?.revision,2);
 await saveProfile(user.id,{timezone:'Europe/Bucharest',emailEnabled:false,pushEnabled:false,offsets:[30,15,7,1,0],hour:9,afterExpiry:false});
 await saveRecord(user.id,{kind:'document',vehicleId:car.id,category:'Rovinietă',title:'Rovinietă',date:'2026-01-01',expiresAt:'2026-12-31',amountBani:0});
 assert.equal(await scheduleReminders(new Date('2026-12-31T12:00:00Z')),0);
 const after=await db().select().from(s.notifications);assert.equal(after.filter(n=>n.channel==='app').length,6);
 assert.equal(await deliverReminders(new Date('2026-12-31T12:00:00Z'),async()=>{throw Error('Disabled channels must not deliver');}),0);
});
