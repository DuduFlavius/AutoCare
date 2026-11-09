import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fuelConsumption, readFuelFill, writeFuelFill } from '../src/lib/fuel-log';

function fill(km: number, liters: number, full: boolean, date: string) {
  return { kind: 'expense', category: 'Combustibil', cancelled: false, date, odometer: km, parts: writeFuelFill('', { liters, full }) };
}

test('fuel consumption uses measured full-to-full intervals and includes partial fills', () => {
  const first = fill(1000, 40, true, '2026-01-01');
  const partial = fill(1200, 10, false, '2026-01-09');
  const last = fill(1500, 20, true, '2026-01-18');
  assert.deepEqual(fuelConsumption([last, first, partial]), { distance: 500, litersPer100Km: 6 });
  assert.equal(fuelConsumption([first, { ...partial, parts: null }, last]), null);
  assert.equal(fuelConsumption([first, partial]), null);
});

test('fuel metadata preserves older details and rejects invalid values', () => {
  const entry = writeFuelFill('Detalio vechi', { liters: 20, full: true });
  assert.deepEqual(readFuelFill(entry), { liters: 20, full: true });
  assert.equal(writeFuelFill(entry, null), 'Detalio vechi');
  assert.equal(readFuelFill('AutoCareFuel:{"liters":-1,"full":true}'), null);
});
