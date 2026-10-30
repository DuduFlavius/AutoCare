import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseServiceDetails, serializeServiceDetails } from '../src/lib/service-details';
import { prepareRecordDraft, recordDraftSchedule } from '../src/lib/record-draft';
import { forecastService, forecastDuration } from '../src/lib/service-forecast';
function form(values: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
}
const opts = {
  kind: 'service' as const,
  category: 'Schimb ulei',
  car: '11111111-1111-4111-8111-111111111111',
  serviceKmInterval: '',
  costEdited: false,
  unknownCost: false,
};
test('editing preserves unrendered technical metadata and permits explicit field clearing', () => {
  const old = 'Old description\nAutoCare · legacyField: retained\nAutoCare · marcaUlei: old';
  const value = serializeServiceDetails('', form({ ac_marcaUlei: '' }), old);
  assert.deepEqual(parseServiceDetails(value), { legacyField: 'retained' });
  assert.ok(!value.includes('Old description'));
});
test('summary and saved deadlines share category dates, oil intervals and explicit overrides', () => {
  const f = form({
    odometer: '80000',
    ac_intervalUlei: '15000',
    ac_urmatoareaVerificare: '2027-10-30',
  });
  assert.deepEqual(recordDraftSchedule(f, 'service', 'Schimb ulei'), {
    nextKm: 95000,
    expiresAt: '2027-10-30',
  });
  f.set('nextKm', '90000');
  f.set('expiresAt', '2027-09-01');
  assert.deepEqual(recordDraftSchedule(f, 'service', 'Schimb ulei'), {
    nextKm: 90000,
    expiresAt: '2027-09-01',
  });
  assert.equal(
    recordDraftSchedule(form({ ac_expirareITP: '2027-02-10' }), 'service', 'ITP').expiresAt,
    '2027-02-10',
  );
});
test('manual totals and breakdown costs remain distinct and filter costs count once', () => {
  const f = form({
    date: '2026-10-30',
    amount: '150',
    ac_costPiese: '80',
    ac_costLabor: '20',
    ac_filtru1Cost: '50',
  });
  assert.equal(prepareRecordDraft(f, opts).amountBani, 15000);
  assert.equal(prepareRecordDraft(f, { ...opts, costEdited: true }).amountBani, 10000);
  assert.equal(prepareRecordDraft(f, opts).amountBani, 15000);
  f.set('amount', '40');
  assert.throws(() => prepareRecordDraft(f, opts), /suma filtrelor/);
});
test('invalid breakdown costs cannot silently disappear, and a zero filter cost is known', () => {
  for (const amount of ['-1', 'NaN', '1000001'])
    assert.throws(
      () =>
        prepareRecordDraft(form({ date: '2026-10-30', ac_costLabor: amount }), {
          ...opts,
          costEdited: true,
        }),
      /Costul/,
    );
  const saved = prepareRecordDraft(form({ date: '2026-10-30', ac_filtru1Cost: '0' }), opts);
  assert.equal(saved.amountBani, 0);
  assert.equal(saved.amountKnown, true);
});
test('oil countdown recalculates on mileage and respects earlier dates without invented usage', () => {
  const today = new Date('2026-10-30T12:00:00Z');
  const base = {
    today,
    currentKm: 80000,
    nextKm: 95000,
    averageKmPerDay: 100,
    timezone: 'Europe/Bucharest',
  };
  assert.equal(forecastService(base)?.days, 150);
  assert.equal(forecastService({ ...base, currentKm: 81000 })?.days, 140);
  assert.equal(forecastService({ ...base, dueDate: '2026-11-09' })?.days, 10);
  assert.equal(forecastService({ ...base, currentKm: 95000, averageKmPerDay: null })?.days, 0);
  assert.equal(forecastService({ ...base, averageKmPerDay: null })?.days, null);
  assert.match(forecastDuration(150, 'ro'), /luni.*150 zile/);
});

test('timing service recalculates stale next mileage after correcting historical odometer', () => {
  for (const interval of ['100000', '150000']) {
    const f = form({ date: '2026-10-30', odometer: '83000', nextKm: '80000', ac_intervalIntretinere: interval, ac_intervalLuni: '60', amount: '3000' });
    const draft = prepareRecordDraft(f, {...opts, category: 'Distribuție'});
    assert.equal(draft.odometer, 83000);
    assert.equal(draft.nextKm, 83000 + Number(interval));
    assert.equal(draft.expiresAt, '2031-10-30');
    f.set('odometer', '90000');
    assert.equal(prepareRecordDraft(f, {...opts, category: 'Distribuție'}).nextKm, 90000 + Number(interval));
  }
});
test('timing service retains an explicit absolute deadline when no repeat interval is entered', () => {
  assert.equal(recordDraftSchedule(form({odometer:'83000',nextKm:'150000'}), 'service', 'Distribuție').nextKm, 150000);
});
