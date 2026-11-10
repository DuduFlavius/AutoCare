import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { migrate } from '../scripts/migrate';
import { auth } from '../src/lib/auth';
import { closeLocalDb, db } from '../src/lib/db';
import { gpsTrips, records, subscriptions, user, vehicles } from '../src/lib/schema';
import { dashboard } from '../src/lib/service';
import { POST } from '../src/app/api/v1/[...path]/route';

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
