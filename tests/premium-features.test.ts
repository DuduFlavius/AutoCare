import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { PDFDocument } from 'pdf-lib';
import { migrate } from '../scripts/migrate';
import { db, closeLocalDb } from '../src/lib/db';
import * as s from '../src/lib/schema';
import { auth } from '../src/lib/auth';
import * as svc from '../src/lib/service';
import { grantPremium, revokePremium } from '../src/lib/founder';
import { GET, POST } from '../src/app/api/v1/[...path]/route';
import { prepareRecordDraft } from '../src/lib/record-draft';
import { scheduleReminders, deliverReminders } from '../src/lib/reminders';
import { maintenanceStatus } from '../src/lib/maintenance-status';
import { reminderOffsets, alertOffsetAllowed } from '../src/lib/maintenance-alerts';
delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.LOCAL_DATABASE_PATH = 'memory';
process.env.APP_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'isolated-premium-features-secret-over-32-characters';
process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION = 'false';
const accounts: Record<string, { id: string; cookie: string }> = {};
let vehicleId = '',
  savedId = '';
const now = new Date();
now.setUTCHours(12, 0, 0, 0);
const today = now.toISOString().slice(0, 10);
before(async () => {
  await migrate();
  for (const name of ['paid', 'free']) {
    const result = await auth().handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email: name + '@premium-features.invalid',
          password: 'isolated-premium-test-password-123',
        }),
      }),
    );
    assert.equal(result.status, 200);
    const row = (
      await db()
        .select()
        .from(s.user)
        .where(eq(s.user.email, name + '@premium-features.invalid'))
    )[0];
    accounts[name] = {
      id: row.id,
      cookie: result.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; '),
    };
    await db().update(s.user).set({ emailVerified: true }).where(eq(s.user.id, row.id));
    await svc.profile(row.id);
  }
  process.env.AUTOCARE_FOUNDER_USER_ID = accounts.paid.id;
  await grantPremium(accounts.paid.id, accounts.paid.id, { lifetime: true });
  await svc.saveProfile(accounts.paid.id, {
    timezone: 'UTC',
    emailEnabled: true,
    pushEnabled: false,
    afterExpiry: false,
    offsets: [30, 7, 1, 0],
    hour: 9,
  });
  vehicleId = (
    await svc.createVehicle(accounts.paid.id, {
      brand: 'Test',
      model: 'Intervals',
      plate: 'TEST01',
      year: 2024,
      fuel: 'Benzină',
      odometer: 100000,
    })
  ).id;
});
after(closeLocalDb);
function request(actor: string, path: string, body?: unknown) {
  return (body === undefined ? GET : POST)(
    new Request('http://localhost:3000/api/v1/' + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: accounts[actor].cookie,
        'Content-Type': 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: path.split('?')[0].split('/') }) },
  );
}
test('save, reload, update mileage and deliver per-operation reminders through the existing queue without duplicates', async () => {
  const f = new FormData();
  for (const [key, value] of Object.entries({
    title: 'Distribuție test',
    date: today,
    odometer: '100000',
    ac_intervalIntretinere: '1000',
    ac_intervalLuni: '12',
    expiresAt: new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10),
    amount: '200',
    ac_alertDays: '14',
    ac_alertKm: '1000,500',
  }))
    f.set(key, value);
  const payload = prepareRecordDraft(f, {
    kind: 'service',
    category: 'Distribuție',
    car: vehicleId,
    serviceKmInterval: '',
    costEdited: false,
    unknownCost: false,
  });
  const response = await request('paid', 'records', payload);
  assert.equal(response.status, 201);
  const saved = await response.json();
  savedId = saved.id;
  assert.equal(saved.nextKm, 101000);
  const reloaded = await (await request('paid', 'dashboard')).json();
  assert.equal(reloaded.premium, true);
  assert.equal(reloaded.premiumAccess.paid, false);
  assert.equal(reloaded.premiumAccess.manual.length, 1);
  assert.equal(reloaded.records.find((r: any) => r.id === savedId).nextKm, 101000);
  assert.match(reloaded.records[0].parts, /intervalLuni: 12/);
  assert.equal(
    (await request('paid', 'smartdrive/vehicles/' + vehicleId + '/readings', { odometer: 100500 }))
      .status,
    201,
  );
  assert.equal(await scheduleReminders(now), 2);
  assert.equal(await scheduleReminders(now), 0);
  const notifications = await db()
    .select()
    .from(s.notifications)
    .where(eq(s.notifications.recordId, savedId));
  assert.deepEqual(notifications.map((n) => n.offset).sort(), [
    '14',
    'km-before-500',
  ]);
  const accepted: string[] = [];
  await deliverReminders(now, async (notification) => {
    accepted.push(notification.id);
    return 'isolated-provider-id';
  });
  assert.equal(accepted.length, 2);
});
test('PDF and CSV downloads enforce Premium, include actual selected records and remain private', async () => {
  const pdf = await request('paid', 'export?format=pdf&vehicleId=' + vehicleId);
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('content-type'), 'application/pdf');
  assert.match(pdf.headers.get('cache-control') || '', /no-store/);
  const report = await PDFDocument.load(await pdf.arrayBuffer());
  assert.ok(report.getPageCount() >= 1);
  assert.equal(report.getTitle(), 'AutoCare - Raport auto');
  const csv = await request('paid', 'export?format=csv');
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /Distribuție test/);
  assert.equal((await request('free', 'export?format=pdf')).status, 403);
  assert.equal((await request('free', 'export?format=json')).status, 200);
  await revokePremium(accounts.paid.id, accounts.paid.id, { confirm: true });
  assert.equal((await request('paid', 'export?format=pdf')).status, 403);
});
test('advanced preferences cannot be injected by a free account even without a next-km field', async () => {
  const car = await svc.createVehicle(accounts.free.id, {
    brand: 'Test',
    model: 'Free',
    plate: 'FREE01',
    year: 2024,
    fuel: 'Benzină',
    odometer: 0,
  });
  const response = await request('free', 'records', {
    kind: 'service',
    vehicleId: car.id,
    category: 'Distribuție',
    title: 'Blocked',
    date: today,
    parts: 'AutoCare · intervalLuni: 12\nAutoCare · alertDays: 14',
    amountBani: 0,
    amountKnown: false,
  });
  assert.equal(response.status, 403);
});
test('time and mileage are independent, reaching either is due and progress is bounded', () => {
  const date = new Date('2026-10-30T12:00:00Z');
  assert.equal(
    maintenanceStatus({ currentKm: 90000, nextKm: 100000, dueDate: '2026-10-29', today: date })
      .state,
    'overdue',
  );
  assert.equal(
    maintenanceStatus({ currentKm: 100000, nextKm: 100000, dueDate: '2027-10-30', today: date })
      .state,
    'due',
  );
  const overdue = maintenanceStatus({
    currentKm: 101000,
    nextKm: 100000,
    lastKm: 90000,
    dueDate: '2027-10-30',
    today: date,
  });
  assert.equal(overdue.remainingKm, -1000);
  assert.equal(overdue.progress, 100);
  assert.equal(overdue.state, 'overdue');
  assert.equal(
    maintenanceStatus({
      currentKm: 80000,
      nextKm: null,
      lastDate: '2026-10-01',
      dueDate: '2026-10-31',
      today: date,
    }).progress,
    97,
  );
});
test('expired Premium cancels custom alert permissions and insufficient mileage prevents cost-per-km claims', () => {
  const parts = 'AutoCare · alertDays: 14\nAutoCare · alertKm: 1000';
  assert.equal(alertOffsetAllowed('km-before-1000', parts, false, [30, 7, 1, 0], false), false);
  assert.deepEqual(
    reminderOffsets({
      parts,
      paid: false,
      defaults: [30, 7, 1, 0],
      days: 14,
      nextKm: 10000,
      odometer: 9500,
      afterExpiry: false,
    }),
    [],
  );
  assert.equal(
    svc.summarize(
      [
        { vehicleId: 'one', date: today, category: 'Cost', amountBani: 100, odometer: 1000 },
        { vehicleId: 'two', date: today, category: 'Cost', amountBani: 100, odometer: null },
      ],
      now.getUTCFullYear(),
      today.slice(0, 7),
    ).costPerKm,
    null,
  );
});
