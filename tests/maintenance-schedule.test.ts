import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maintenanceSchedule, maintenanceTargets } from '../src/lib/maintenance-schedule';
const base = {
  category: 'Distribuție',
  odometer: 80000,
  nextKm: null,
  date: '2026-10-30',
  details: { intervalDistributie: '100000', intervalLuni: '60' },
};
test('timing belt intervals calculate both mileage and calendar deadlines without fixed manufacturer defaults', () => {
  assert.deepEqual(maintenanceSchedule(base), { nextKm: 180000, expiresAt: '2031-10-30' });
  assert.deepEqual(maintenanceSchedule({ ...base, details: {} }), {
    nextKm: null,
    expiresAt: null,
  });
});
test('every service category supports an explicit generic interval and manual deadlines override computed values', () => {
  for (const category of [
    'Filtre',
    'Frâne',
    'Anvelope',
    'Baterie',
    'Motor',
    'Cutie de viteze și transmisie',
    'Ambreiaj',
    'Altă operațiune',
  ])
    assert.equal(
      maintenanceSchedule({ ...base, category, details: { intervalIntretinere: '12000' } }).nextKm,
      92000,
    );
  assert.deepEqual(maintenanceSchedule({ ...base, nextKm: 160000, expiresAt: '2030-01-01' }), {
    nextKm: 160000,
    expiresAt: '2030-01-01',
  });
});
test('month intervals clamp to the last calendar day and technical timing belt dates are retained', () => {
  assert.equal(
    maintenanceSchedule({ ...base, date: '2026-01-31', details: { intervalLuni: '1' } }).expiresAt,
    '2026-02-28',
  );
  assert.equal(
    maintenanceSchedule({ ...base, details: { urmatoareaDataDistributie: '2030-01-01' } })
      .expiresAt,
    '2030-01-01',
  );
  assert.equal(
    maintenanceSchedule({ ...base, date: '2026-99-99', details: { intervalLuni: '1' } }).expiresAt,
    null,
  );
});
test('individual filters retain their own thresholds and dates without writing duplicate records', () => {
  const record = {
    id: 'filters',
    title: 'Filtre',
    category: 'Filtre',
    date: '2026-10-30',
    odometer: 80000,
    nextKm: null,
    expiresAt: null,
    parts:
      'AutoCare · filtru0Tip: Aer\nAutoCare · filtru0Interval: 15000\nAutoCare · filtru1Tip: Combustibil\nAutoCare · filtru1Km: 110000\nAutoCare · filtru1Data: 2027-10-30',
  };
  const tasks = maintenanceTargets(record);
  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].nextKm, 95000);
  assert.equal(tasks[1].nextKm, 110000);
  assert.equal(tasks[1].expiresAt, '2027-10-30');
  assert.equal(
    maintenanceSchedule({
      ...record,
      details: {
        filtru0Tip: 'Aer',
        filtru0Interval: '15000',
        filtru1Tip: 'Combustibil',
        filtru1Km: '110000',
      },
    }).nextKm,
    95000,
  );
});

test('a filter threshold remains usable when its optional type is not selected', () => {
  const tasks = maintenanceTargets({
    id: 'f',
    title: 'Filters',
    category: 'Filtre',
    date: '2026-10-30',
    odometer: 80000,
    nextKm: null,
    expiresAt: null,
    parts: 'AutoCare · filtru0Interval: 10000',
  });
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].nextKm, 90000);
});

test('maintenance ranking shows overdue and due work before future work and recalculates for the selected car mileage', async () => {
  const { rankMaintenanceForecasts } = await import('../src/lib/maintenance-schedule');
  const today = new Date('2026-10-30T12:00:00Z');
  const services = [
    { id: 'later', nextKm: 150000, expiresAt: null },
    { id: 'date', nextKm: null, expiresAt: '2026-10-29' },
    { id: 'soon', nextKm: 101000, expiresAt: null },
    { id: 'due', nextKm: 100000, expiresAt: null },
  ];
  const ranked = rankMaintenanceForecasts(services, 100000, 100, 'Europe/Bucharest', today);
  assert.deepEqual(
    ranked.map((item) => item.service.id),
    ['date', 'due', 'soon', 'later'],
  );
  assert.equal(ranked.find((item) => item.service.id === 'soon')?.status.remainingKm, 1000);
  const changed = rankMaintenanceForecasts(services, 102000, 100, 'Europe/Bucharest', today);
  assert.equal(changed.find((item) => item.service.id === 'soon')?.status.state, 'overdue');
  assert.equal(changed.find((item) => item.service.id === 'soon')?.status.remainingKm, -1000);
});
