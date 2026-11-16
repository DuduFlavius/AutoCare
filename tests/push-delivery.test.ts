import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import webpush from 'web-push';
import {migrate} from '../scripts/migrate';
import {db,closeLocalDb} from '../src/lib/db';
import * as s from '../src/lib/schema';
import {sendPushNotification} from '../src/lib/reminders';
process.env.LOCAL_DATABASE_PATH='memory';
const uid=crypto.randomUUID(),original=webpush.sendNotification;
before(async()=>{
 await migrate();
 await db().insert(s.user).values({id:uid,name:'Push test',email:uid+'@example.invalid',emailVerified:true});
 await db().insert(s.nativePushTokens).values({userId:uid,token:'test-native-token'});
 for(const id of ['broken','healthy'])await db().insert(s.pushes).values({id,userId:uid,endpoint:'https://push.example.invalid/'+id,keys:{p256dh:'test',auth:'test'}});
 const keys=webpush.generateVAPIDKeys();process.env.VAPID_PUBLIC_KEY=keys.publicKey;process.env.VAPID_PRIVATE_KEY=keys.privateKey;process.env.VAPID_SUBJECT='https://example.invalid';delete process.env.AUTOCARE_FIREBASE_SERVICE_ACCOUNT;
});
after(async()=>{webpush.sendNotification=original;await closeLocalDb();});
test('Android configuration failure and one broken browser do not block another subscribed browser',async()=>{
 const endpoints:string[]=[];
 webpush.sendNotification=async subscription=>{endpoints.push(subscription.endpoint);if(subscription.endpoint.endsWith('/broken'))throw Object.assign(Error('unavailable'),{statusCode:503});return {statusCode:201,body:'',headers:{}};};
 assert.equal(await sendPushNotification(uid,{id:'test-notice',title:'Test',body:'Synthetic fixture'}),'push-accepted');
 assert.equal(endpoints.length,2);assert.ok(endpoints.some(url=>url.endsWith('/healthy')));
});
test('Total browser provider failure stays retryable instead of being marked accepted',async()=>{
 webpush.sendNotification=async()=>{throw Object.assign(Error('unavailable'),{statusCode:503});};
 await assert.rejects(sendPushNotification(uid,{id:'test-retry',title:'Test',body:'Synthetic fixture'}),/PUSH_PROVIDER_ERROR/);
});
