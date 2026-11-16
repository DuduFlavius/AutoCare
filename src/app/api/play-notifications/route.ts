import {OAuth2Client} from 'google-auth-library';
import {createHash} from 'node:crypto';
import {eq} from 'drizzle-orm';
import {db} from '@/lib/db';
import {playSubscriptions} from '@/lib/schema';
import {verifyPlayPurchase} from '@/lib/play-billing';
export const runtime='nodejs';
/** Google Pub/Sub authenticated push only; never trusts a body-supplied user or expiry. */
export async function POST(request:Request){
 const audience=process.env.AUTOCARE_PLAY_RTDN_AUDIENCE,email=process.env.AUTOCARE_PLAY_RTDN_EMAIL;
 if(!audience||!email)return new Response(null,{status:503});
 try{
  const bearer=request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if(!bearer)return new Response(null,{status:401});
  const ticket=await new OAuth2Client().verifyIdToken({idToken:bearer,audience});
  const claims=ticket.getPayload();
  if(claims?.email!==email||!claims.email_verified)return new Response(null,{status:403});
  const text=await request.text();if(text.length>32000)return new Response(null,{status:413});
  const body=JSON.parse(text),notification=JSON.parse(Buffer.from(body.message?.data||'','base64').toString());
  if(notification.packageName!=='ro.autocare.garage')return new Response(null,{status:400});
  if(notification.testNotification)return Response.json({ok:true});
  const token=notification.subscriptionNotification?.purchaseToken;
  if(typeof token!=='string'||token.length>4096)return new Response(null,{status:400});
  const hash=createHash('sha256').update(token).digest('hex');
  const subscription=(await db().select().from(playSubscriptions).where(eq(playSubscriptions.tokenHash,hash)))[0];
  if(subscription)await verifyPlayPurchase(subscription.userId,token);
  return Response.json({ok:true});
 }catch{return new Response(null,{status:503});}
}
