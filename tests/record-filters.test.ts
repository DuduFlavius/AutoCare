import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentCounts, filterRecords, serviceStats } from '../src/lib/record-filters';
const base = {
  vehicleId: 'car',
  category: 'RCA',
  title: 'Poliță RCA',
  provider: null,
  date: '2026-10-01',
  expiresAt: null as string | null,
  cancelled: false,
  kind: 'document',
};
const now = new Date('2026-10-20T10:00:00Z');
test('Document states are exclusive; missing dates and archived documents are explicit', () => {
  const rows = [
    { ...base, expiresAt: '2027-01-01' },
    { ...base, expiresAt: '2026-10-25' },
    { ...base, expiresAt: '2026-10-19' },
    base,
    { ...base, cancelled: true },
  ];
  assert.deepEqual(documentCounts(rows, now), {
    total: 4,
    valid: 1,
    soon: 1,
    expired: 1,
    incomplete: 1,
  });
  assert.equal(filterRecords(rows, { status: 'soon' }, now).length, 1);
  assert.equal(filterRecords(rows, { archived: 'only' }, now).length, 1);
  assert.equal(filterRecords(rows, { q: 'inexistent' }, now).length, 0);
  assert.equal(filterRecords(rows, { vehicleId: 'other' }, now).length, 0);
});
test('Service totals exclude unknown costs, include free work and do not invent next service', () => {
  const r = {
    ...base,
    kind: 'service',
    odometer: 50000,
    nextKm: null,
    amountBani: 10000,
    amountKnown: true,
  };
  const stats = serviceStats(
    [r, { ...r, amountBani: 99999, amountKnown: false }, { ...r, amountBani: 0 }],
    now,
  );
  assert.equal(stats.totalBani, 10000);
  assert.equal(stats.unknownCosts, 1);
  assert.equal(stats.count, 3);
  assert.equal(stats.next, null);
  assert.equal(stats.lastOdometer, 50000);
  assert.equal(filterRecords([r], { from: '2026-10-15' }, now).length, 0);
});
