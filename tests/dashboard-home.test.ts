process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION = 'true';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dashboardHome } from '../src/lib/dashboard-home';
import { logoDestination } from '../src/lib/navigation';
import type { dashboard } from '../src/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
const now = new Date('2026-10-31T22:30:00Z');
const car = { id: 'car', archived: false, odometer: 60000 };
const record = {
  id: 'r',
  vehicleId: 'car',
  cancelled: false,
  kind: 'document',
  expiresAt: '2026-11-10',
  date: '2026-11-01',
  amountBani: 10000,
  amountKnown: true,
  nextKm: null,
  status: { days: 9, state: 'soon' },
};
function data(vehicles: unknown[] = [], records: unknown[] = []) {
  return { vehicles, records, profile: { timezone: 'Europe/Bucharest' } } as unknown as Data;
}
test('Empty garage has no invented costs, deadlines or service recommendations', () => {
  const home = dashboardHome(data(), now);
  assert.equal(home.cars.length, 0);
  assert.equal(home.upcoming.length, 0);
  assert.equal(home.attention.length, 0);
  assert.equal(home.monthBani, 0);
  assert.equal(home.services.length, 0);
});
test('Dashboard uses active records of active vehicles and prioritizes overdue dates', () => {
  const home = dashboardHome(
    data(
      [car, { ...car, id: 'archived', archived: true }],
      [
        record,
        {
          ...record,
          id: 'overdue',
          expiresAt: '2026-10-20',
          status: { days: -12, state: 'expired' },
        },
        { ...record, id: 'removed', cancelled: true },
        { ...record, id: 'hidden-car', vehicleId: 'archived' },
      ],
    ),
    now,
  );
  assert.equal(home.documents.length, 2);
  assert.equal(home.attention[0].id, 'overdue');
  assert.equal(home.upcoming[0].id, 'r');
  assert.equal(home.documentAttention, 2);
});
test('Current-month costs use account timezone, omit unknowns and do not treat documents as expense', () => {
  const rows = [
    record,
    { ...record, id: 'service', kind: 'service', amountBani: 20000 },
    { ...record, id: 'unknown', kind: 'expense', amountKnown: false, amountBani: 99999 },
    { ...record, id: 'old', kind: 'expense', date: '2026-10-31' },
  ];
  const home = dashboardHome(data([car], rows), now);
  assert.equal(home.monthBani, 20000);
  assert.equal(home.unknownCosts, 1);
  assert.equal(home.expenseCount, 2);
});
test('Only verified current sessions target the private dashboard', () => {
  assert.equal(logoDestination(null), '/');
  assert.equal(logoDestination({ user: { emailVerified: false } }), '/');
  assert.equal(logoDestination({ user: { emailVerified: true } }), '/cont?tab=Dashboard');
});
