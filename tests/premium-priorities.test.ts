import { test } from 'node:test';
import assert from 'node:assert/strict';
import { premiumPriorities, type PriorityRecord } from '../src/lib/premium-priorities';
const cars = [
  { id: 'car', odometer: 80000, archived: false },
  { id: 'archived', odometer: 90000, archived: true },
];
const record = (id: string, extra: Partial<PriorityRecord> = {}): PriorityRecord => ({
  id,
  vehicleId: 'car',
  kind: 'service',
  cancelled: false,
  nextKm: null,
  status: { days: null },
  ...extra,
});
test('priorities select upcoming calendar and mileage thresholds once and put overdue first', () => {
  const rows = [
    record('both', { nextKm: 80500, status: { days: 12 } }),
    record('overdue', { status: { days: -2 } }),
    record('far', { nextKm: 90000, status: { days: 60 } }),
    record('today', { status: { days: 0 } }),
  ];
  const result = premiumPriorities(rows, cars);
  assert.deepEqual(
    result.map((x) => x.record.id),
    ['overdue', 'today', 'both'],
  );
  assert.equal(result[2].remainingKm, 500);
  assert.equal(result[2].days, 12);
});
test('archived vehicles, cancelled records, unrelated cars and expenses do not create maintenance priorities', () => {
  assert.deepEqual(
    premiumPriorities(
      [
        record('a', { cancelled: true, nextKm: 79000 }),
        record('b', { vehicleId: 'archived', nextKm: 79000 }),
        record('c', { vehicleId: 'other', nextKm: 79000 }),
        record('d', { kind: 'expense', status: { days: -1 } }),
      ],
      cars,
    ),
    [],
  );
});
test('confirmed mileage updates move an approaching intervention to overdue without creating another item', () => {
  const rows = [record('oil', { nextKm: 80500 })];
  assert.equal(premiumPriorities(rows, cars)[0].overdue, false);
  const result = premiumPriorities(rows, [{ ...cars[0], odometer: 81000 }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].overdue, true);
  assert.equal(result[0].remainingKm, -500);
});
