import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountDisplayCurrency } from '../src/lib/display-currency';

test('automatic currency follows the interface language', () => {
  assert.equal(accountDisplayCurrency('en'), 'EUR');
  assert.equal(accountDisplayCurrency('ro','auto'), 'RON');
});

test('both explicit currency choices remain in effect when switching languages', () => {
  assert.equal(accountDisplayCurrency('en','RON'), 'RON');
  assert.equal(accountDisplayCurrency('ro','RON'), 'RON');
  assert.equal(accountDisplayCurrency('ro','EUR'), 'EUR');
  assert.equal(accountDisplayCurrency('en','EUR'), 'EUR');
});
