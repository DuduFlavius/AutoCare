import { and, eq, desc, sql, ilike, or } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import * as s from './schema';
import { AppError, assertActiveAccount } from './service';
import { effectiveRole, founderId, isFounder } from './permissions';
import { pricing, DEFAULT_PRICING } from './pricing';
import { stripe } from './billing';
export async function requireFounder(uid: string) {
  await assertActiveAccount(uid);
  if (!isFounder(uid)) throw new AppError(403, 'Această zonă este rezervată Fondatorului.');
}
async function target(id: string) {
  const u = (
    await db()
      .select({ id: s.user.id, emailVerified: s.user.emailVerified })
      .from(s.user)
      .where(eq(s.user.id, id))
  )[0];
  if (!u) throw new AppError(404, 'Utilizator inexistent.');
  return u;
}
function protectFounder(id: string) {
  if (isFounder(id))
    throw new AppError(403, 'Contul Fondatorului nu poate fi suspendat sau retrogradat.');
}
export function addCalendarMonths(start: Date, months: number) {
  const d = new Date(start),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const max = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, max));
  return d;
}
export async function founderOverview(uid: string) {
  await requireFounder(uid);
  const [users, paid, manual, invoices, threads, price] = await Promise.all([
    db()
      .select({
        total: sql<number>`count(*)::int`,
        recent: sql<number>`count(*) FILTER (WHERE ${s.user.createdAt}>now()-interval '30 days')::int`,
      })
      .from(s.user),
    db()
      .select({ n: sql<number>`count(*)::int` })
      .from(s.subscriptions)
      .where(
        sql`${s.subscriptions.status}='active' AND ${s.subscriptions.subscriptionId} IS NOT NULL AND ${s.subscriptions.periodEnd}>now()`,
      ),
    db()
      .select({ n: sql<number>`count(DISTINCT ${s.premiumGrants.userId})::int` })
      .from(s.premiumGrants)
      .where(
        sql`${s.premiumGrants.revokedAt} IS NULL AND (${s.premiumGrants.expiresAt} IS NULL OR ${s.premiumGrants.expiresAt}>now())`,
      ),
    db()
      .select({
        currency: s.invoices.currency,
        total: sql<number>`coalesce(sum(${s.invoices.amountBani}),0)::bigint`,
      })
      .from(s.invoices)
      .where(and(eq(s.invoices.status, 'paid'), eq(s.invoices.livemode, true)))
      .groupBy(s.invoices.currency),
    db()
      .select({ status: s.supportThreads.status, n: sql<number>`count(*)::int` })
      .from(s.supportThreads)
      .groupBy(s.supportThreads.status),
    pricing(),
  ]);
  const union = await db().execute(
    sql`SELECT count(DISTINCT id)::int AS n FROM (SELECT "userId" AS id FROM subscriptions WHERE status='active' AND "subscriptionId" IS NOT NULL AND "periodEnd">now() UNION SELECT "userId" AS id FROM premium_grants WHERE "revokedAt" IS NULL AND ("expiresAt" IS NULL OR "expiresAt">now())) x`,
  );
  const response = await db().execute(
    sql`SELECT count(*)::int AS answered, avg(extract(epoch FROM (first_reply-t."createdAt"))) AS seconds FROM support_threads t JOIN LATERAL (SELECT min(m."createdAt") AS first_reply FROM support_chat_messages m WHERE m."threadId"=t.id AND m."authorRole" IN ('admin','assistant','founder')) r ON r.first_reply IS NOT NULL`,
  );
  return {
    responseTime: {
      answered: Number(response.rows[0]?.answered || 0),
      averageSeconds: response.rows[0]?.seconds == null ? null : Number(response.rows[0].seconds),
    },
    users: users[0],
    paidPremium: paid[0].n,
    manualPremium: manual[0].n,
    totalPremium: Number(union.rows[0]?.n || 0),
    revenues: invoices.map((x) => ({ ...x, total: Number(x.total) })),
    conversations: Object.fromEntries(threads.map((x) => [x.status, x.n])),
    pricing: price,
    founderConfigured: !!founderId(),
  };
}
export async function founderUsers(uid: string, params: URLSearchParams) {
  await requireFounder(uid);
  const page = Math.max(1, Math.min(10000, Number(params.get('page')) || 1));
  const q = (params.get('q') || '').trim().slice(0, 100);
  const role = params.get('role');
  const paidExpr = sql<boolean>`EXISTS (SELECT 1 FROM subscriptions sp WHERE sp."userId"=${s.user.id} AND sp.status='active' AND sp."subscriptionId" IS NOT NULL AND sp."periodEnd">now())`;
  const manualExpr = sql<boolean>`EXISTS (SELECT 1 FROM premium_grants pg WHERE pg."userId"=${s.user.id} AND pg."revokedAt" IS NULL AND (pg."expiresAt" IS NULL OR pg."expiresAt">now()))`;
  const lifetimeExpr = sql<boolean>`EXISTS (SELECT 1 FROM premium_grants pg WHERE pg."userId"=${s.user.id} AND pg."revokedAt" IS NULL AND pg."expiresAt" IS NULL)`;
  const expiryExpr = sql<
    string | null
  >`(SELECT max(ends)::text FROM (SELECT sp."periodEnd" AS ends FROM subscriptions sp WHERE sp."userId"=${s.user.id} AND sp.status='active' AND sp."subscriptionId" IS NOT NULL AND sp."periodEnd">now() UNION ALL SELECT pg."expiresAt" AS ends FROM premium_grants pg WHERE pg."userId"=${s.user.id} AND pg."revokedAt" IS NULL AND pg."expiresAt">now()) access_dates)`;
  const premiumFilter = params.get('premium');
  const roleExpr = sql<string>`CASE WHEN ${s.user.id}=${founderId()} THEN 'founder' WHEN ${s.profiles.role} IN ('admin','assistant') THEN ${s.profiles.role} ELSE 'user' END`;
  const condition = and(
    premiumFilter === 'active'
      ? sql`(${paidExpr} OR ${manualExpr})`
      : premiumFilter === 'free'
        ? sql`NOT (${paidExpr} OR ${manualExpr})`
        : premiumFilter === 'manual'
          ? manualExpr
          : premiumFilter === 'paid'
            ? paidExpr
            : undefined,
    q
      ? or(
          ilike(s.user.name, `%${q.replace(/[%_\\]/g, '\\$&')}%`),
          ilike(s.user.email, `%${q.replace(/[%_\\]/g, '\\$&')}%`),
        )
      : undefined,
    role && ['user', 'admin', 'assistant', 'founder'].includes(role)
      ? sql`${roleExpr}=${role}`
      : undefined,
  );
  const [rows, count] = await Promise.all([
    db()
      .select({
        id: s.user.id,
        name: s.user.name,
        email: s.user.email,
        emailVerified: s.user.emailVerified,
        createdAt: s.user.createdAt,
        role: roleExpr,
        suspendedAt: s.accountRestrictions.suspendedAt,
        premiumPaid: paidExpr,
        premiumManual: manualExpr,
        premiumLifetime: lifetimeExpr,
        premiumExpiresAt: expiryExpr,
      })
      .from(s.user)
      .leftJoin(s.profiles, eq(s.profiles.userId, s.user.id))
      .leftJoin(s.accountRestrictions, eq(s.accountRestrictions.userId, s.user.id))
      .where(condition)
      .orderBy(desc(s.user.createdAt), desc(s.user.id))
      .limit(20)
      .offset((page - 1) * 20),
    db()
      .select({ n: sql<number>`count(*)::int` })
      .from(s.user)
      .leftJoin(s.profiles, eq(s.profiles.userId, s.user.id))
      .where(condition),
  ]);
  return {
    rows: rows.map((row) => ({
      ...row,
      premiumExpiresAt: row.premiumExpiresAt ? new Date(row.premiumExpiresAt).toISOString() : null,
    })),
    page,
    total: count[0].n,
    pageSize: 20,
  };
}
export async function founderUserDetail(uid: string, id: string) {
  await requireFounder(uid);
  await target(id);
  const [grants, paid, invoices] = await Promise.all([
    db()
      .select()
      .from(s.premiumGrants)
      .where(eq(s.premiumGrants.userId, id))
      .orderBy(desc(s.premiumGrants.grantedAt)),
    db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, id)),
    db()
      .select()
      .from(s.invoices)
      .where(eq(s.invoices.userId, id))
      .orderBy(desc(s.invoices.createdAt))
      .limit(50),
  ]);
  const now = new Date();
  const manual = grants.filter((g) => !g.revokedAt && (!g.expiresAt || g.expiresAt > now));
  const paidActive =
    !!paid[0]?.subscriptionId &&
    paid[0].status === 'active' &&
    !!paid[0].periodEnd &&
    paid[0].periodEnd > now;
  const lifetime = manual.some((g) => !g.expiresAt);
  const dates = [
    ...manual.flatMap((g) => (g.expiresAt ? [g.expiresAt.getTime()] : [])),
    ...(paidActive ? [paid[0].periodEnd!.getTime()] : []),
  ];
  return {
    grants,
    paid: paid[0] || null,
    invoices,
    access: {
      active: paidActive || manual.length > 0,
      paid: paidActive,
      manual: manual.length > 0,
      lifetime,
      expiresAt: lifetime || !dates.length ? null : new Date(Math.max(...dates)).toISOString(),
    },
  };
}
export async function changeRole(uid: string, id: string, input: unknown) {
  await requireFounder(uid);
  protectFounder(id);
  const data = z
    .object({ role: z.enum(['user', 'assistant', 'admin']), confirm: z.literal(true) })
    .strict()
    .parse(input);
  const u = await target(id);
  if (
    data.role !== 'user' &&
    !u.emailVerified &&
    process.env.AUTOCARE_REQUIRE_EMAIL_VERIFICATION === 'true'
  )
    throw new AppError(400, 'Contul trebuie să aibă e-mailul confirmat.');
  return db().transaction(async (tx) => {
    await tx.select().from(s.user).where(eq(s.user.id, id)).for('update');
    const old = (await tx.select().from(s.profiles).where(eq(s.profiles.userId, id)))[0];
    await tx
      .insert(s.profiles)
      .values({ userId: id, role: data.role })
      .onConflictDoUpdate({ target: s.profiles.userId, set: { role: data.role } });
    await tx.insert(s.audit).values({
      id: crypto.randomUUID(),
      actorId: uid,
      action: `role.${effectiveRole(id, old?.role || 'user')}.to.${data.role}`,
      target: id,
    });
    return { ok: true };
  });
}
export async function addTeamMember(uid: string, input: unknown) {
  await requireFounder(uid);
  const data = z
    .object({
      email: z.string().trim().toLowerCase().pipe(z.email()),
      role: z.enum(['admin', 'assistant']),
      confirm: z.literal(true),
    })
    .strict()
    .parse(input);
  const user = (
    await db()
      .select({ id: s.user.id })
      .from(s.user)
      .where(sql`lower(${s.user.email})=${data.email}`)
  )[0];
  if (!user)
    throw new AppError(
      404,
      'Nu există un cont cu acest e-mail. Persoana trebuie să își creeze mai întâi contul AutoCare, apoi îi poți acorda acces.',
    );
  await changeRole(uid, user.id, { role: data.role, confirm: true });
  return { ok: true, userId: user.id, role: data.role };
}
export async function grantPremium(uid: string, id: string, input: unknown) {
  await requireFounder(uid);
  await target(id);
  const data = z
    .object({
      months: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]).optional(),
      expiresAt: z.iso.datetime().optional(),
      lifetime: z.boolean().default(false),
      note: z.string().trim().max(4000).default(''),
    })
    .strict()
    .parse(input);
  if (
    Number(data.months !== undefined) +
      Number(data.expiresAt !== undefined) +
      Number(data.lifetime) !==
    1
  )
    throw new AppError(400, 'Alege o durată, o dată sau accesul fără expirare.');
  return db().transaction(async (tx) => {
    await tx.select().from(s.user).where(eq(s.user.id, id)).for('update');
    const now = new Date();
    const active = await tx
      .select()
      .from(s.premiumGrants)
      .where(
        and(
          eq(s.premiumGrants.userId, id),
          sql`${s.premiumGrants.revokedAt} IS NULL AND (${s.premiumGrants.expiresAt} IS NULL OR ${s.premiumGrants.expiresAt}>now())`,
        ),
      )
      .for('update');
    if (data.months && active.some((g) => !g.expiresAt))
      throw new AppError(
        409,
        'Accesul este deja fără expirare. Revocă-l înainte de a seta o durată.',
      );
    const base = new Date(
      Math.max(now.getTime(), ...active.map((g) => g.expiresAt?.getTime() || now.getTime())),
    );
    const expiresAt = data.lifetime
      ? null
      : data.expiresAt
        ? new Date(data.expiresAt)
        : addCalendarMonths(base, data.months!);
    if (expiresAt && expiresAt <= now)
      throw new AppError(400, 'Expirarea trebuie să fie în viitor.');
    await tx
      .update(s.premiumGrants)
      .set({ revokedAt: now, revokedBy: uid })
      .where(and(eq(s.premiumGrants.userId, id), sql`${s.premiumGrants.revokedAt} IS NULL`));
    const granted = (
      await tx
        .insert(s.premiumGrants)
        .values({ id: crypto.randomUUID(), userId: id, grantedBy: uid, expiresAt, note: data.note })
        .returning()
    )[0];
    await tx.insert(s.audit).values({
      id: crypto.randomUUID(),
      actorId: uid,
      action: 'premium.manual.granted',
      target: id + ':' + granted.id,
    });
    return granted;
  });
}
export async function revokePremium(uid: string, id: string, input: unknown) {
  await requireFounder(uid);
  await target(id);
  z.object({ confirm: z.literal(true) })
    .strict()
    .parse(input);
  return db().transaction(async (tx) => {
    await tx.select().from(s.user).where(eq(s.user.id, id)).for('update');
    const rows = await tx
      .update(s.premiumGrants)
      .set({ revokedAt: new Date(), revokedBy: uid })
      .where(and(eq(s.premiumGrants.userId, id), sql`${s.premiumGrants.revokedAt} IS NULL`))
      .returning();
    await tx.insert(s.audit).values({
      id: crypto.randomUUID(),
      actorId: uid,
      action: 'premium.manual.revoked',
      target: id,
    });
    return { ok: true, revoked: rows.length, paidSubscriptionUnchanged: true };
  });
}
export async function suspendAccount(uid: string, id: string, input: unknown) {
  await requireFounder(uid);
  protectFounder(id);
  await target(id);
  const data = z
    .object({
      suspended: z.boolean(),
      reason: z.string().trim().max(1000).default(''),
      confirm: z.literal(true),
    })
    .strict()
    .parse(input);
  return db().transaction(async (tx) => {
    await tx
      .insert(s.accountRestrictions)
      .values({
        userId: id,
        suspendedAt: data.suspended ? new Date() : null,
        reason: data.reason,
        updatedBy: uid,
      })
      .onConflictDoUpdate({
        target: s.accountRestrictions.userId,
        set: {
          suspendedAt: data.suspended ? new Date() : null,
          reason: data.reason,
          updatedBy: uid,
          updatedAt: new Date(),
        },
      });
    if (data.suspended) await tx.delete(s.session).where(eq(s.session.userId, id));
    await tx.insert(s.audit).values({
      id: crypto.randomUUID(),
      actorId: uid,
      action: data.suspended ? 'account.suspended' : 'account.reactivated',
      target: id,
    });
    return { ok: true };
  });
}
export async function founderAudit(uid: string, params: URLSearchParams) {
  await requireFounder(uid);
  const page = Math.max(1, Number(params.get('page')) || 1);
  const q = (params.get('q') || '').slice(0, 100);
  const where = q ? ilike(s.audit.action, '%' + q.replace(/[%_\\]/g, '\\$&') + '%') : undefined;
  const [rows, total] = await Promise.all([
    db()
      .select()
      .from(s.audit)
      .where(where)
      .orderBy(desc(s.audit.createdAt), desc(s.audit.id))
      .limit(30)
      .offset((page - 1) * 30),
    db()
      .select({ n: sql<number>`count(*)::int` })
      .from(s.audit)
      .where(where),
  ]);
  return { rows, page, total: total[0].n, pageSize: 30 };
}
export async function changePricing(uid: string, input: unknown) {
  await requireFounder(uid);
  const data = z
    .object({
      monthlyBani: z.number().int().min(100).max(10000000),
      annualBani: z.number().int().min(100).max(100000000),
      version: z.number().int().min(1),
      syncProcessor: z.boolean().default(false),
      confirm: z.literal(true),
    })
    .strict()
    .parse(input);
  const old = await pricing();
  if (old.version !== data.version)
    throw new AppError(409, 'Prețurile au fost modificate între timp. Reîncarcă pagina.');
  let monthlyPriceId: string | null = null,
    annualPriceId: string | null = null;
  if (data.syncProcessor) {
    const client = stripe();
    const token = `autocare-pricing-${old.version + 1}-${data.monthlyBani}-${data.annualBani}`;
    const product = await client.products.create(
      { name: 'AutoCare Premium', metadata: { application: 'autocare' } },
      { idempotencyKey: token + '-product' },
    );
    const [monthly, annual] = await Promise.all([
      client.prices.create(
        {
          product: product.id,
          currency: 'ron',
          unit_amount: data.monthlyBani,
          recurring: { interval: 'month' },
          tax_behavior: 'inclusive',
        },
        { idempotencyKey: token + '-month' },
      ),
      client.prices.create(
        {
          product: product.id,
          currency: 'ron',
          unit_amount: data.annualBani,
          recurring: { interval: 'year' },
          tax_behavior: 'inclusive',
        },
        { idempotencyKey: token + '-year' },
      ),
    ]);
    monthlyPriceId = monthly.id;
    annualPriceId = annual.id;
  }
  return db().transaction(async (tx) => {
    await tx
      .insert(s.settings)
      .values({ key: 'billing-pricing', value: DEFAULT_PRICING })
      .onConflictDoNothing();
    const current = (
      await tx.select().from(s.settings).where(eq(s.settings.key, 'billing-pricing')).for('update')
    )[0].value as typeof old;
    if (current.version !== data.version)
      throw new AppError(409, 'Conflict de versiune. Reîncarcă prețurile.');
    const next = {
      monthlyBani: data.monthlyBani,
      annualBani: data.annualBani,
      currency: 'ron',
      monthlyPriceId,
      annualPriceId,
      version: old.version + 1,
    };
    if (monthlyPriceId && annualPriceId)
      await tx
        .insert(s.billingPrices)
        .values([
          {
            id: monthlyPriceId,
            interval: 'monthly',
            amountBani: data.monthlyBani,
            currency: 'ron',
          },
          { id: annualPriceId, interval: 'annual', amountBani: data.annualBani, currency: 'ron' },
        ])
        .onConflictDoNothing();
    await tx.update(s.settings).set({ value: next }).where(eq(s.settings.key, 'billing-pricing'));
    await tx.insert(s.audit).values({
      id: crypto.randomUUID(),
      actorId: uid,
      action: `pricing.changed.${data.monthlyBani}.${data.annualBani}.RON`,
      target: 'billing-pricing',
    });
    return { ...next, processorSynced: !!monthlyPriceId };
  });
}

export async function founderSeo(uid: string) {
  await requireFounder(uid);
  const row = (
    await db().select().from(s.settings).where(eq(s.settings.key, 'google-site-verification'))
  )[0];
  return {
    googleVerification:
      typeof row?.value === 'string' ? row.value : process.env.GOOGLE_SITE_VERIFICATION || '',
  };
}
export async function saveFounderSeo(uid: string, input: unknown) {
  await requireFounder(uid);
  const { parseGoogleVerification } = await import('./google-verification');
  const data = z
    .object({ googleVerification: z.string().max(1000) })
    .strict()
    .parse(input);
  const token = parseGoogleVerification(data.googleVerification);
  await db().transaction(async (tx) => {
    await tx
      .insert(s.settings)
      .values({ key: 'google-site-verification', value: token })
      .onConflictDoUpdate({ target: s.settings.key, set: { value: token } });
    await tx.insert(s.audit).values({
      id: crypto.randomUUID(),
      actorId: uid,
      action: 'seo.google-verification.updated',
      target: 'public-homepage',
    });
  });
  return { ok: true, googleVerification: token };
}
