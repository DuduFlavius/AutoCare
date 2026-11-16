import {createHash} from 'node:crypto';
import {GoogleAuth} from 'google-auth-library';
import {and,eq,gt} from 'drizzle-orm';
import {db} from './db';
import * as s from './schema';
const packageName='ro.autocare.garage';
export const playAccountId=(uid:string)=>createHash('sha256').update('autocare-play:'+uid).digest('hex');
export function playProducts() {
  return {monthly:process.env.AUTOCARE_PLAY_MONTHLY_PRODUCT,quarterly:process.env.AUTOCARE_PLAY_QUARTERLY_PRODUCT,annual:process.env.AUTOCARE_PLAY_ANNUAL_PRODUCT};
}
export function playBillingConfigured(){return process.env.AUTOCARE_PLAY_BILLING_ENABLED==='true' && !!process.env.AUTOCARE_PLAY_SERVICE_ACCOUNT && !!process.env.AUTOCARE_PLAY_RTDN_AUDIENCE && !!process.env.AUTOCARE_PLAY_RTDN_EMAIL && Object.values(playProducts()).every(Boolean);}
export async function activePlaySubscriptions(uid:string,now=new Date()) {
  return db().select().from(s.playSubscriptions).where(and(eq(s.playSubscriptions.userId,uid),eq(s.playSubscriptions.active,true),gt(s.playSubscriptions.expiresAt,now)));
}
export type PlayPurchase={subscriptionState?:string;acknowledgementState?:string;externalAccountIdentifiers?:{obfuscatedExternalAccountId?:string};lineItems?:{productId?:string;expiryTime?:string}[]};
export function verifiedPlayEntitlement(uid:string,purchase:PlayPurchase,products:string[],now=new Date()) {
  if(purchase.externalAccountIdentifiers?.obfuscatedExternalAccountId!==playAccountId(uid))throw Error('PLAY_ACCOUNT_MISMATCH');
  const item=purchase.lineItems?.find(item=>!!item.productId&&products.includes(item.productId));
  if(!item?.expiryTime)throw Error('PLAY_PRODUCT_MISMATCH');
  const expiresAt=new Date(item.expiryTime);
  if(!Number.isFinite(expiresAt.getTime()))throw Error('PLAY_INVALID_EXPIRY');
  const active=['SUBSCRIPTION_STATE_ACTIVE','SUBSCRIPTION_STATE_IN_GRACE_PERIOD','SUBSCRIPTION_STATE_CANCELED'].includes(purchase.subscriptionState||'')&&expiresAt>now;
  return {productId:item.productId!,expiresAt,active};
}
async function publisher(path:string,method='GET') {
  const auth=new GoogleAuth({credentials:JSON.parse(process.env.AUTOCARE_PLAY_SERVICE_ACCOUNT||'{}'),scopes:['https://www.googleapis.com/auth/androidpublisher']});
  const client=await auth.getClient();
  return (await client.request<PlayPurchase>({url:'https://androidpublisher.googleapis.com/androidpublisher/v3/applications/'+packageName+'/purchases/'+path,method:method as 'GET'|'POST',...(method==='POST'?{data:{}}:{})})).data;
}
export async function verifyPlayPurchase(uid:string,token:string) {
  if(!playBillingConfigured())throw Error('PLAY_NOT_CONFIGURED');
  const purchase=await publisher('subscriptionsv2/tokens/'+encodeURIComponent(token));
  const value=verifiedPlayEntitlement(uid,purchase,Object.values(playProducts()).filter((v):v is string=>!!v));
  const tokenHash=createHash('sha256').update(token).digest('hex');
  // Acknowledge only verified, completed purchases. Pending purchases never unlock Premium.
  if(value.active && purchase.acknowledgementState==='ACKNOWLEDGEMENT_STATE_PENDING')await publisher('subscriptions/'+encodeURIComponent(value.productId)+'/tokens/'+encodeURIComponent(token)+':acknowledge','POST');
  await db().transaction(async tx=>{
    await tx.select().from(s.user).where(eq(s.user.id,uid)).for('update');
    const old=(await tx.select().from(s.playSubscriptions).where(eq(s.playSubscriptions.tokenHash,tokenHash)))[0];
    if(old&&old.userId!==uid)throw Error('PLAY_ACCOUNT_MISMATCH');
    await tx.insert(s.playSubscriptions).values({tokenHash,userId:uid,...value,updatedAt:new Date()}).onConflictDoUpdate({target:s.playSubscriptions.tokenHash,set:{...value,updatedAt:new Date()}});
  });
  return {active:value.active,expiresAt:value.expiresAt};
}
