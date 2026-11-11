/** Run only with Test Mode credentials. Creates and expires six unpaid test Checkouts. */
import Stripe from 'stripe';
import {billingAmount,type BillingCurrency,type BillingInterval} from '../src/lib/billing-currency';
import {matchesBillingPrice} from '../src/lib/stripe-catalog';
async function main(){
 const key=process.env.STRIPE_TEST_SECRET_KEY;
 if(!key||!key.startsWith('sk_test_'))throw Error('STRIPE_TEST_SECRET_KEY (sk_test_) is required. No live key or payment is accepted.');
 const client=new Stripe(key);const results=[];
 for(const currency of ['ron','eur'] as BillingCurrency[])for(const interval of ['monthly','quarterly','annual'] as BillingInterval[]){
  const env=`STRIPE_TEST_${interval.toUpperCase()}_${currency.toUpperCase()}_PRICE_ID`;
  const id=process.env[env];if(!id)throw Error(`${env} is required (existing Test Mode Price ID).`);
  const price=await client.prices.retrieve(id,{expand:['currency_options']});
  if(price.livemode||!matchesBillingPrice(price,interval,currency,billingAmount(interval,currency)))throw Error(`${env}: amount/currency/recurrence mismatch.`);
  const session=await client.checkout.sessions.create({mode:'subscription',currency,locale:'en',adaptive_pricing:{enabled:false},line_items:[{price:id,quantity:1}],success_url:'https://autocare-premium.vercel.app/preturi',cancel_url:'https://autocare-premium.vercel.app/preturi',metadata:{purpose:'currency_integration_test'}});
  try{if(session.livemode||session.currency!==currency||session.amount_total!==billingAmount(interval,currency))throw Error(`${interval}/${currency}: Checkout mismatch.`);results.push({interval,currency,priceId:id,session:session.id,amount:session.amount_total,result:'unpaid test Checkout verified'});}finally{if(session.status==='open')await client.checkout.sessions.expire(session.id);}
 }
 console.log(JSON.stringify({mode:'TEST',paymentsMade:0,results},null,2));
}
main().catch(error=>{console.error((error as Error).message);process.exitCode=1;});
