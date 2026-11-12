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
