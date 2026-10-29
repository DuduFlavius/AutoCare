import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mileageMetrics } from '../src/lib/smartdrive-metrics';

test('SmartDrive mileage: two confirmed readings calculate daily and 30-day average', () => {
  const value = mileageMetrics([
    { odometer: 1300, recordedAt: '2030-01-11T00:00:00Z' },
    { odometer: 1000, recordedAt: '2030-01-01T00:00:00Z' },
  ]);
  assert.deepEqual(value, { deltaKm: 300, dailyKm: 30, monthlyKm: 900 });
});
test('SmartDrive mileage: repeated equal readings show zero rather than false distance', () => {
  assert.deepEqual(mileageMetrics([
    { odometer: 1000, recordedAt: '2030-01-01T00:00:00Z' },
    { odometer: 1000, recordedAt: '2030-01-04T00:00:00Z' },
  ]), { deltaKm: 0, dailyKm: 0, monthlyKm: 0 });
});
test('SmartDrive mileage: insufficient interval and regressions are not extrapolated', () => {
  const missing = { deltaKm: null, dailyKm: null, monthlyKm: null };
  assert.deepEqual(mileageMetrics([]), missing);
  assert.deepEqual(mileageMetrics([{ odometer: 1000, recordedAt: '2030-01-01T00:00:00Z' }]), missing);
  assert.deepEqual(mileageMetrics([
    { odometer: 1000, recordedAt: '2030-01-01T00:00:00Z' },
    { odometer: 1001, recordedAt: '2030-01-01T01:00:00Z' },
  ]), missing);
  assert.deepEqual(mileageMetrics([
    { odometer: 1000, recordedAt: '2030-01-01T00:00:00Z' },
    { odometer: 900, recordedAt: '2030-01-10T00:00:00Z' },
  ]), missing);
});
test('SmartDrive mileage: a short normal trip does not invalidate a multi-day average',()=>{const m=mileageMetrics([{odometer:1000,recordedAt:'2030-01-01T00:00:00Z'},{odometer:1300,recordedAt:'2030-01-11T00:00:00Z'},{odometer:1400,recordedAt:'2030-01-11T01:00:00Z'}]);assert.ok(m.dailyKm!==null&&m.dailyKm>30&&m.dailyKm<50);});
