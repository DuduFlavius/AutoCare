import { and, eq } from 'drizzle-orm';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { db } from './db';
import { nativePushTokens } from './schema';

export function nativePushConfigured() { return !!process.env.AUTOCARE_FIREBASE_SERVICE_ACCOUNT; }
function messaging() {
  const name = 'autocare-push';
  const app = getApps().find(app => app.name === name) ?? initializeApp({
    credential: cert(JSON.parse(process.env.AUTOCARE_FIREBASE_SERVICE_ACCOUNT || '{}')),
  }, name);
  return getMessaging(app);
}
/** Notification payloads are displayed by Android while the WebView is suspended. */
export async function sendNativePush(uid: string, payload: {id:string;title:string;body:string}, send = (message: Parameters<ReturnType<typeof getMessaging>['send']>[0]) => messaging().send(message)) {
  const tokens = await db().select().from(nativePushTokens).where(eq(nativePushTokens.userId, uid));
  if (!tokens.length) return 0;
  if (!nativePushConfigured()) throw new Error('NATIVE_PUSH_NOT_CONFIGURED');
  let accepted = 0;
  for (const row of tokens) {
    try {
      await send({token:row.token,notification:{title:payload.title,body:payload.body},
        data:{notificationId:payload.id,url:'/cont?tab=Notific%C4%83ri'},
        android:{priority:'high',ttl:3600000,notification:{channelId:'autocare-updates',tag:payload.id}}});
      accepted++;
    } catch (error) {
      const code = (error as {code?:string}).code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        await db().delete(nativePushTokens).where(and(eq(nativePushTokens.token,row.token),eq(nativePushTokens.userId,uid)));
      } else throw new Error('NATIVE_PUSH_PROVIDER_ERROR', {cause:error});
    }
  }
  return accepted;
}
