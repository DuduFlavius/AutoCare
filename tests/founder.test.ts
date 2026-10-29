import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq, sql } from 'drizzle-orm';
import { readFile } from 'node:fs/promises';
import { migrate } from '../scripts/migrate';
import { db, closeLocalDb } from '../src/lib/db';
import * as s from '../src/lib/schema';
import * as f from '../src/lib/founder';
import * as svc from '../src/lib/service';
import { effectiveRole } from '../src/lib/permissions';
import { profileInput, recordInput } from '../src/lib/validation';
import { pricing } from '../src/lib/pricing';
import { savings } from '../src/lib/pricing-display';
process.env.LOCAL_DATABASE_PATH = 'memory';
const founder = crypto.randomUUID(),
  admin = crypto.randomUUID(),
  client = crypto.randomUUID();
process.env.AUTOCARE_FOUNDER_USER_ID = founder;
const denied = (e: unknown) => !!e && typeof e === 'object' && 'status' in e && e.status === 403;
before(async () => {
  await migrate();
  for (const [id, role] of [
    [founder, 'user'],
    [admin, 'admin'],
    [client, 'user'],
  ]) {
    await db()
      .insert(s.user)
      .values({ id, name: role, email: id + '@example.invalid', emailVerified: true });
    await db().insert(s.profiles).values({ userId: id, role });
  }
});
after(closeLocalDb);
test('Founder is configuration-bound; profile and stored founder cannot escalate', async () => {
  assert.equal(effectiveRole(client, 'founder'), 'user');
  assert.equal(effectiveRole(founder, 'user'), 'founder');
  assert.equal(profileInput.safeParse({ role: 'founder' }).success, false);
  await assert.rejects(() => f.requireFounder(admin), denied);
  await assert.rejects(() => f.requireFounder(client), denied);
  await assert.rejects(() => f.changeRole(admin, client, { role: 'admin', confirm: true }), denied);
  await assert.rejects(() => f.changeRole(founder, client, { role: 'founder', confirm: true }));
  await assert.rejects(
    () => f.changeRole(founder, founder, { role: 'user', confirm: true }),
    denied,
  );
  await f.changeRole(founder, client, { role: 'assistant', confirm: true });
  assert.equal((await svc.profile(client)).role, 'assistant');
  await f.changeRole(founder, client, { role: 'user', confirm: true });
});
test('Founder adds team members by exact email and revokes admin and assistant immediately', async () => {
  const id = crypto.randomUUID();
  await db()
    .insert(s.user)
    .values({ id, name: 'New team member', email: 'team@example.invalid', emailVerified: false });
  await assert.rejects(
    () => f.addTeamMember(admin, { email: 'team@example.invalid', role: 'admin', confirm: true }),
    denied,
  );
  await assert.rejects(
    () =>
      f.addTeamMember(client, { email: 'team@example.invalid', role: 'assistant', confirm: true }),
    denied,
  );
  await assert.rejects(
    () =>
      f.addTeamMember(founder, { email: 'missing@example.invalid', role: 'admin', confirm: true }),
    (error: unknown) =>
      !!error && typeof error === 'object' && 'status' in error && error.status === 404,
  );
  await assert.rejects(() =>
    f.addTeamMember(founder, { email: 'team@example.invalid', role: 'founder', confirm: true }),
  );
  const previous = process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION;
  process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION = 'false';
  try {
    await f.addTeamMember(founder, {
      email: 'TEAM@example.invalid',
      role: 'assistant',
      confirm: true,
    });
    assert.equal((await svc.profile(id)).role, 'assistant');
    await f.addTeamMember(founder, { email: 'team@example.invalid', role: 'admin', confirm: true });
    assert.equal((await svc.profile(id)).role, 'admin');
    await f.changeRole(founder, id, { role: 'user', confirm: true });
    assert.equal((await svc.profile(id)).role, 'user');
    assert.equal((await db().select().from(s.audit).where(eq(s.audit.target, id))).length, 3);
    process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION = 'true';
    await assert.rejects(() =>
      f.addTeamMember(founder, { email: 'team@example.invalid', role: 'admin', confirm: true }),
    );
  } finally {
    if (previous === undefined) delete process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION;
    else process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION = previous;
  }
});
test('Manual Premium extends, revokes, supports explicit lifetime and never creates payments', async () => {
  const a = await f.grantPremium(founder, client, { months: 1, note: 'Cadou' });
  assert.equal(await svc.premium(client), true);
  const b = await f.grantPremium(founder, client, { months: 3 });
  assert.ok(b.expiresAt! > a.expiresAt!);
  await assert.rejects(() => f.revokePremium(founder, client, { confirm: false }));
  await f.revokePremium(founder, client, { confirm: true });
  assert.equal(await svc.premium(client), false);
  await f.grantPremium(founder, client, { lifetime: true });
  assert.equal((await f.founderUserDetail(founder, client)).grants[0].expiresAt, null);
  assert.equal((await db().select().from(s.invoices)).length, 0);
  const overview = await f.founderOverview(founder);
  assert.equal(overview.manualPremium, 1);
  assert.equal(overview.paidPremium, 0);
  assert.deepEqual(overview.revenues, []);
  await assert.rejects(() => f.grantPremium(admin, client, { months: 1 }), denied);
});
test('Suspension denies protected operations and founder remains protected', async () => {
  await f.suspendAccount(founder, client, { suspended: true, confirm: true });
  await assert.rejects(() => svc.assertActiveAccount(client), denied);
  await f.suspendAccount(founder, client, { suspended: false, confirm: true });
  await svc.assertActiveAccount(client);
  await assert.rejects(
    () => f.suspendAccount(founder, founder, { suspended: true, confirm: true }),
    denied,
  );
  assert.ok((await db().select().from(s.audit).where(eq(s.audit.actorId, founder))).length >= 7);
});
test('RON prices and exact yearly savings are server-derived', async () => {
  const p = await pricing();
  assert.equal(p.monthlyBani, 15000);
  assert.equal(p.annualBani, 170000);
  assert.equal(p.currency, 'ron');
  const save = savings(p.monthlyBani, p.annualBani);
  assert.equal(save.annualMonthlyBani, 180000);
  assert.equal(save.savingBani, 10000);
  assert.equal(save.savingPercent.toFixed(1), '5.6');
  await assert.rejects(() => f.changePricing(admin, { ...p, confirm: true }), denied);
});
test('Calendar extension clamps month end and document validation rejects reversed dates', () => {
  assert.equal(
    f.addCalendarMonths(new Date('2027-01-31T12:00:00Z'), 1).toISOString(),
    '2027-02-28T12:00:00.000Z',
  );
  assert.equal(
    recordInput.safeParse({
      vehicleId: crypto.randomUUID(),
      kind: 'document',
      category: 'RCA',
      title: 'RCA',
      date: '2026-10-20',
      expiresAt: '2026-01-01',
    }).success,
    false,
  );
});
test('Documents and service persist minimal/full data, edit without duplicates and archive safely', async () => {
  const car = await svc.createVehicle(client, {
    brand: 'Dacia',
    model: 'Duster',
    plate: 'B123ABC',
    year: 2022,
    fuel: 'Benzină',
    odometer: 50000,
  });
  const rca = await svc.saveRecord(client, {
    vehicleId: car.id,
    kind: 'document',
    category: 'RCA',
    title: 'RCA',
    date: '2026-10-01',
    expiresAt: '2027-10-01',
  });
  const edited = await svc.saveRecord(
    client,
    {
      vehicleId: car.id,
      kind: 'document',
      category: 'RCA',
      title: 'RCA actualizat',
      expiresAt: '2027-10-02',
    },
    rca.id,
  );
  assert.equal(edited.id, rca.id);
  assert.equal(edited.revision, 2);
  const minimal = await svc.saveRecord(client, {
    vehicleId: car.id,
    kind: 'service',
    category: 'Schimb ulei',
    title: 'Schimb ulei',
    date: '2026-10-20',
    amountKnown: false,
    amountBani: 12345,
  });
  assert.equal(minimal.amountKnown, false);
  assert.equal(minimal.amountBani, 0);
  const full = await svc.saveRecord(client, {
    vehicleId: car.id,
    kind: 'service',
    category: 'Revizie generală',
    title: 'Revizie',
    date: '2026-10-20',
    amountBani: 70000,
    odometer: 50100,
    provider: 'Atelier',
    number: 'F001',
    parts: 'Ulei, filtre',
    notes: 'Verificat',
  });
  assert.equal(full.parts, 'Ulei, filtre');
  assert.equal(full.amountBani, 70000);
  await assert.rejects(() =>
    svc.saveRecord(admin, {
      vehicleId: car.id,
      kind: 'service',
      category: 'Altă operațiune',
      title: 'Interzis',
    }),
  );
  await svc.archiveRecord(client, rca.id);
  const dashboard = await svc.dashboard(client);
  assert.equal(dashboard.records.filter((r) => r.id === rca.id).length, 1);
  assert.equal(dashboard.records.find((r) => r.id === rca.id)?.cancelled, true);
  assert.equal(dashboard.records.find((r) => r.id === minimal.id)?.amountKnown, false);
  await svc.archiveVehicle(client, car.id);
  assert.equal(
    (await db().select().from(s.records).where(eq(s.records.vehicleId, car.id))).length,
    3,
  );
});

test('Legacy manual subscription imports without payment and revocation cannot leave hidden Premium', async () => {
  await db()
    .insert(s.subscriptions)
    .values({ userId: client, status: 'active', periodEnd: new Date('2099-12-31') });
  await db().execute(sql.raw(await readFile('migrations/0008_legacy_premium.sql', 'utf8')));
  assert.equal(
    (
      await db()
        .select()
        .from(s.premiumGrants)
        .where(eq(s.premiumGrants.id, 'legacy-premium-' + client))
    ).length,
    1,
  );
  assert.equal((await svc.dashboard(client)).premiumAccess.paid, false);
  await f.revokePremium(founder, client, { confirm: true });
  assert.equal(await svc.premium(client), false);
  assert.equal((await db().select().from(s.invoices)).length, 0);
});

test('Only founder can save a strictly validated public Google ownership token with audit', async () => {
  const token = 'test_GoogleVerificationToken_1234567890';
  await assert.rejects(() => f.saveFounderSeo(admin, { googleVerification: token }), denied);
  await assert.rejects(() => f.saveFounderSeo(client, { googleVerification: token }), denied);
  await assert.rejects(() =>
    f.saveFounderSeo(founder, { googleVerification: '<script>alert(1)</script>' }),
  );
  await f.saveFounderSeo(founder, {
    googleVerification: '<meta name="google-site-verification" content="' + token + '" />',
  });
  assert.equal((await f.founderSeo(founder)).googleVerification, token);
  assert.equal(
    (await db().select().from(s.audit).where(eq(s.audit.action, 'seo.google-verification.updated')))
      .length,
    1,
  );
});

test('Founder Premium list and filters match active manual, paid, expired and legacy access after revocation', async () => {
  const ids = Object.fromEntries(
    ['free', 'manual', 'paid', 'both', 'expired', 'legacy'].map((key) => [
      key,
      crypto.randomUUID(),
    ]),
  );
  for (const [key, id] of Object.entries(ids))
    await db()
      .insert(s.user)
      .values({
        id,
        name: 'Listing Premium ' + key,
        email: id + '@example.invalid',
        emailVerified: true,
      });
  await f.grantPremium(founder, ids.manual, { lifetime: true });
  await f.grantPremium(founder, ids.both, { months: 1 });
  for (const key of ['paid', 'both', 'legacy'])
    await db()
      .insert(s.subscriptions)
      .values({
        userId: ids[key],
        status: 'active',
        periodEnd: new Date('2099-01-01'),
        subscriptionId: key === 'legacy' ? null : 'sub_' + key,
      });
  await db()
    .insert(s.premiumGrants)
    .values({
      id: crypto.randomUUID(),
      userId: ids.expired,
      grantedBy: founder,
      expiresAt: new Date('2020-01-01'),
    });
  const list = await f.founderUsers(founder, new URLSearchParams({ q: 'Listing Premium' }));
  assert.equal(list.rows.length, 6);
  for (const u of list.rows)
    assert.equal(u.premiumPaid || u.premiumManual, await svc.premium(u.id));
  assert.equal(list.rows.find((u) => u.id === ids.manual)?.premiumLifetime, true);
  const active = await f.founderUsers(
    founder,
    new URLSearchParams({ q: 'Listing Premium', premium: 'active' }),
  );
  assert.equal(active.total, 3);
  assert.match(active.rows.find((u) => u.id === ids.paid)!.premiumExpiresAt!, /^2099-01-01T/);
  assert.equal(
    (await f.founderUsers(founder, new URLSearchParams({ q: 'Listing Premium', premium: 'free' })))
      .total,
    3,
  );
  assert.equal(
    (await f.founderUsers(founder, new URLSearchParams({ q: 'Listing Premium', premium: 'paid' })))
      .total,
    2,
  );
  await f.revokePremium(founder, ids.manual, { confirm: true });
  await f.revokePremium(founder, ids.both, { confirm: true });
  const after = await f.founderUsers(
    founder,
    new URLSearchParams({ q: 'Listing Premium', premium: 'active' }),
  );
  assert.equal(after.total, 2);
  const detail = await f.founderUserDetail(founder, ids.both);
  assert.equal(detail.access.active, true);
  assert.equal(detail.access.manual, false);
  assert.equal(detail.access.paid, true);
  assert.equal((await f.founderUserDetail(founder, ids.manual)).access.active, false);
});
