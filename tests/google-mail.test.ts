import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { eq } from 'drizzle-orm';
import { migrate } from '../scripts/migrate';
import { db, closeLocalDb } from '../src/lib/db';
import * as s from '../src/lib/schema';
import * as mail from '../src/lib/google-mail';
import { encryptedBackup } from '../src/lib/backup';
import { createDecipheriv, createHash } from 'node:crypto';
process.env.LOCAL_DATABASE_PATH = 'memory';
process.env.BETTER_AUTH_SECRET = 'test-only-autocare-mail-secret-at-least-32-characters';
process.env.GOOGLE_MAIL_CLIENT_ID = 'test-client';
process.env.GOOGLE_MAIL_CLIENT_SECRET = 'test-client-secret';
process.env.GOOGLE_MAIL_REDIRECT_URI = mail.GOOGLE_MAIL_CALLBACK;
process.env.GOOGLE_MAIL_FROM = 'contactautocare9@gmail.com';
const uid = crypto.randomUUID(),
  admin = crypto.randomUUID(),
  client = crypto.randomUUID();
process.env.AUTOCARE_FOUNDER_USER_ID = uid;
const originalFetch = globalThis.fetch;
const session = 'founder-session';
const requests: { url: string; init?: RequestInit }[] = [];
let omitRefresh = false;
let providerFailure = false,
  scope = mail.GOOGLE_MAIL_SCOPE;
before(async () => {
  await migrate();
  for (const [id, role] of [
    [uid, 'user'],
    [admin, 'admin'],
    [client, 'user'],
  ]) {
    await db()
      .insert(s.user)
      .values({ id, name: role, email: `${id}@example.invalid`, emailVerified: true });
    await db().insert(s.profiles).values({ userId: id, role });
  }
  globalThis.fetch = (async (url, init) => {
    requests.push({ url: String(url), init });
    if (providerFailure)
      return Response.json({ error: 'sensitive-provider-response' }, { status: 400 });
    if (String(url).endsWith('/token'))
      return Response.json({
        access_token: 'test-access-token',
        refresh_token: omitRefresh ? undefined : 'test-refresh-token',
        token_type: 'Bearer',
        scope,
      });
    return Response.json({ id: 'message-id' });
  }) as typeof fetch;
});
after(async () => {
  globalThis.fetch = originalFetch;
  await closeLocalDb();
});
const forbidden = (e: unknown) => !!e && typeof e === 'object' && 'status' in e && e.status === 403;
async function start() {
  const result = await mail.beginGoogleMail(uid, session);
  const state = new URL(result.url).searchParams.get('state')!;
  const cookie = result.cookie.split(';')[0];
  return { ...result, state, cookie, fullCookie: result.cookie };
}
const callback = (state: string, cookie: string, extra = '') =>
  new Request(`${mail.GOOGLE_MAIL_CALLBACK}?state=${state}&code=test-code${extra}`, {
    headers: { cookie },
  });
test('Only configuration-bound Founder can connect, inspect, test or disconnect Gmail', async () => {
  for (const id of [admin, client]) {
    await assert.rejects(() => mail.googleMailStatus(id), forbidden);
    await assert.rejects(() => mail.beginGoogleMail(id, session), forbidden);
    await assert.rejects(() => mail.completeGoogleMail(id, session, callback('x', '')), forbidden);
    await assert.rejects(() => mail.testGoogleMail(id), forbidden);
    await assert.rejects(() => mail.disconnectGoogleMail(id), forbidden);
  }
  assert.equal(requests.length, 0);
});
test('OAuth requests only gmail.send, offline consent and S256 with a secure browser cookie', async () => {
  const result = await start();
  const params = new URL(result.url).searchParams;
  assert.equal(params.get('scope'), mail.GOOGLE_MAIL_SCOPE);
  assert.equal(params.get('redirect_uri'), mail.GOOGLE_MAIL_CALLBACK);
  assert.equal(params.get('code_challenge_method'), 'S256');
  assert.equal(params.get('access_type'), 'offline');
  assert.equal(params.get('include_granted_scopes'), 'false');
  assert.match(result.fullCookie, /HttpOnly; Secure; SameSite=Lax; Max-Age=600/);
  assert.ok(!result.url.includes('test-client-secret'));
  const dump = JSON.stringify(await db().select().from(s.settings));
  assert.ok(!dump.includes(result.state));
  assert.ok(!dump.includes(result.cookie.split('=')[1].split(';')[0]));
});
test('State, browser and session must match; expired or replaced flows never exchange codes', async () => {
  const result = await start();
  await assert.rejects(() =>
    mail.completeGoogleMail(uid, session, callback('bad-state', result.cookie)),
  );
  await assert.rejects(() =>
    mail.completeGoogleMail(uid, 'different-session', callback(result.state, result.cookie)),
  );
  await assert.rejects(() => mail.completeGoogleMail(uid, session, callback(result.state, '')));
  const now = Date.now;
  Date.now = () => now() + 601000;
  try {
    await assert.rejects(() =>
      mail.completeGoogleMail(uid, session, callback(result.state, result.cookie)),
    );
  } finally {
    Date.now = now;
  }
  await start();
  await assert.rejects(() =>
    mail.completeGoogleMail(uid, session, callback(result.state, result.cookie)),
  );
  assert.equal(requests.length, 0);
});
test('Cancellation consumes state; broader grants and missing offline access are rejected', async () => {
  let result = await start();
  await assert.rejects(() =>
    mail.completeGoogleMail(
      uid,
      session,
      callback(result.state, result.cookie, '&error=access_denied'),
    ),
  );
  await assert.rejects(() =>
    mail.completeGoogleMail(uid, session, callback(result.state, result.cookie)),
  );
  assert.equal(requests.length, 0);
  result = await start();
  scope = mail.GOOGLE_MAIL_SCOPE + ' https://www.googleapis.com/auth/gmail.readonly';
  await assert.rejects(() =>
    mail.completeGoogleMail(uid, session, callback(result.state, result.cookie)),
  );
  assert.equal((await mail.googleMailStatus(uid)).connected, false);
  scope = mail.GOOGLE_MAIL_SCOPE;
  result = await start();
  omitRefresh = true;
  await assert.rejects(() =>
    mail.completeGoogleMail(uid, session, callback(result.state, result.cookie)),
  );
  assert.equal((await mail.googleMailStatus(uid)).connected, false);
  omitRefresh = false;
});
test('Callback is atomic single-use, stores encrypted refresh authorization and exposes only safe status', async () => {
  const result = await start();
  const before = requests.length;
  const outcomes = await Promise.allSettled(
    [1, 2].map(() => mail.completeGoogleMail(uid, session, callback(result.state, result.cookie))),
  );
  assert.equal(outcomes.filter((x) => x.status === 'fulfilled').length, 1);
  assert.equal(requests.length - before, 1);
  const params = new URLSearchParams(String(requests.at(-1)!.init!.body));
  assert.equal(params.get('grant_type'), 'authorization_code');
  assert.equal(
    createHash('sha256').update(params.get('code_verifier')!).digest('base64url'),
    new URL(result.url).searchParams.get('code_challenge'),
  );
  const dump = JSON.stringify(await db().select().from(s.settings));
  for (const secret of [
    'test-refresh-token',
    'test-access-token',
    'test-client-secret',
    'test-code',
  ])
    assert.ok(!dump.includes(secret));
  const status = await mail.googleMailStatus(uid);
  assert.equal(status.connected, true);
  assert.equal(status.testedAt, null);
  assert.equal(status.automaticEnabled, false);
  assert.ok(!JSON.stringify(status).includes('token'));
});
test('Private Gmail authorization is excluded from exported backups', async () => {
  const key = Buffer.alloc(32, 7);
  const backup = JSON.parse((await encryptedBackup(key)).toString());
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(backup.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(backup.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(backup.data, 'base64')),
    decipher.final(),
  ]).toString();
  assert.ok(!plaintext.includes('private:google-mail:'));
});
test('Test email refreshes server-side and sends only to configured mailbox, without enabling automation', async () => {
  const before = requests.length;
  const result = await mail.testGoogleMail(uid);
  assert.equal(requests.length - before, 2);
  const send = requests.at(-1)!;
  assert.equal(
    send.url,
    'https://gmail.googleapis.com/gmail/v1/users/contactautocare9%40gmail.com/messages/send',
  );
  const raw = Buffer.from(JSON.parse(String(send.init!.body)).raw, 'base64url').toString();
  assert.match(raw, /To: contactautocare9@gmail.com/);
  assert.match(raw, /From: AutoCare <contactautocare9@gmail.com>/);
  assert.equal(result.automaticEnabled, false);
  assert.ok((await mail.googleMailStatus(uid)).testedAt);
  await assert.rejects(
    () => mail.testGoogleMail(uid),
    (e: unknown) => !!e && typeof e === 'object' && 'status' in e && e.status === 429,
  );
  assert.equal(requests.length - before, 2);
});
test('Provider errors are sanitized and config/key changes require reconnection', async () => {
  const result = await start();
  providerFailure = true;
  await assert.rejects(
    () => mail.completeGoogleMail(uid, session, callback(result.state, result.cookie)),
    (e: unknown) => !String(e).includes('sensitive-provider-response'),
  );
  providerFailure = false;
  const saved = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = 'a-different-test-only-key-at-least-32-characters';
  assert.equal((await mail.googleMailStatus(uid)).reconnectRequired, true);
  process.env.BETTER_AUTH_SECRET = saved;
  process.env.GOOGLE_MAIL_CLIENT_ID = 'changed-client';
  assert.equal((await mail.googleMailStatus(uid)).connected, false);
  process.env.GOOGLE_MAIL_CLIENT_ID = 'test-client';
  await mail.disconnectGoogleMail(uid);
  assert.equal((await mail.googleMailStatus(uid)).connected, false);
  assert.equal(
    (
      await db()
        .select()
        .from(s.settings)
        .where(eq(s.settings.key, 'private:google-mail:connection'))
    ).length,
    0,
  );
  process.env.GOOGLE_MAIL_REDIRECT_URI = 'https://other.invalid/callback';
  assert.equal((await mail.googleMailStatus(uid)).configured, false);
});
