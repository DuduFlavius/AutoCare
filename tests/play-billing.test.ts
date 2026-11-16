import {test} from 'node:test';
import assert from 'node:assert/strict';
import {playAccountId,verifiedPlayEntitlement} from '../src/lib/play-billing';
const now=new Date('2026-11-16T12:00:00Z');
const purchase={subscriptionState:'SUBSCRIPTION_STATE_ACTIVE',externalAccountIdentifiers:{obfuscatedExternalAccountId:playAccountId('owner')},lineItems:[{productId:'autocare_monthly',expiryTime:'2026-12-16T12:00:00Z'}]};
test('Play entitlement requires the exact account, approved product, completed state and future expiry',()=>{
 assert.equal(verifiedPlayEntitlement('owner',purchase,['autocare_monthly'],now).active,true);
 assert.throws(()=>verifiedPlayEntitlement('other',purchase,['autocare_monthly'],now),/ACCOUNT_MISMATCH/);
 assert.throws(()=>verifiedPlayEntitlement('owner',purchase,['different'],now),/PRODUCT_MISMATCH/);
 for(const state of ['SUBSCRIPTION_STATE_PENDING','SUBSCRIPTION_STATE_ON_HOLD','SUBSCRIPTION_STATE_EXPIRED','SUBSCRIPTION_STATE_PAUSED'])assert.equal(verifiedPlayEntitlement('owner',{...purchase,subscriptionState:state},['autocare_monthly'],now).active,false);
 assert.equal(verifiedPlayEntitlement('owner',{...purchase,subscriptionState:'SUBSCRIPTION_STATE_CANCELED'},['autocare_monthly'],now).active,true);
 assert.equal(verifiedPlayEntitlement('owner',purchase,['autocare_monthly'],new Date('2027-01-01')).active,false);
 assert.throws(()=>verifiedPlayEntitlement('owner',{...purchase,lineItems:[{productId:'autocare_monthly',expiryTime:'invalid'}]},['autocare_monthly'],now),/INVALID_EXPIRY/);
});
