import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {eq} from 'drizzle-orm';
import {migrate} from '../scripts/migrate';
import {db,closeLocalDb} from '../src/lib/db';
import * as s from '../src/lib/schema';
import {sendNativePush} from '../src/lib/native-push';
process.env.LOCAL_DATABASE_PATH='memory';
const owner=crypto.randomUUID(),other=crypto.randomUUID();
before(async()=>{
  await migrate();
  for(const id of [owner,other])await db().insert(s.user).values({id,name:'Test',email:id+'@example.invalid',emailVerified:true});
});
after(closeLocalDb);
test('Android delivery stays scoped, displays in background and removes revoked tokens without logging them',async()=>{
  process.env.AUTOCARE_FIREBASE_SERVICE_ACCOUNT='test-only-injected-sender';
  for(const [token,userId] of [['valid',owner],['revoked',owner],['other-device',other]])await db().insert(s.nativePushTokens).values({token,userId});
  const received:string[]=[];
  const count=await sendNativePush(owner,{id:'notice-1',title:'AutoCare',body:'Open your account'},async message=>{
    assert.ok('token' in message);received.push(message.token);
    assert.equal(message.android?.notification?.channelId,'autocare-updates');
    assert.equal(message.android?.notification?.tag,'notice-1');
    assert.equal(message.notification?.body,'Open your account');
    if(message.token==='revoked')throw Object.assign(Error('revoked'),{code:'messaging/registration-token-not-registered'});
    return 'accepted';
  });
  assert.equal(count,1);assert.deepEqual(received.sort(),['revoked','valid']);
  const tokens=await db().select().from(s.nativePushTokens);
  assert.deepEqual(tokens.map(row=>row.token).sort(),['other-device','valid']);
  await db().delete(s.user).where(eq(s.user.id,owner));
  assert.equal((await db().select().from(s.nativePushTokens)).length,1);
});
test('Missing provider configuration is explicit and an account with no Android devices is unaffected',async()=>{
  delete process.env.AUTOCARE_FIREBASE_SERVICE_ACCOUNT;
  assert.equal(await sendNativePush('no-devices',{id:'n',title:'t',body:'b'}),0);
  await assert.rejects(()=>sendNativePush(other,{id:'n',title:'t',body:'b'}),/NATIVE_PUSH_NOT_CONFIGURED/);
});
