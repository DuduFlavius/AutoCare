import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../scripts/migrate';
import { auth } from '../src/lib/auth';
import { db, closeLocalDb } from '../src/lib/db';
import * as schema from '../src/lib/schema';
import { GET, POST, PATCH, DELETE } from '../src/app/api/v1/[...path]/route';
import { prepareRecordDraft } from '../src/lib/record-draft';
import {
  serviceCategories,
  documentCategories,
  expenseCategories,
} from '../src/lib/record-categories';
import { recentMileageUsage } from '../src/lib/smartdrive-metrics';
import { forecastService } from '../src/lib/service-forecast';
import { eq } from 'drizzle-orm';
delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.LOCAL_DATABASE_PATH = 'memory';
process.env.APP_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'isolated-premium-records-test-secret-32-characters';
process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION = 'false';
let cookie = '',
  vehicleId = '',
  uid = '';
async function api(path: string, method = 'GET', body?: unknown) {
  const handler =
    method === 'GET' ? GET : method === 'PATCH' ? PATCH : method === 'DELETE' ? DELETE : POST;
  const response = await handler(
    new Request('http://localhost:3000/api/v1/' + path, {
      method,
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    { params: Promise.resolve({ path: path.split('/') }) },
  );
  const value = await response.json();
  assert.ok(response.ok, JSON.stringify(value));
  return value;
}
before(async () => {
  await migrate();
  const r = await auth().handler(
    new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Isolated records test',
        email: 'records@example.invalid',
        password: 'isolated-records-password-123',
      }),
    }),
  );
  assert.equal(r.status, 200);
  cookie = r.headers
    .getSetCookie()
    .map((v) => v.split(';')[0])
    .join('; ');
  const row = (
    await db().select().from(schema.user).where(eq(schema.user.email, 'records@example.invalid'))
  )[0];
  uid = row.id;
  await db()
    .insert(schema.premiumGrants)
    .values({ id: crypto.randomUUID(), userId: uid, note: 'Isolated test only' });
  const car = await api('vehicles', 'POST', {
    brand: 'Test',
    model: 'Premium records',
    year: 2024,
    plate: 'TEST01',
    fuel: 'Benzină',
    odometer: 100000,
  });
  vehicleId = car.id;
});
after(closeLocalDb);
function draft(
  kind: 'service' | 'expense' | 'document',
  category: string,
  fields: Record<string, string>,
  breakdown = false,
) {
  const f = new FormData();
  for (const [k, v] of Object.entries({ date: new Date().toISOString().slice(0, 10), ...fields }))
    f.set(k, v);
  return prepareRecordDraft(f, {
    kind,
    category,
    car: vehicleId,
    serviceKmInterval: fields.ac_intervalUlei || '',
    costEdited: breakdown,
    unknownCost: false,
  });
}
test('catalogs cover all requested operations and preserve legacy category identifiers', () => {
  assert.equal(serviceCategories.length, 19);
  for (const list of [serviceCategories, documentCategories, expenseCategories])
    assert.equal(new Set(list.map((c) => c.value)).size, list.length);
  assert.ok(
    serviceCategories.some((c) => c.value === 'Schimb ulei' && c.ro === 'Schimb ulei și filtre'),
  );
  assert.ok(documentCategories.some((c) => c.value === 'Permis'));
  assert.ok(expenseCategories.some((c) => c.value === 'Revizii'));
});
test('actual form payloads save six record types, update history/totals, edit and archive without duplicate costs', async () => {
  const payloads = [
    draft('service', 'Revizie generală', {
      amount: '100',
      odometer: '100000',
      ac_verificareUlei: 'Da',
    }),
    draft(
      'service',
      'Schimb ulei',
      {
        odometer: '100000',
        ac_intervalUlei: '10000',
        ac_costPiese: '200',
        ac_costLabor: '50',
        ac_filtru0Tip: 'Ulei',
        ac_filtru0Cost: '40',
      },
      true,
    ),
    draft('service', 'Reparație', { amount: '300', title: 'Repair', ac_pieseReparatie: 'Part' }),
    draft('service', 'Altă operațiune', {
      amount: '50',
      title: 'Custom maintenance',
      notes: 'Preserve this note',
    }),
    draft('expense', 'Combustibil', { amount: '80', title: 'Fuel receipt' }),
    draft('document', 'RCA', {
      amount: '120',
      expiresAt: '2030-12-01',
      number: 'POLICY-1',
      title: 'Policy',
    }),
  ];
  const saved: Array<{ id: string }> = [];
  for (const p of payloads) saved.push(await api('records', 'POST', p));
  let d = await api('dashboard');
  assert.equal(d.records.length, 6);
  assert.equal(d.summary.monthBani, 90000);
  assert.equal(d.records.filter((r: any) => r.category === 'Schimb ulei').length, 1);
  const oil = d.records.find((r: any) => r.id === saved[1].id);
  assert.equal(oil.nextKm, 110000);
  assert.equal(oil.amountBani, 25000);
  assert.match(oil.parts, /filtru0Cost: 40/);
  assert.equal(d.records.find((r: any) => r.id === saved[5].id).expiresAt, '2030-12-01');
  await api('records/' + saved[2].id, 'PATCH', { ...payloads[2], amountBani: 32500 });
  d = await api('dashboard');
  assert.equal(d.summary.monthBani, 92500);
  assert.equal(d.records.find((r: any) => r.id === saved[2].id).revision, 2);
  assert.equal((await api('records/' + saved[2].id + '/history')).length, 1);
  // Editing uses the same draft builder for every kind; persist the complete returned payload.
  for (const index of [1, 4, 5]) {
    const current = d.records.find((r: any) => r.id === saved[index].id);
    const f = new FormData();
    for (const [key, value] of Object.entries({
      title: current.title,
      date: current.date || '',
      expiresAt: current.expiresAt || '',
      odometer: current.odometer?.toString() || '',
      nextKm: current.nextKm?.toString() || '',
      amount: (current.amountBani / 100).toString(),
      notes: 'Edited ' + current.kind,
      number: current.number || '',
      provider: current.provider || '',
    }))
      f.set(key, String(value));
    const payload = prepareRecordDraft(f, {
      kind: current.kind,
      category: current.category,
      car: vehicleId,
      serviceKmInterval: '',
      costEdited: false,
      unknownCost: false,
      existingParts: current.parts,
    });
    await api('records/' + current.id, 'PATCH', payload);
  }
  d = await api('dashboard');
  for (const index of [1, 4, 5]) {
    const edited = d.records.find((r: any) => r.id === saved[index].id);
    assert.equal(edited.notes, 'Edited ' + edited.kind);
    assert.equal(edited.revision, 2);
    assert.equal(edited.amountBani, payloads[index].amountBani);
  }
  assert.equal(d.records.find((r: any) => r.id === saved[1].id).nextKm, 110000);
  assert.match(d.records.find((r: any) => r.id === saved[1].id).parts, /filtru0Cost: 40/);
  assert.equal(d.records.find((r: any) => r.id === saved[5].id).expiresAt, '2030-12-01');
  assert.equal(d.summary.monthBani, 92500);
  await api('records/' + saved[4].id, 'DELETE');
  d = await api('dashboard');
  assert.equal(d.records.length, 6);
  assert.equal(d.records.find((r: any) => r.id === saved[4].id).cancelled, true);
  assert.equal(d.summary.monthBani, 84500);
});
test('confirmed odometer API updates immediately feed the forecast, with no GPS or duplicate expense record', async () => {
  const before = await api('dashboard');
  const updated = await api('smartdrive/vehicles/' + vehicleId + '/readings', 'POST', {
    odometer: 101000,
  });
  assert.equal(updated.vehicle.odometer, 101000);
  const readings = await api('smartdrive/vehicles/' + vehicleId + '/readings');
  assert.equal(readings[0].odometer, 101000);
  const after = await api('dashboard');
  assert.equal(after.vehicles[0].odometer, 101000);
  assert.equal(after.records.length, before.records.length);
  const a = forecastService({ currentKm: 100000, nextKm: 110000, averageKmPerDay: 100 });
  const b = forecastService({
    currentKm: after.vehicles[0].odometer,
    nextKm: 110000,
    averageKmPerDay: 100,
  });
  assert.equal(a?.days, 100);
  assert.equal(b?.days, 90);
});
test('invalid data retains the draft and does not produce a payload or save', () => {
  const f = new FormData();
  f.set('date', '2026-10-29');
  f.set('amount', '-10');
  assert.throws(() =>
    prepareRecordDraft(f, {
      kind: 'expense',
      category: 'Combustibil',
      car: vehicleId,
      serviceKmInterval: '',
      costEdited: false,
      unknownCost: false,
    }),
  );
  assert.equal(f.get('amount'), '-10');
});
test('recent mileage estimation rejects regressing readings, short samples and implausible jumps', () => {
  assert.equal(
    recentMileageUsage([
      { odometer: 100, recordedAt: '2026-01-01' },
      { odometer: 90, recordedAt: '2026-01-10' },
    ]).dailyKm,
    null,
  );
  assert.equal(
    recentMileageUsage([
      { odometer: 100, recordedAt: '2026-01-01' },
      { odometer: 100000, recordedAt: '2026-01-02' },
    ]).dailyKm,
    null,
  );
  const sample = [
    { odometer: 100, recordedAt: '2026-01-01' },
    { odometer: 400, recordedAt: '2026-01-11' },
  ];
  assert.equal(recentMileageUsage(sample).dailyKm, 30);
  assert.equal(recentMileageUsage(sample, new Date('2026-10-29')).confidence, 'stale');
});
test('every catalog category round-trips through the existing API without a new table or duplicate row', async () => {
  const initial = await api('dashboard');
  let count = 0;
  for (const [kind, catalog] of [
    ['service', serviceCategories],
    ['expense', expenseCategories],
    ['document', documentCategories],
  ] as const) {
    for (const category of catalog) {
      const p = draft(kind, category.value, {
        title: 'Catalog ' + category.value,
        amount: '1',
        ...(kind === 'document' ? { expiresAt: '2031-01-01' } : {}),
      });
      const saved = await api('records', 'POST', p);
      assert.equal(saved.category, category.value);
      count++;
    }
  }
  const final = await api('dashboard');
  assert.equal(final.records.length, initial.records.length + count);
  assert.equal(final.summary.monthBani, initial.summary.monthBani + count * 100);
});
