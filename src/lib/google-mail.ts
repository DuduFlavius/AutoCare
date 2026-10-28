import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { and, eq, sql } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
import { requireFounder } from './founder';
import { AppError } from './service';

export const GOOGLE_MAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.send';
export const GOOGLE_MAIL_CALLBACK = 'https://project-sxage.vercel.app/api/v1/mail/google/callback';
const CONNECTION = 'private:google-mail:connection';
const STATE_PREFIX = 'private:google-mail:state:';
const COOKIE = '__Host-autocare-mail-oauth';
const AAD = Buffer.from('autocare/google-mail/v1');
type Pending = {
  state: string;
  verifier: string;
  browser: string;
  session: string;
  expires: number;
};
type Connection = {
  refresh: string;
  from: string;
  client: string;
  connectedAt: string;
  testedAt: string | null;
};

function config() {
  const client = process.env.GOOGLE_MAIL_CLIENT_ID;
  const secret = process.env.GOOGLE_MAIL_CLIENT_SECRET;
  const from = process.env.GOOGLE_MAIL_FROM?.trim().toLowerCase();
  const redirect = process.env.GOOGLE_MAIL_REDIRECT_URI;
  if (
    !client ||
    !secret ||
    redirect !== GOOGLE_MAIL_CALLBACK ||
    !from ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/.test(from)
  )
    throw new AppError(503, 'Configurarea Gmail este incompletă.');
  encryptionKey();
  return { client, secret, from, redirect };
}
function encryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new AppError(503, 'Criptarea Gmail nu este configurată.');
  return Buffer.from(hkdfSync('sha256', secret, 'autocare-google-mail', 'authorization-v1', 32));
}
function seal(value: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(AAD);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return {
    v: 1,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: data.toString('base64url'),
  };
}
function unseal<T>(value: unknown): T {
  try {
    const v = value as ReturnType<typeof seal>;
    if (v.v !== 1) throw new Error();
    const decipher = createDecipheriv(
      'aes-256-gcm',
      encryptionKey(),
      Buffer.from(v.iv, 'base64url'),
    );
    decipher.setAAD(AAD);
    decipher.setAuthTag(Buffer.from(v.tag, 'base64url'));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(v.data, 'base64url')),
        decipher.final(),
      ]).toString(),
    );
  } catch {
    throw new AppError(503, 'Autorizarea Gmail trebuie reconectată.');
  }
}
const hash = (value: string) => createHash('sha256').update(value).digest('base64url');
function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
async function read(key: string) {
  return (await db().select().from(s.settings).where(eq(s.settings.key, key)))[0];
}
async function store(key: string, value: unknown) {
  const encrypted = seal(value);
  await db()
    .insert(s.settings)
    .values({ key, value: encrypted })
    .onConflictDoUpdate({ target: s.settings.key, set: { value: encrypted } });
}
async function connection() {
  const c = config();
  const row = await read(CONNECTION);
  if (!row) throw new AppError(409, 'Conectează mai întâi contul Gmail.');
  const value = unseal<Connection>(row.value);
  if (value.client !== c.client || value.from !== c.from)
    throw new AppError(409, 'Configurația Gmail s-a schimbat. Reconectează contul.');
  return { value, row, c };
}
export async function googleMailStatus(uid: string) {
  await requireFounder(uid);
  let c;
  try {
    c = config();
  } catch {
    return { configured: false, connected: false, automaticEnabled: false };
  }
  const row = await read(CONNECTION);
  if (!row) return { configured: true, connected: false, from: c.from, automaticEnabled: false };
  try {
    const { value } = await connection();
    return {
      configured: true,
      connected: true,
      from: c.from,
      connectedAt: value.connectedAt,
      testedAt: value.testedAt,
      automaticEnabled: false,
    };
  } catch {
    return {
      configured: true,
      connected: false,
      from: c.from,
      reconnectRequired: true,
      automaticEnabled: false,
    };
  }
}
export async function beginGoogleMail(uid: string, sessionId: string) {
  await requireFounder(uid);
  const c = config();
  const state = randomBytes(32).toString('base64url');
  const browser = randomBytes(32).toString('base64url');
  const verifier = randomBytes(32).toString('base64url');
  await store(STATE_PREFIX + uid, {
    state,
    verifier,
    browser: hash(browser),
    session: hash(sessionId),
    expires: Date.now() + 600000,
  } satisfies Pending);
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: c.client,
    redirect_uri: c.redirect,
    response_type: 'code',
    scope: GOOGLE_MAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'false',
    login_hint: c.from,
    state,
    code_challenge: hash(verifier),
    code_challenge_method: 'S256',
  }).toString();
  return {
    url: url.toString(),
    cookie: `${COOKIE}=${browser}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  };
}
export const clearGoogleMailCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
async function tokenRequest(fields: Record<string, string>) {
  const c = config();
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...fields, client_id: c.client, client_secret: c.secret }),
      signal: AbortSignal.timeout(12000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error();
    const value = await response.json();
    if (typeof value.access_token !== 'string' || value.token_type?.toLowerCase() !== 'bearer')
      throw new Error();
    if (typeof value.scope === 'string' && value.scope.trim() !== GOOGLE_MAIL_SCOPE)
      throw new Error();
    return value as { access_token: string; refresh_token?: string; scope?: string };
  } catch {
    throw new AppError(
      502,
      'Google nu a putut autoriza trimiterea. Reconectează contul și reîncearcă.',
    );
  }
}
export async function completeGoogleMail(uid: string, sessionId: string, req: Request) {
  await requireFounder(uid);
  const c = config();
  const row = await read(STATE_PREFIX + uid);
  if (!row) throw new AppError(400, 'Conectarea Gmail a expirat.');
  const pending = unseal<Pending>(row.value);
  const params = new URL(req.url).searchParams;
  const cookie =
    (req.headers.get('cookie') || '')
      .split(';')
      .map((x) => x.trim())
      .find((x) => x.startsWith(COOKIE + '='))
      ?.slice(COOKIE.length + 1) || '';
  if (
    pending.expires < Date.now() ||
    !equal(pending.state, params.get('state') || '') ||
    !equal(pending.session, hash(sessionId)) ||
    !equal(pending.browser, hash(cookie))
  )
    throw new AppError(400, 'Conectare Gmail invalidă sau expirată.');
  // Compare-and-delete makes the callback single-use, including concurrent requests.
  const consumed = await db()
    .delete(s.settings)
    .where(and(eq(s.settings.key, row.key), eq(s.settings.value, row.value)))
    .returning();
  if (!consumed.length || params.has('error'))
    throw new AppError(400, 'Conectarea Gmail nu a fost finalizată.');
  const code = params.get('code');
  if (!code || code.length > 4096) throw new AppError(400, 'Răspuns Google invalid.');
  const tokens = await tokenRequest({
    code,
    code_verifier: pending.verifier,
    redirect_uri: c.redirect,
    grant_type: 'authorization_code',
  });
  if (!tokens.refresh_token || tokens.scope !== GOOGLE_MAIL_SCOPE)
    throw new AppError(
      400,
      'Acordă permisiunea de trimitere și accesul offline, apoi reconectează Gmail.',
    );
  await store(CONNECTION, {
    refresh: tokens.refresh_token,
    from: c.from,
    client: c.client,
    connectedAt: new Date().toISOString(),
    testedAt: null,
  } satisfies Connection);
  // Access tokens are intentionally never persisted.
}
export async function testGoogleMail(uid: string) {
  await requireFounder(uid);
  const { value, row, c } = await connection();
  const key = `google-mail-test:${uid}:${Math.floor(Date.now() / 60000)}`;
  const limit = (
    await db()
      .insert(s.requestLimits)
      .values({ key, window: new Date() })
      .onConflictDoUpdate({
        target: s.requestLimits.key,
        set: { count: sql`${s.requestLimits.count}+1` },
      })
      .returning()
  )[0];
  if (limit.count > 1) throw new AppError(429, 'Poți trimite un singur email de test pe minut.');
  const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: value.refresh });
  const message = [
    `From: AutoCare <${c.from}>`,
    `To: ${c.from}`,
    'Subject: AutoCare - test Gmail API',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(
      'Conexiunea Gmail API AutoCare funcționează. Acesta este un test manual solicitat de Fondator. Notificările automate Gmail sunt dezactivate.',
    ).toString('base64'),
  ].join('\r\n');
  try {
    // The configured Gmail address, rather than "me", rejects authorizations for another mailbox.
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(c.from)}/messages/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: Buffer.from(message).toString('base64url') }),
        signal: AbortSignal.timeout(12000),
        redirect: 'error',
        cache: 'no-store',
      },
    );
    if (!response.ok) throw new Error();
  } catch {
    throw new AppError(
      502,
      'Emailul de test nu a putut fi confirmat. Verifică expeditorul și autorizarea Gmail înainte de reîncercare.',
    );
  }
  const testedAt = new Date().toISOString();
  await db()
    .update(s.settings)
    .set({ value: seal({ ...value, testedAt }) })
    .where(and(eq(s.settings.key, row.key), eq(s.settings.value, row.value)));
  return { ok: true, to: c.from, testedAt, automaticEnabled: false };
}
export async function disconnectGoogleMail(uid: string) {
  await requireFounder(uid);
  await db().delete(s.settings).where(eq(s.settings.key, CONNECTION));
  await db()
    .delete(s.settings)
    .where(eq(s.settings.key, STATE_PREFIX + uid));
  return { ok: true };
}
