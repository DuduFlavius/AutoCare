import {test} from 'node:test';
import assert from 'node:assert/strict';
import {accountDisplayCurrency} from '../src/lib/display-currency';
test('English uses EUR instead of a legacy RON preference and Romanian uses RON',()=>{
 assert.equal(accountDisplayCurrency('en','RON',null),'EUR');
 assert.equal(accountDisplayCurrency('en','RON','ro'),'EUR');
 assert.equal(accountDisplayCurrency('ro','EUR','en'),'RON');
 assert.equal(accountDisplayCurrency('en',null,null),'EUR');
});
test('an explicit display currency preference applies only in the language where it was chosen',()=>{
 assert.equal(accountDisplayCurrency('en','RON','en'),'RON');
 assert.equal(accountDisplayCurrency('ro','EUR','ro'),'EUR');
 assert.equal(accountDisplayCurrency('en','BAD','en'),'EUR');
});
