import {test} from 'node:test';
import assert from 'node:assert/strict';
import {displayBillingCurrency,billingAmount} from '../src/lib/billing-currency';
test('English first visits display the EUR catalog and Romanian first visits display RON',()=>{
 assert.equal(displayBillingCurrency('en',null,null),'eur');
 assert.equal(displayBillingCurrency('ro',null,null),'ron');
 for(const interval of ['monthly','quarterly','annual'] as const){
  assert.equal(billingAmount(interval,displayBillingCurrency('en',null,null)),{monthly:3000,quarterly:9000,annual:34000}[interval]);
 }
});
test('explicit URL and saved preferences survive language switches and Checkout return',()=>{
 for(const language of ['ro','en'] as const){
  assert.equal(displayBillingCurrency(language,'EUR','ron'),'eur');
  assert.equal(displayBillingCurrency(language,'RON','eur'),'ron');
  assert.equal(displayBillingCurrency(language,null,'eur'),'eur');
  assert.equal(displayBillingCurrency(language,null,'ron'),'ron');
 }
 assert.equal(displayBillingCurrency('en','usd','invalid'),'eur');
});


test('Public LIVE tariffs remain available without a database connection and preserve the billing contract', async()=>{
 const {publicPricing}=await import('../src/lib/pricing');
 const previous=process.env.AUTOCARE_ENABLE_LIVE_PAYMENTS;
 try{process.env.AUTOCARE_ENABLE_LIVE_PAYMENTS='true';const p=await publicPricing();assert.equal(p.monthlyBani,15000);assert.equal(p.annualBani,170000);assert.equal(p.currency,'ron');assert.equal(p.monthlyPriceId,null);}
 finally{if(previous===undefined)delete process.env.AUTOCARE_ENABLE_LIVE_PAYMENTS;else process.env.AUTOCARE_ENABLE_LIVE_PAYMENTS=previous;}
});
