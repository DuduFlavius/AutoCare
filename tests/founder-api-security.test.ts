import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { migrate } from '../scripts/migrate';
import { db, closeLocalDb } from '../src/lib/db';
import * as s from '../src/lib/schema';
import { auth } from '../src/lib/auth';
import { GET, POST, PUT, DELETE } from '../src/app/api/v1/[...path]/route';
import { isFounder, effectiveRole } from '../src/lib/permissions';
import { premium } from '../src/lib/service';
delete process.env.DATABASE_URL;
delete process.env.VERCEL;
process.env.LOCAL_DATABASE_PATH = 'memory';
process.env.APP_URL = 'http://localhost:3000';
process.env.BETTER_AUTH_SECRET = 'isolated-founder-security-secret-at-least-32-characters';
process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION = 'false';
const accounts: Record<string, { id: string; cookie: string }> = {};
before(async () => {
  await migrate();
  for (const role of ['founder', 'admin', 'user']) {
    const response = await auth().handler(
      new Request('http://localhost:3000/api/auth/sign-up/email', {
        method: 'POST',
        headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Security test ' + role,
          email: role + '@founder-test.invalid',
          password: 'isolated-security-password-123',
        }),
      }),
    );
    assert.equal(response.status, 200);
    const user = (
      await db()
        .select()
        .from(s.user)
        .where(eq(s.user.email, role + '@founder-test.invalid'))
    )[0];
    accounts[role] = {
      id: user.id,
      cookie: response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    };
    await db()
      .insert(s.profiles)
      .values({ userId: user.id, role: role === 'admin' ? 'admin' : 'user' })
      .onConflictDoUpdate({
        target: s.profiles.userId,
        set: { role: role === 'admin' ? 'admin' : 'user' },
      });
  }
  process.env.AUTOCARE_FOUNDER_USER_ID = accounts.founder.id;
});
after(closeLocalDb);
async function request(actor: string, path: string, method = 'GET', body?: unknown) {
  const handler =
    method === 'POST' ? POST : method === 'PUT' ? PUT : method === 'DELETE' ? DELETE : GET;
  return handler(
    new Request('http://localhost:3000/api/v1/' + path, {
      method,
      headers: {
        Origin: 'http://localhost:3000',
        Cookie: accounts[actor]?.cookie || '',
        'Content-Type': 'application/json',
        'x-user-id': accounts.founder.id,
        'x-role': 'founder',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: path.split('/') }) },
  );
}
test('client and admin sessions cannot read founder data, grant or revoke Premium, change roles or pricing', async () => {
  const victim = accounts.user.id;
  for (const actor of ['user', 'admin']) {
    for (const [path, method, body] of [
      ['founder/overview', 'GET', undefined],
      ['founder/users', 'GET', undefined],
      ['founder/users/' + victim, 'GET', undefined],
      ['founder/users/' + victim + '/premium', 'POST', { lifetime: true }],
      ['founder/users/' + victim + '/premium', 'DELETE', { confirm: true }],
      ['founder/users/' + victim + '/role', 'POST', { role: 'founder', confirm: true }],
      ['founder/pricing', 'POST', {}],
      ['founder/team', 'POST', {}],
      ['founder/mail', 'GET', undefined],
      ['founder/unrecognized', 'POST', {}],
    ] as const) {
      const response = await request(actor, path, method, body);
      assert.equal(response.status, 403, actor + ' ' + path);
      assert.match((await response.json()).error, /Fondator/);
    }
  }
  assert.equal(await premium(victim), false);
  assert.equal((await db().select().from(s.premiumGrants)).length, 0);
  assert.equal((await request('anonymous', 'founder/overview')).status, 401);
});
test('only the configured founder can grant and revoke manual Premium; a forged stored role cannot inherit access', async () => {
  const victim = accounts.user.id;
  assert.equal(
    (
      await request('founder', 'founder/users/' + victim + '/premium', 'POST', {
        months: 1,
        note: 'Isolated authorization test',
      })
    ).status,
    200,
  );
  assert.equal(await premium(victim), true);
  // Premium access never grants platform administration.
  assert.equal((await request('user', 'founder/overview')).status, 403);
  await db().update(s.profiles).set({ role: 'founder' }).where(eq(s.profiles.userId, victim));
  assert.equal(effectiveRole(victim, 'founder'), 'user');
  assert.equal(
    (await request('user', 'founder/users/' + victim + '/premium', 'POST', { lifetime: true }))
      .status,
    403,
  );
  assert.equal(
    (await request('admin', 'founder/users/' + victim + '/premium', 'DELETE', { confirm: true }))
      .status,
    403,
  );
  assert.equal(await premium(victim), true);
  assert.equal(
    (await request('founder', 'founder/users/' + victim + '/premium', 'DELETE', { confirm: true }))
      .status,
    200,
  );
  assert.equal(await premium(victim), false);
  const logs = await db().select().from(s.audit);
  assert.ok(
    logs
      .filter((log) => log.action.startsWith('premium.'))
      .every((log) => log.actorId === accounts.founder.id),
  );
});
test('missing founder configuration fails closed for every account and profile injection cannot promote a client', async () => {
  const id = process.env.AUTOCARE_FOUNDER_USER_ID;
  try {
    delete process.env.AUTOCARE_FOUNDER_USER_ID;
    assert.equal(isFounder(accounts.founder.id), false);
    assert.equal(effectiveRole(accounts.founder.id, 'founder'), 'user');
    assert.equal((await request('founder', 'founder/overview')).status, 403);
  } finally {
    process.env.AUTOCARE_FOUNDER_USER_ID = id;
  }
  const response = await request('user', 'profile', 'PUT', { role: 'founder', premium: true });
  assert.equal(response.status, 400);
  assert.equal(isFounder(accounts.user.id), false);
});
