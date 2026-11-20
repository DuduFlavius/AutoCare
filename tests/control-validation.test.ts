import test from 'node:test';
import assert from 'node:assert/strict';
import {validDateValue} from '../src/lib/control-validation';
test('calendar rejects normalized impossible dates and accepts leap days',()=>{
 assert.equal(validDateValue('2026-02-29'),false);assert.equal(validDateValue('2028-02-29'),true);
 for(const date of ['2026-04-31','2026-00-01','2026-13-01','2026-01-00','31.01.2026'])assert.equal(validDateValue(date),false,date);
});
test('date limits include their endpoints and reject dates outside the allowed interval',()=>{
 assert.equal(validDateValue('2026-11-20','date','2026-11-20','2026-11-21'),true);
 assert.equal(validDateValue('2026-11-19','date','2026-11-20'),false);
 assert.equal(validDateValue('2026-11-22','date',undefined,'2026-11-21'),false);
});
test('month and local datetime preserve valid precision and reject invalid time',()=>{
 assert.equal(validDateValue('2026-11','month'),true);assert.equal(validDateValue('2026-13','month'),false);
 assert.equal(validDateValue('2026-11-20T23:59','datetime-local'),true);
 assert.equal(validDateValue('2026-11-20T24:00','datetime-local'),false);
 assert.equal(validDateValue('2026-11-20T10:60','datetime-local'),false);
});
