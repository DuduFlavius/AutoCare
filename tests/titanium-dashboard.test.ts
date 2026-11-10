import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { migrate } from '../scripts/migrate';
import { auth } from '../src/lib/auth';
import { closeLocalDb, db } from '../src/lib/db';
import { gpsTrips, records, subscriptions, user, vehicles } from '../src/lib/schema';
import { dashboard } from '../src/lib/service';
import { garageOverview, garageVehicleSummary } from '../src/lib/garage-overview';
import { DELETE, GET, PATCH, POST, PUT } from '../src/app/api/v1/[...path]/route';

delete process.env.DATABASE_URL;
delete process.env.OPENAI_API_KEY;
delete process.env.AUTOCARE_AI_MODEL;
process.env.LOCAL_DATABASE_PATH = 'memory';
process.env.APP_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'isolated-titanium-dashboard-test-secret';
process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION = 'false';

const carId = crypto.randomUUID();
const foreignCarId = crypto.randomUUID();
let ownerId: string;
let foreignId: string;
let cookie: string;

before(async () => {
  await migrate();
  for (const name of ['owner', 'other']) {
    const email = name + '@titanium-test.invalid';
    const response = await auth().handler(new Request('http://localhost:3000/api/auth/sign-up/email', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password: 'isolated-dashboard-test-password' }),
    }));
    assert.equal(response.status, 200);
    const [account] = await db().select().from(user).where(eq(user.email, email));
    if (name === 'owner') {
      ownerId = account.id;
      cookie = response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    } else foreignId = account.id;
  }
  await db().insert(vehicles).values([
    { id: carId, userId: ownerId, brand: 'Example', model: 'GT', plate: 'PRIVATE-PLATE', vin: 'PRIVATE-VIN', year: 2020, odometer: 18000, fuel: 'Benzină' },
    { id: foreignCarId, userId: foreignId, brand: 'Other', model: 'GT', plate: 'OTHER-PLATE', year: 2021, fuel: 'Diesel' },
  ]);
});
after(closeLocalDb);

test('annual and monthly GPS totals use the profile timezone and exclude other owners', async () => {
  const now = new Date();
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Bucharest', year: 'numeric', month: '2-digit' }).format(now);
  const lastYear = new Date(Date.UTC(Number(month.slice(0, 4)) - 1, 5, 1));
  for (const [uid, vehicleId, startedAt, distanceMeters] of [
    [ownerId, carId, now, 4100],
    [ownerId, carId, lastYear, 9000],
    [foreignId, foreignCarId, now, 12000],
  ] as const) {
    await db().insert(gpsTrips).values({ id: crypto.randomUUID(), userId: uid, vehicleId, startedAt, endedAt: startedAt, distanceMeters, durationSeconds: 240 });
  }
  const data = await dashboard(ownerId);
  assert.deepEqual(data.annualTrips, [{ vehicleId: carId, month, meters: 4100, count: 1 }]);
  assert.deepEqual(data.monthlyTrips, [{ vehicleId: carId, meters: 4100, count: 1 }]);
});

test('assistant requires Premium, checks ownership, and limits context sent to the provider', async t => {
  const ask = (vehicleId: string, sessionCookie = cookie) => POST(
    new Request('http://localhost:3000/api/v1/auto-assistant', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: JSON.stringify({ vehicleId, question: 'Când expiră ITP?' }),
    }),
    { params: Promise.resolve({ path: ['auto-assistant'] }) },
  );
  assert.equal((await ask(carId, '')).status, 401);
  assert.equal((await ask(carId)).status, 403);
  await db().insert(subscriptions).values({ userId: ownerId, subscriptionId: 'sub_titanium_test', status: 'active', periodEnd: new Date(Date.now() + 86400000) })
    .onConflictDoUpdate({ target: subscriptions.userId, set: { subscriptionId: 'sub_titanium_test', status: 'active', periodEnd: new Date(Date.now() + 86400000) } });
  assert.equal((await ask(foreignCarId)).status, 404);
  assert.equal((await ask(carId)).status, 503);
  assert.equal((await dashboard(ownerId)).autoAssistantAvailable, false);
  await db().insert(records).values({ id: crypto.randomUUID(), userId: ownerId, vehicleId: carId, kind: 'document', category: 'ITP', title: 'PRIVATE-TITLE', number: 'PRIVATE-NUMBER', notes: 'PRIVATE-NOTES', expiresAt: '2030-01-31' });
  process.env.OPENAI_API_KEY = 'test-key-not-a-real-secret';
  process.env.AUTOCARE_AI_MODEL = 'test-model';
  const provider = t.mock.method(globalThis, 'fetch', async (url: string, request: RequestInit) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const payload = JSON.parse(String(request.body));
    assert.equal(payload.store, false);
    assert.equal(payload.model, 'test-model');
    assert.equal(JSON.parse(payload.input).context.entries[0].expiresAt, '2030-01-31');
    assert.doesNotMatch(payload.input, /PRIVATE-/);
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'ITP expiră pe 31 ianuarie 2030.' }] }] });
  });
  const response = await ask(carId);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).answer, 'ITP expiră pe 31 ianuarie 2030.');
  assert.equal(provider.mock.callCount(), 1);
});

test('AutoCare AI stores scoped history, validates scans and handles provider failure without saving a document', async t => {
  const site = 'http://localhost:3000';
  const headers = { Origin: site, Cookie: cookie };
  const getHistory = (vehicleId: string) => GET(new Request(site + '/api/v1/auto-assistant/history?vehicleId=' + vehicleId, { headers }), { params: Promise.resolve({ path: ['auto-assistant', 'history'] }) });
  assert.equal((await getHistory(foreignCarId)).status, 404);
  const history = await (await getHistory(carId)).json();
  assert.equal(history.turns.length, 1);
  assert.equal(history.turns[0].answer, 'ITP expiră pe 31 ianuarie 2030.');
  const scan = (bytes: Uint8Array) => {
    const form = new FormData();
    form.set('vehicleId', carId);
    form.set('file', new File([Buffer.from(bytes)], 'scan.jpg', { type: 'image/jpeg' }));
    return POST(new Request(site + '/api/v1/auto-assistant/scan', { method: 'POST', headers, body: form }), { params: Promise.resolve({ path: ['auto-assistant', 'scan'] }) });
  };
  const bytes = new Uint8Array([255, 216, 255, 0, 0]);
  assert.equal((await scan(new Uint8Array([1, 2, 3]))).status, 400);
  const recordCount = (await dashboard(ownerId)).records.length;
  let badResponse = false;
  t.mock.method(globalThis, 'fetch', async (_url: string, request: RequestInit) => {
    const body = JSON.parse(String(request.body));
    assert.equal(body.input[0].content[1].type, 'input_image');
    if (badResponse) return new Response(null, { status: 503 });
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({
      category: 'ITP', number: 'A12', date: '2026-11-10', expiresAt: '2027-11-10', amountRon: null,
    }) }] }] });
  });
  const result = await scan(bytes);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).number, 'A12');
  assert.equal((await dashboard(ownerId)).records.length, recordCount);
  badResponse = true;
  assert.equal((await scan(bytes)).status, 502);
  const cleared = await DELETE(new Request(site + '/api/v1/auto-assistant/history', { method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ vehicleId: carId }) }), { params: Promise.resolve({ path: ['auto-assistant', 'history'] }) });
  assert.equal(cleared.status, 200);
  assert.deepEqual((await (await getHistory(carId)).json()).turns, []);
});

test('garage totals include history, and primary vehicle is persisted only for an active owned vehicle', async () => {
  const create = (method: string, path: string, payload?: unknown, sessionCookie = cookie) => {
    const request = new Request('http://localhost:3000/api/v1/' + path, {
      method,
      headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json', Cookie: sessionCookie },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const context = { params: Promise.resolve({ path: path.split('/') }) };
    return (method === 'DELETE' ? DELETE : method === 'POST' ? POST : method === 'PATCH' ? PATCH : PUT)(request, context);
  };
  const choose = (vehicleId: string, sessionCookie = cookie) => create('PUT', 'vehicles/primary', { vehicleId }, sessionCookie);
  assert.equal((await choose(carId, '')).status, 401);
  assert.equal((await choose(foreignCarId)).status, 404);
  assert.equal((await choose(carId)).status, 200);
  assert.equal((await dashboard(ownerId)).primaryVehicleId, carId);
  assert.equal((await dashboard(foreignId)).primaryVehicleId, null);
  const vehicleInput = { brand: 'Demo', model: 'Estate', plate: 'TEST 02', year: 2024, fuel: 'Diesel', odometer: 24000 };
  const added = await create('POST', 'vehicles', vehicleInput);
  assert.equal(added.status, 201);
  const second = await added.json();
  assert.equal((await choose(second.id)).status, 200);
  assert.equal((await create('PATCH', 'vehicles/' + second.id, { ...vehicleInput, engine: '2.0' })).status, 200);
  assert.equal((await create('POST', 'smartdrive/vehicles/' + second.id + '/readings', { odometer: 24100 })).status, 201);
  await db().insert(records).values([
    { id: crypto.randomUUID(), userId: ownerId, vehicleId: carId, kind: 'service', title: 'Revizie', category: 'Revizie', date: '2025-01-01', amountBani: 8500 },
    { id: crypto.randomUUID(), userId: ownerId, vehicleId: carId, kind: 'service', title: 'Revizie viitoare', category: 'Revizie', date: '2099-12-01', expiresAt: '2099-12-01', amountBani: 0 },
    { id: crypto.randomUUID(), userId: ownerId, vehicleId: second.id, kind: 'document', title: 'RCA', category: 'RCA', expiresAt: '2099-01-01', amountBani: 500 },
    { id: crypto.randomUUID(), userId: ownerId, vehicleId: second.id, kind: 'document', title: 'ITP expirat', category: 'ITP', expiresAt: '2020-01-01' },
    { id: crypto.randomUUID(), userId: ownerId, vehicleId: second.id, kind: 'expense', title: 'Cost anulat', category: 'Altele', cancelled: true, amountBani: 4000 },
  ]);
  let data = await dashboard(ownerId);
  let overview = garageOverview(data, '2030-01-01');
  assert.equal(data.primaryVehicleId, second.id);
  assert.equal(data.vehicles.find(vehicle => vehicle.id === second.id)?.engine, '2.0');
  assert.deepEqual(overview.totals, { vehicles: 2, active: 2, kilometers: 42100, costs: 9000, services: 1, documents: 2 });
  assert.deepEqual(garageVehicleSummary(overview.records.get(second.id) ?? [], 24100, data.profile.timezone).deadline, { date: '2020-01-01', title: 'ITP', overdue: true });
  assert.equal((await create('DELETE', 'vehicles/' + second.id)).status, 200);
  assert.equal((await choose(second.id)).status, 400);
  data = await dashboard(ownerId);
  overview = garageOverview(data, '2030-01-01');
  assert.equal(data.primaryVehicleId, null);
  assert.deepEqual(overview.totals, { vehicles: 2, active: 1, kilometers: 42100, costs: 9000, services: 1, documents: 1 });
});
