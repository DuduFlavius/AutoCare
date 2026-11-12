import {test} from 'node:test';
import assert from 'node:assert/strict';
import {providerReadiness} from '../scripts/provider-readiness.mjs';
const env:Record<string,string>={STRIPE_SECRET_KEY:'sk_live_private_test_value',GEMINI_API_KEY:'private_gemini_test_value',STRIPE_WEBHOOK_SECRET:'private_webhook_test_value'};
const prices=new Map();
for(const [stem,interval,count,ron,eur] of [['MONTHLY','month',1,15000,3000],['QUARTERLY','month',3,45000,9000],['ANNUAL','year',1,170000,34000]])for(const [currency,amount] of [['ron',ron],['eur',eur]]){
 const id=`price_${stem}${currency}`;env[`STRIPE_${stem}${currency==='eur'?'_EUR':''}_PRICE_ID`]=id;prices.set(id,{active:true,type:'recurring',currency,unit_amount:amount,livemode:true,recurring:{interval,interval_count:count,usage_type:'licensed'}});
}
const mock=async(url:string|URL|Request,init?:RequestInit)=>{
 assert.notEqual(init?.method,'POST');assert.equal(init?.redirect,'error');
 const value=String(url);assert.ok(!value.includes('private_'));
 return Response.json(value.includes('googleapis.com')?{models:[{name:'models/gemini-2.5-flash-lite',supportedGenerationMethods:['generateContent']}]}:prices.get(value.split('/').at(-1)));
};
test('readiness validates all six catalog prices and AI model access without enabling payments or generating content',async()=>{
 const result=await providerReadiness(env,mock);
 assert.equal(result.stripe.status,'catalog_ready');assert.equal(result.stripe.checked,6);assert.equal(result.stripe.livePaymentsEnabled,false);assert.equal(result.ai.status,'models_available');
 const output=JSON.stringify(result);for(const secret of [env.STRIPE_SECRET_KEY,env.GEMINI_API_KEY,env.STRIPE_WEBHOOK_SECRET])assert.ok(!output.includes(secret));
});
test('readiness reports missing and unauthorized providers without echoing provider error details or secrets',async()=>{
 assert.equal((await providerReadiness({})).ai.status,'missing_key');
 const failure=await providerReadiness(env,async()=>new Response('private_gemini_test_value',{status:403}));
 assert.equal(failure.ai.httpStatus,403);assert.equal(failure.stripe.httpStatus,403);assert.ok(!JSON.stringify(failure).includes('private_'));
});

test('mail readiness identifies missing server configuration without claiming delivery or printing credentials',async()=>{
 const result=await providerReadiness({GOOGLE_MAIL_CLIENT_SECRET:'private_mail_secret'});
 assert.equal(result.mail.gmail.status,'missing_configuration');
 assert.ok(result.mail.gmail.missing?.includes('GOOGLE_MAIL_CLIENT_ID'));
 assert.ok(!JSON.stringify(result).includes('private_mail_secret'));
 assert.equal(result.mail.automationsEnabled,false);
});
