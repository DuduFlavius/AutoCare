process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION = 'true';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import Stripe from 'stripe';
import webpush from 'web-push';
import { GET as logoGET } from '../src/app/start/route';
import { Webhook } from 'svix';
import { migrate } from '../scripts/migrate';
import { db, closeLocalDb } from '../src/lib/db';
import * as s from '../src/lib/schema';
import * as svc from '../src/lib/service';
import { date } from '../src/lib/validation';
import { daysRemaining, documentStatus } from '../src/lib/config';
import { scheduleReminders, deliverReminders } from '../src/lib/reminders';
import { auth } from '../src/lib/auth';
import { GET, POST, PATCH, PUT, DELETE } from '../src/app/api/v1/[...path]/route';
import { processStripeEvent } from '../src/lib/billing';
import { emailWebhook } from '../src/lib/email-events';
process.env.LOCAL_DATABASE_PATH = 'memory';
process.env.BETTER_AUTH_SECRET = 'autocare-test-secret-only-not-for-production-32';
process.env.APP_URL = 'http://localhost:3000';
process.env.RESEND_API_KEY = 'test-placeholder';
process.env.EMAIL_FROM = 'AutoCare <test@example.invalid>';
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_placeholder';
process.env.STRIPE_MONTHLY_PRICE_ID = 'price_monthly';
const realFetch = globalThis.fetch;
const mail: Array<{ to: string[]; text: string }> = [];
let uid: string, other: string, cookie: string, car: typeof s.vehicles.$inferSelect;
const now = new Date('2030-03-10T10:00:00Z');
async function call(path: string, method = 'GET', body?: unknown, session = cookie) {
  const req = new Request('http://localhost:3000/api/v1/' + path, {
    method,
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: session || '',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const handler =
    method === 'POST'
      ? POST
      : method === 'PATCH'
        ? PATCH
        : method === 'PUT'
          ? PUT
          : method === 'DELETE'
            ? DELETE
            : GET;
  return handler(req, { params: Promise.resolve({ path: path.split('/') }) });
}
async function authReq(path: string, body?: unknown) {
  return auth().handler(
    new Request('http://localhost:3000/api/auth/' + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
        'x-real-ip': '127.0.0.1',
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
  );
}
before(async () => {
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === 'https://api.resend.com/emails') {
      mail.push(JSON.parse(String(init?.body)));
      return Response.json({ id: 'mail-' + mail.length });
    }
    throw new Error('Unexpected network request in isolated test');
  }) as typeof fetch;
  await migrate();
});
after(async () => {
  globalThis.fetch = realFetch;
  await closeLocalDb();
});
test('01 Registration, email verification, login, session and wrong password', async () => {
  let r = await authReq('sign-up/email', {
    email: 'alice@example.invalid',
    password: 'correct-test-password-123',
    name: 'Alice',
  });
  assert.equal(r.status, 200);
  assert.equal(mail.length, 1);
  r = await authReq('sign-in/email', {
    email: 'alice@example.invalid',
    password: 'correct-test-password-123',
  });
  assert.equal(r.status, 403);
  const url = mail[0].text;
  r = await auth().handler(new Request(url));
  assert.ok([200, 302].includes(r.status));
  r = await authReq('sign-in/email', {
    email: 'alice@example.invalid',
    password: 'correct-test-password-123',
  });
  assert.equal(r.status, 200);
  cookie = r.headers
    .getSetCookie()
    .map((x) => x.split(';')[0])
    .join('; ');
  assert.ok(cookie);
  uid = (await db().select().from(s.user).where(eq(s.user.email, 'alice@example.invalid')))[0].id;
  other = crypto.randomUUID();
  await db()
    .insert(s.user)
    .values({ id: other, name: 'Bob', email: 'bob@example.invalid', emailVerified: true });
  r = await call('dashboard');
  assert.equal(r.status, 200);
  r = await call('dashboard', 'GET', undefined, '');
  assert.equal(r.status, 401);
  r = await authReq('sign-in/email', {
    email: 'alice@example.invalid',
    password: 'incorrect-password',
  });
  assert.equal(r.status, 401);
});
test('02 Password recovery token is required and can reset a password', async () => {
  let r = await authReq('request-password-reset', {
    email: 'alice@example.invalid',
    redirectTo: 'http://localhost:3000/resetare-parola',
  });
  assert.equal(r.status, 200);
  const reset = mail[mail.length - 1].text;
  const token = new URL(reset).pathname.split('/').pop();
  r = await authReq('reset-password', { token, newPassword: 'another-test-password-123' });
  assert.equal(r.status, 200);
  await db().delete(s.rateLimit);
  r = await authReq('sign-in/email', {
    email: 'alice@example.invalid',
    password: 'another-test-password-123',
  });
  assert.equal(r.status, 200);
  cookie = r.headers
    .getSetCookie()
    .map((x) => x.split(';')[0])
    .join('; ');
});
test('03 Car create/edit, free limit including concurrent attempts', async () => {
  const input = {
    brand: 'Dacia',
    model: 'Duster',
    year: 2024,
    plate: 'TM01TEST',
    fuel: 'Benzină',
    odometer: 12000,
  };
  const results = await Promise.allSettled([
    svc.createVehicle(uid, input),
    svc.createVehicle(uid, { ...input, plate: 'TM02TEST' }),
  ]);
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
  car = (results.find((r) => r.status === 'fulfilled') as PromiseFulfilledResult<typeof car>).value;
  const edited = await svc.editVehicle(uid, car.id, { ...input, odometer: 15000 });
  assert.equal(edited.odometer, 15000);
  await assert.rejects(
    () => svc.editVehicle(other, car.id, input),
    (e: unknown) => e instanceof svc.AppError && e.status === 404,
  );
});
test('04 Strict expiry validation, all offsets, past date, month and DST/timezones', () => {
  assert.equal(date.safeParse('2030-02-30').success, false);
  assert.equal(date.safeParse('2032-02-29').success, true);
  for (const n of [30, 14, 7, 3, 1, 0, -1]) {
    const target = new Date(now.getTime() + n * 86400000).toISOString().slice(0, 10);
    assert.equal(daysRemaining(target, now), n);
  }
  assert.equal(documentStatus('2030-03-09', now).state, 'expired');
  assert.equal(documentStatus(null, now).state, 'incomplete');
  assert.equal(daysRemaining('2030-04-01', new Date('2030-03-31T00:30Z'), 'Europe/Bucharest'), 1);
  assert.equal(daysRemaining('2030-03-11', new Date('2030-03-10T23:30Z'), 'Europe/Bucharest'), 0);
  assert.equal(daysRemaining('2030-03-11', new Date('2030-03-10T23:30Z'), 'America/New_York'), 1);
});
test('05 Records enforce owner, track changes, and keep expiry incomplete if omitted', async () => {
  const r = await svc.saveRecord(uid, {
    kind: 'document',
    category: 'RCA',
    title: 'RCA',
    vehicleId: car.id,
    expiresAt: '2030-04-09',
  });
  await assert.rejects(() =>
    svc.saveRecord(other, { kind: 'document', category: 'ITP', title: 'ITP', vehicleId: car.id }),
  );
  await svc.saveRecord(
    uid,
    {
      kind: 'document',
      category: 'RCA',
      title: 'RCA nou',
      vehicleId: car.id,
      expiresAt: '2030-04-09',
    },
    r.id,
  );
  assert.equal(
    (await db().select().from(s.recordHistory).where(eq(s.recordHistory.recordId, r.id))).length,
    1,
  );
  const foreign = await call('records/' + r.id, 'PATCH', {
    kind: 'document',
    category: 'RCA',
    title: 'RCA',
    vehicleId: crypto.randomUUID(),
  });
  assert.equal(foreign.status, 404);
});
test('06 Scheduler offsets, date boundary, deduplication and acceptance', async () => {
  await db()
    .insert(s.subscriptions)
    .values({
      userId: uid,
      subscriptionId: 'sub_fixture',
      status: 'active',
      periodEnd: new Date('2031-01-01'),
    });
  await svc.profile(uid);
  await svc.saveProfile(uid, {
    timezone: 'Europe/Bucharest',
    emailEnabled: true,
    pushEnabled: false,
    afterExpiry: false,
    offsets: [30, 14, 7, 3, 1, 0],
    hour: 9,
  });
  for (const n of [30, 14, 7, 3, 1, 0])
    await svc.saveRecord(uid, {
      kind: 'document',
      category: 'ITP',
      title: 'Alert ' + n,
      vehicleId: car.id,
      expiresAt: new Date(now.getTime() + n * 86400000).toISOString().slice(0, 10),
    });
  const count = await scheduleReminders(now);
  assert.ok(count >= 6);
  assert.equal(await scheduleReminders(now), 0);
  const sent = await deliverReminders(now, async (n) => 'provider-' + n.id);
  assert.equal(sent, count);
  assert.equal(
    await deliverReminders(now, async () => {
      throw new Error('Duplicate');
    }),
    0,
  );
});
test('07 Retry is bounded; parallel workers do not double claim; archive suppresses', async () => {
  const r = await svc.saveRecord(uid, {
    kind: 'document',
    category: 'CASCO',
    title: 'Retry',
    vehicleId: car.id,
    expiresAt: '2030-03-10',
  });
  await scheduleReminders(now);
  let attempts = 0;
  const transient = async () => {
    attempts++;
    throw new Error('EMAIL_PROVIDER_503');
  };
  await deliverReminders(now, transient);
  assert.equal(attempts, 1);
  await deliverReminders(now, transient);
  assert.equal(attempts, 1);
  for (const delta of [3, 8, 17])
    await deliverReminders(new Date(now.getTime() + delta * 60000), transient);
  const n = (
    await db().select().from(s.notifications).where(eq(s.notifications.recordId, r.id))
  )[0];
  assert.equal(n.status, 'failed');
  assert.equal(n.attempts, 4);
  await deliverReminders(new Date(now.getTime() + 35 * 60000), transient);
  assert.equal(attempts, 4);
  const archived = await svc.saveRecord(uid, {
    kind: 'document',
    category: 'ITP',
    title: 'Archived',
    vehicleId: car.id,
    expiresAt: '2030-03-10',
  });
  await scheduleReminders(now);
  await svc.archiveRecord(uid, archived.id);
  let delivered = 0;
  await Promise.all([
    deliverReminders(now, async () => {
      delivered++;
      return 'ok';
    }),
    deliverReminders(now, async () => {
      delivered++;
      return 'ok';
    }),
  ]);
  assert.equal(delivered, 0);
});
test('08 Mileage uses manual odometer and timezone/hour preferences are respected', async () => {
  await svc.saveRecord(uid, {
    kind: 'service',
    category: 'Ulei',
    title: 'Ulei',
    vehicleId: car.id,
    nextKm: 14000,
  });
  const n = await scheduleReminders(now);
  assert.equal(n, 1);
  const km = (await db().select().from(s.notifications).where(eq(s.notifications.offset, 'km')))[0];
  assert.ok(km.message.includes('manual'));
  await svc.saveProfile(uid, {
    timezone: 'America/New_York',
    emailEnabled: true,
    pushEnabled: false,
    afterExpiry: false,
    offsets: [30, 14, 7, 3, 1, 0],
    hour: 23,
  });
  assert.equal(await scheduleReminders(new Date('2030-03-10T12:00Z')), 0);
});
test('09 Private attachment authentication, ownership, MIME and size checks', async () => {
  const r = await svc.saveRecord(uid, {
    kind: 'document',
    category: 'ITP',
    title: 'Fișier',
    vehicleId: car.id,
  });
  const file = await svc.uploadFile(uid, r.id, {
    name: 'test.pdf',
    bytes: Buffer.from('%PDF-1.4 test-only'),
  });
  assert.equal((await svc.getFile(uid, file.id)).name, 'test.pdf');
  await assert.rejects(() => svc.getFile(other, file.id));
  assert.throws(() => svc.detectMime(Buffer.from('<script>alert(1)</script>')));
  await assert.rejects(() =>
    svc.uploadFile(uid, r.id, { name: 'big.pdf', bytes: Buffer.alloc(2097153) }),
  );
  const response = await call('files/' + file.id);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-disposition') || '', /attachment/);
  assert.equal((await call('files/' + file.id, 'GET', undefined, '')).status, 401);
});
test('10 Cost aggregation is exact and CSV mitigates formula injection', () => {
  const rows = [
    { amountBani: 10001, category: 'Ulei', date: '2030-03-01', odometer: 1000, vehicleId: 'a' },
    { amountBani: 999, category: 'Ulei', date: '2030-03-10', odometer: 2000, vehicleId: 'a' },
    { amountBani: 500, category: 'Taxe', date: '2029-03-01', odometer: null, vehicleId: 'a' },
  ];
  const total = svc.summarize(rows, 2030, '2030-03');
  assert.equal(total.annualBani, 11000);
  assert.equal(total.monthBani, 11000);
  assert.equal(total.costPerKm, 0.11);
  assert.match(svc.csv([{ title: '=1+1', note: 'a"b' }]), /'=1\+1/);
  assert.match(svc.csv([{ a: 'a"b' }]), /a""b/);
});
test('11 Cryptographic Stripe signatures, idempotency, failed payments and cancellation', async () => {
  const client = new Stripe('sk_test_placeholder');
  const sub = {
    id: 'sub_test',
    metadata: { userId: uid },
    customer: 'cus_test',
    status: 'active',
    cancel_at_period_end: false,
    latest_invoice: { id: 'in_test', status: 'paid' },
    items: {
      data: [
        {
          price: { id: 'price_monthly' },
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      ],
    },
  };
  const fake = { subscriptions: { retrieve: async () => sub } } as unknown as Stripe;
  const event = {
    id: 'evt_valid',
    type: 'customer.subscription.updated',
    livemode: false,
    data: { object: { id: sub.id } },
  } as Stripe.Event;
  const raw = JSON.stringify(event),
    signature = client.webhooks.generateTestHeaderString({
      payload: raw,
      secret: process.env.STRIPE_WEBHOOK_SECRET!,
    });
  const verified = client.webhooks.constructEvent(
    raw,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  );
  await processStripeEvent(verified, fake);
  assert.equal(await svc.premium(uid), true);
  assert.deepEqual(await processStripeEvent(verified, fake), { duplicate: true });
  assert.throws(() =>
    client.webhooks.constructEvent(raw + ' ', signature, process.env.STRIPE_WEBHOOK_SECRET!),
  );
  sub.status = 'past_due';
  await processStripeEvent({ ...event, id: 'evt_failed' }, fake);
  assert.equal(await svc.premium(uid), false);
  sub.status = 'canceled';
  await processStripeEvent({ ...event, id: 'evt_canceled' }, fake);
  assert.equal(
    (await db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid)))[0].status,
    'canceled',
  );
  assert.equal((await call('billing/webhook', 'POST', event)).status, 400);
});
test('12 Server gates exports, plan upgrades and preferences; GDPR JSON remains free', async () => {
  const response = await GET(
    new Request('http://localhost:3000/api/v1/export?format=json', { headers: { Cookie: cookie } }),
    { params: Promise.resolve({ path: ['export'] }) },
  );
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.user.email, 'alice@example.invalid');
  assert.ok(result.attachments[0].data);
  await assert.rejects(() =>
    svc.saveProfile(uid, {
      timezone: 'Europe/Bucharest',
      emailEnabled: true,
      pushEnabled: false,
      afterExpiry: true,
      offsets: [14],
      hour: 9,
    }),
  );
  assert.equal(
    (
      await GET(
        new Request('http://localhost:3000/api/v1/export?format=pdf', {
          headers: { Cookie: cookie },
        }),
        { params: Promise.resolve({ path: ['export'] }) },
      )
    ).status,
    403,
  );
  await db()
    .update(s.subscriptions)
    .set({ status: 'active', periodEnd: new Date(Date.now() + 86400000) })
    .where(eq(s.subscriptions.userId, uid));
  const pdf = await GET(
    new Request('http://localhost:3000/api/v1/export?format=pdf', { headers: { Cookie: cookie } }),
    { params: Promise.resolve({ path: ['export'] }) },
  );
  assert.equal(pdf.status, 200);
  assert.equal(
    Buffer.from(await pdf.arrayBuffer())
      .subarray(0, 5)
      .toString(),
    '%PDF-',
  );
});
test('13 Server role checks and CSRF reject privilege escalation and foreign origins', async () => {
  assert.equal((await call('admin')).status, 403);
  const req = new Request('http://localhost:3000/api/v1/vehicles', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      Origin: 'https://attacker.invalid',
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  assert.equal((await POST(req, { params: Promise.resolve({ path: ['vehicles'] }) })).status, 403);
  await db().update(s.profiles).set({ role: 'admin' }).where(eq(s.profiles.userId, uid));
  assert.equal((await call('admin')).status, 200);
  assert.equal((await call('admin/limits', 'PUT', { premiumCars: 4, maxFiles: 20 })).status, 403);
  process.env.AUTOCARE_FOUNDER_USER_ID = uid;
  assert.equal((await call('admin/limits', 'PUT', { premiumCars: 4, maxFiles: 20 })).status, 200);
  delete process.env.AUTOCARE_FOUNDER_USER_ID;
  assert.equal((await db().select().from(s.audit)).length, 1);
});
test('14 Verified delivery callback is distinct from provider acceptance', async () => {
  const n = (
    await db().select().from(s.notifications).where(eq(s.notifications.status, 'accepted'))
  )[0];
  assert.ok(n);
  const secret = 'whsec_' + Buffer.from('test-webhook-secret').toString('base64');
  process.env.RESEND_WEBHOOK_SECRET = secret;
  const wh = new Webhook(secret);
  const payload = JSON.stringify({ type: 'email.delivered', data: { email_id: n.providerId } });
  const id = 'msg_test',
    time = new Date();
  const signature = wh.sign(id, time, payload);
  await emailWebhook(
    payload,
    new Headers({
      'svix-id': id,
      'svix-timestamp': String(Math.floor(time.getTime() / 1000)),
      'svix-signature': signature,
    }),
  );
  assert.equal(
    (await db().select().from(s.notifications).where(eq(s.notifications.id, n.id)))[0].status,
    'delivered',
  );
  await assert.rejects(() => emailWebhook(payload, new Headers()));
});
test('15 Account data cascade removes files and records from active database', async () => {
  const id = crypto.randomUUID();
  await db()
    .insert(s.user)
    .values({ id, name: 'Delete', email: 'delete@example.invalid', emailVerified: true });
  const v = await svc.createVehicle(id, {
    brand: 'Test',
    model: 'Test',
    year: 2020,
    plate: 'TMDEL',
    fuel: 'Diesel',
    odometer: 0,
  });
  const r = await svc.saveRecord(id, {
    vehicleId: v.id,
    kind: 'document',
    category: 'ITP',
    title: 'Delete',
  });
  await svc.uploadFile(id, r.id, { name: 'a.pdf', bytes: Buffer.from('%PDF-1.4') });
  await db().delete(s.user).where(eq(s.user.id, id));
  assert.equal((await db().select().from(s.files).where(eq(s.files.userId, id))).length, 0);
  assert.equal((await db().select().from(s.records).where(eq(s.records.userId, id))).length, 0);
});
test('16 Vehicle photos stay private and reject document files', async () => {
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.from('test-image-fixture'),
  ]);
  await svc.uploadVehiclePhoto(uid, car.id, png);
  assert.equal((await call('vehicles/' + car.id + '/photo')).status, 200);
  assert.equal((await call('vehicles/' + car.id + '/photo', 'GET', undefined, '')).status, 401);
  await assert.rejects(() => svc.uploadVehiclePhoto(other, car.id, png));
  await assert.rejects(() => svc.uploadVehiclePhoto(uid, car.id, Buffer.from('%PDF-1.4')));
});
test('17 Full refund of latest invoice revokes Premium and stale subscription events cannot restore it', async () => {
  const sub = {
    id: 'sub_test',
    metadata: { userId: uid },
    customer: 'cus_test',
    status: 'active',
    cancel_at_period_end: false,
    latest_invoice: { id: 'in_current', status: 'paid' },
    items: {
      data: [
        {
          price: { id: 'price_monthly' },
          current_period_end: Math.floor(Date.now() / 1000) + 86400,
        },
      ],
    },
  };
  const fake = {
    subscriptions: { retrieve: async () => sub },
    invoicePayments: { list: async () => ({ data: [{ invoice: 'in_current' }] }) },
    invoices: {
      retrieve: async () => ({
        id: 'in_current',
        amount_paid: 1499,
        currency: 'ron',
        status: 'paid',
        parent: { subscription_details: { subscription: 'sub_test' } },
      }),
    },
  } as unknown as Stripe;
  const event = {
    id: 'evt_refund',
    livemode: false,
    type: 'charge.refunded',
    data: { object: { id: 'ch_refund', refunded: true, payment_intent: 'pi_test' } },
  } as Stripe.Event;
  await processStripeEvent(event, fake);
  assert.equal(await svc.premium(uid), false);
  await processStripeEvent(
    {
      ...event,
      id: 'evt_late_sub',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_test' } },
    } as Stripe.Event,
    fake,
  );
  assert.equal(await svc.premium(uid), false);
  sub.latest_invoice = { id: 'in_renewed', status: 'paid' };
  await processStripeEvent(
    {
      ...event,
      id: 'evt_renewed',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_test' } },
    } as Stripe.Event,
    fake,
  );
  assert.equal(await svc.premium(uid), true);
});
test('18 Free plan cannot receive advanced statistics or gain Premium from checkout URL', async () => {
  await db().update(s.subscriptions).set({ status: 'free' }).where(eq(s.subscriptions.userId, uid));
  const d = await svc.dashboard(uid);
  assert.equal(d.premium, false);
  assert.deepEqual(d.summary.monthly, []);
  assert.deepEqual(d.summary.categories, {});
  const r = await GET(
    new Request('http://localhost:3000/api/v1/dashboard?paid=true&premium=true', {
      headers: { Cookie: cookie },
    }),
    { params: Promise.resolve({ path: ['dashboard'] }) },
  );
  assert.equal((await r.json()).premium, false);
});
test('19 Scheduler is protected; push rejects arbitrary endpoints; body limits apply without Content-Length', async () => {
  assert.equal((await call('jobs/reminders')).status, 401);
  assert.equal(
    (
      await call('push', 'POST', {
        endpoint: 'https://127.0.0.1/internal',
        keys: { p256dh: 'abc', auth: 'abc' },
      })
    ).status,
    400,
  );
  const request = new Request('http://localhost:3000/api/v1/support', {
    method: 'POST',
    headers: {
      Origin: 'http://localhost:3000',
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message: 'x'.repeat(70000) }),
  });
  assert.equal(
    (await POST(request, { params: Promise.resolve({ path: ['support'] }) })).status,
    413,
  );
});
test('19a Push test is authenticated, sends only to the current user and reports provider errors', async () => {
  assert.equal((await call('push/test', 'POST', {}, '')).status, 401);
  const keys = webpush.generateVAPIDKeys();
  process.env.VAPID_PUBLIC_KEY = keys.publicKey;
  process.env.VAPID_PRIVATE_KEY = keys.privateKey;
  process.env.VAPID_SUBJECT = 'https://autocare-garaj.vercel.app/contact';
  await db()
    .insert(s.pushes)
    .values([
      {
        id: crypto.randomUUID(),
        userId: uid,
        endpoint: 'https://fcm.googleapis.com/fcm/send/own',
        keys: { auth: 'fixture', p256dh: 'fixture' },
      },
      {
        id: crypto.randomUUID(),
        userId: other,
        endpoint: 'https://fcm.googleapis.com/fcm/send/foreign',
        keys: { auth: 'fixture', p256dh: 'fixture' },
      },
    ]);
  const original = webpush.sendNotification;
  const sent: string[] = [];
  try {
    webpush.sendNotification = (async (subscription, payload) => {
      sent.push(subscription.endpoint);
      assert.match(String(payload), /Notificări activate/);
      return { statusCode: 201, body: '', headers: {} };
    }) as typeof original;
    assert.equal((await call('push/test', 'POST', {})).status, 200);
    assert.deepEqual(sent, ['https://fcm.googleapis.com/fcm/send/own']);
    webpush.sendNotification = (async () => {
      throw new Error('provider unavailable');
    }) as typeof original;
    assert.notEqual((await call('push/test', 'POST', {})).status, 200);
  } finally {
    webpush.sendNotification = original;
    await db().delete(s.pushes);
  }
});
test('19aa Founder team API rejects anonymous users and authenticated clients', async () => {
  assert.equal(
    (
      await call(
        'founder/team',
        'POST',
        { email: 'bob@example.invalid', role: 'admin', confirm: true },
        '',
      )
    ).status,
    401,
  );
  assert.equal(
    (
      await call('founder/team', 'POST', {
        email: 'bob@example.invalid',
        role: 'admin',
        confirm: true,
      })
    ).status,
    403,
  );
});
test('19b Logo resolves a verified session without exposing data; anonymous stays public', async () => {
  const logged = await logoGET(
    new Request('http://localhost:3000/start', { headers: { Cookie: cookie } }),
  );
  assert.equal(logged.status, 307);
  assert.equal(logged.headers.get('location'), '/cont?tab=Dashboard');
  assert.equal(logged.headers.get('cache-control'), 'private, no-store');
  const anonymous = await logoGET(new Request('http://localhost:3000/start'));
  assert.equal(anonymous.headers.get('location'), '/');
  assert.equal((await call('dashboard', 'GET', undefined, '')).status, 401);
  assert.equal((await call('dashboard')).status, 200);
  assert.equal((await call('dashboard')).status, 200);
});
test('20 Logout revokes session on server', async () => {
  const r = await auth().handler(
    new Request('http://localhost:3000/api/auth/sign-out', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: 'http://localhost:3000',
        'Content-Type': 'application/json',
      },
      body: '{}',
    }),
  );
  assert.equal(r.status, 200);
  assert.equal((await call('dashboard')).status, 401);
  assert.equal(
    (
      await logoGET(new Request('http://localhost:3000/start', { headers: { Cookie: cookie } }))
    ).headers.get('location'),
    '/',
  );
});
test('21 Direct auth deletion cannot bypass billing guard; authenticated deletion removes the account', async () => {
  await db().delete(s.rateLimit);
  let r = await authReq('sign-up/email', {
    email: 'remove@example.invalid',
    name: 'Removal',
    password: 'remove-test-password-123',
  });
  assert.equal(r.status, 200);
  await auth().handler(new Request(mail[mail.length - 1].text));
  r = await authReq('sign-in/email', {
    email: 'remove@example.invalid',
    password: 'remove-test-password-123',
  });
  assert.equal(r.status, 200);
  const cookies = r.headers
    .getSetCookie()
    .map((x) => x.split(';')[0])
    .join('; ');
  const u = (await db().select().from(s.user).where(eq(s.user.email, 'remove@example.invalid')))[0];
  await db()
    .insert(s.subscriptions)
    .values({
      userId: u.id,
      subscriptionId: 'sub_delete',
      status: 'active',
      periodEnd: new Date(Date.now() + 86400000),
    });
  r = await auth().handler(
    new Request('http://localhost:3000/api/auth/delete-user', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: cookies,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: 'remove-test-password-123' }),
    }),
  );
  assert.equal(r.status, 409);
  await db()
    .update(s.subscriptions)
    .set({ status: 'canceled' })
    .where(eq(s.subscriptions.userId, u.id));
  r = await call(
    'account',
    'DELETE',
    { confirm: 'ȘTERGE', password: 'remove-test-password-123' },
    cookies,
  );
  assert.equal(r.status, 200);
  assert.equal((await db().select().from(s.user).where(eq(s.user.id, u.id))).length, 0);
});


test('SmartDrive: manual readings persist, reject regressions, and isolate owner', async () => {
  const id = car.id;
  const start = (await db().select().from(s.vehicles).where(eq(s.vehicles.id, id)))[0].odometer;
  let r = await call('smartdrive/vehicles/' + id + '/readings', 'GET', undefined, '');
  assert.equal(r.status, 401, 'missing session');
  r = await call('smartdrive/vehicles/' + id + '/readings', 'POST', { odometer: start + 100 });
  assert.equal(r.status, 201, await r.text().catch(() => ''));
  const saved = await r.json();
  assert.equal(saved.reading.source, 'manual');
  assert.equal(saved.vehicle.odometer, start + 100);
  r = await call('smartdrive/vehicles/' + id + '/readings', 'POST', { odometer: start + 100 });
  assert.equal(r.status, 201, 'equal odometer is an allowed repeated reading');
  r = await call('smartdrive/vehicles/' + id + '/readings', 'POST', { odometer: start });
  assert.equal(r.status, 400, 'odometer regression rejected');
  r = await call('smartdrive/vehicles/' + id + '/readings', 'POST', { odometer: -1 });
  assert.equal(r.status, 400);
  r = await call('smartdrive/vehicles/' + id + '/readings');
  assert.equal(r.status, 200);
  const rows = await r.json();
  assert.ok(rows.length >= 2);
  assert.ok(rows.every((x: { userId: string; vehicleId: string }) => x.userId === uid && x.vehicleId === id));
  assert.equal((await db().select().from(s.vehicles).where(eq(s.vehicles.id, id)))[0].odometer, start + 100);
  const foreignId = crypto.randomUUID();
  await db().insert(s.vehicles).values({ id: foreignId, userId: other, brand: 'Test', model: 'Isolated', year: 2022, plate: 'OTHERTEST', fuel: 'Benzină', odometer: 500 });
  for (const method of ['GET', 'POST']) {
    const resp = await call('smartdrive/vehicles/' + foreignId + '/readings', method, method === 'POST' ? { odometer: 600 } : undefined);
    assert.equal(resp.status, 404, 'foreign vehicle must be invisible');
  }
  assert.equal((await db().select().from(s.mileageReadings).where(eq(s.mileageReadings.vehicleId, foreignId))).length, 0);
});
test('SmartDrive: GPS trips validate payload and never modify dashboard odometer', async () => {
  const id = car.id;
  const initial = (await db().select().from(s.vehicles).where(eq(s.vehicles.id, id)))[0].odometer;
  const startedAt = '2030-03-10T10:00:00.000Z', endedAt = '2030-03-10T10:10:00.000Z';
  const route = 'smartdrive/vehicles/' + id + '/trips';
  const valid = { distanceMeters: 3200, durationSeconds: 600, startedAt, endedAt };
  let r = await call(route, 'POST', valid);
  assert.equal(r.status, 201);
  const trip = await r.json();
  assert.equal(trip.distanceMeters, 3200);
  assert.equal(trip.durationSeconds, 600);
  for (const invalid of [
    { ...valid, distanceMeters: -1 },
    { ...valid, distanceMeters: 3000000 },
    { ...valid, durationSeconds: -10 },
    { ...valid, endedAt: '2030-03-10T09:00:00.000Z' },
    { ...valid, durationSeconds: 200 },
    { ...valid, startedAt: 'not-a-date' },
  ]) {
    r = await call(route, 'POST', invalid);
    assert.equal(r.status, 400, JSON.stringify(invalid));
  }
  r = await call(route);
  assert.equal(r.status, 200);
  assert.ok((await r.json()).some((x: { id: string }) => x.id === trip.id));
  assert.equal((await db().select().from(s.vehicles).where(eq(s.vehicles.id, id)))[0].odometer, initial);
  r = await call(route, 'GET', undefined, '');
  assert.equal(r.status, 401);
});
test('SmartDrive: reminder preferences validate frequency and persist', async () => {
  let r = await call('smartdrive/preferences');
  assert.equal(r.status, 200);
  r = await call('smartdrive/preferences', 'PUT', { frequencyDays: 3, enabled: true });
  assert.equal(r.status, 200);
  r = await call('smartdrive/preferences');
  assert.equal((await r.json()).frequencyDays, 3);
  for (const frequencyDays of [0, 91, 2.5, '3']) {
    r = await call('smartdrive/preferences', 'PUT', { frequencyDays, enabled: true });
    assert.equal(r.status, 400);
  }
  r = await call('smartdrive/preferences', 'PUT', { frequencyDays: 7, enabled: false });
  assert.equal(r.status, 200);
  r = await call('smartdrive/preferences');
  assert.deepEqual({ frequencyDays: (await r.json()).frequencyDays }, { frequencyDays: 7 });
});
