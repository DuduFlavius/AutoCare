import { and, eq, desc, sql } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
import { isPremium, documentStatus, localDate } from './config';
import { effectiveRole } from './permissions';
import { pricing, savings } from './pricing';
import { vehicleInput, recordInput, profileInput } from './validation';
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function profile(uid: string) {
  await db().insert(s.profiles).values({ userId: uid }).onConflictDoNothing();
  const row = (await db().select().from(s.profiles).where(eq(s.profiles.userId, uid)))[0];
  return { ...row, role: effectiveRole(uid, row.role) };
}
export async function activeGrants(uid: string, now = new Date()) {
  return db()
    .select()
    .from(s.premiumGrants)
    .where(
      and(
        eq(s.premiumGrants.userId, uid),
        sql`${s.premiumGrants.revokedAt} IS NULL AND (${s.premiumGrants.expiresAt} IS NULL OR ${s.premiumGrants.expiresAt}>${now.toISOString()}::timestamptz)`,
      ),
    );
}
export async function premium(uid: string, now = new Date()) {
  const [sub, grants] = await Promise.all([
    db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid)),
    activeGrants(uid, now),
  ]);
  return (!!sub[0]?.subscriptionId && isPremium(sub[0], now)) || grants.length > 0;
}
export async function assertActiveAccount(uid: string) {
  const r = (
    await db().select().from(s.accountRestrictions).where(eq(s.accountRestrictions.userId, uid))
  )[0];
  if (r?.suspendedAt)
    throw new AppError(403, 'Contul este suspendat. Contactează echipa AutoCare.');
}
export async function limits() {
  const r = (await db().select().from(s.settings).where(eq(s.settings.key, 'limits')))[0];
  return (r?.value || { premiumCars: 5, maxFiles: 30 }) as {
    premiumCars: number;
    maxFiles: number;
  };
}
export async function ownedVehicle(uid: string, id: string) {
  const v = (
    await db()
      .select()
      .from(s.vehicles)
      .where(and(eq(s.vehicles.id, id), eq(s.vehicles.userId, uid)))
  )[0];
  if (!v) throw new AppError(404, 'Mașina nu există.');
  return v;
}
export async function ownedRecord(uid: string, id: string) {
  const r = (
    await db()
      .select()
      .from(s.records)
      .where(and(eq(s.records.id, id), eq(s.records.userId, uid)))
  )[0];
  if (!r) throw new AppError(404, 'Înregistrarea nu există.');
  return r;
}
export async function createVehicle(uid: string, input: unknown) {
  const data = vehicleInput.parse(input);
  return db().transaction(async (tx) => {
    await tx.select().from(s.user).where(eq(s.user.id, uid)).for('update');
    const sub = (await tx.select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid)))[0];
    const cars = await tx
      .select({ id: s.vehicles.id })
      .from(s.vehicles)
      .where(and(eq(s.vehicles.userId, uid), eq(s.vehicles.archived, false)));
    const grants = await tx
      .select()
      .from(s.premiumGrants)
      .where(
        and(
          eq(s.premiumGrants.userId, uid),
          sql`${s.premiumGrants.revokedAt} IS NULL AND (${s.premiumGrants.expiresAt} IS NULL OR ${s.premiumGrants.expiresAt}>now())`,
        ),
      );
    const hasPremium = (sub?.subscriptionId && isPremium(sub)) || grants.length > 0;
    if (!hasPremium && cars.length >= 1)
      throw new AppError(403, 'Planul gratuit permite o singură mașină activă. Activează Premium pentru mașini nelimitate.');
    return (
      await tx
        .insert(s.vehicles)
        .values({ ...data, id: crypto.randomUUID(), userId: uid })
        .returning()
    )[0];
  });
}
export async function editVehicle(uid: string, id: string, input: unknown) {
  const data = vehicleInput.parse(input);
  await ownedVehicle(uid, id);
  return (
    await db()
      .update(s.vehicles)
      .set(data)
      .where(and(eq(s.vehicles.id, id), eq(s.vehicles.userId, uid)))
      .returning()
  )[0];
}
export async function archiveVehicle(uid: string, id: string) {
  await ownedVehicle(uid, id);
  await db()
    .update(s.vehicles)
    .set({ archived: true })
    .where(and(eq(s.vehicles.id, id), eq(s.vehicles.userId, uid)));
}
export async function saveRecord(uid: string, input: unknown, id?: string) {
  const parsed = recordInput.parse(input);
  const data = { ...parsed, amountBani: parsed.amountKnown ? parsed.amountBani : 0 };
  const car = await ownedVehicle(uid, data.vehicleId);
  if (car.archived) throw new AppError(400, 'Mașina este arhivată.');
  if (data.nextKm != null && !(await premium(uid)))
    throw new AppError(403, 'Mementourile după kilometraj necesită Premium.');
  if (id) await ownedRecord(uid, id);
  return db().transaction(async (tx) => {
    if (id) {
      const previous = (
        await tx
          .select()
          .from(s.records)
          .where(and(eq(s.records.id, id), eq(s.records.userId, uid)))
          .for('update')
      )[0];
      if (!previous) throw new AppError(404, 'Înregistrare inexistentă.');
      await tx
        .insert(s.recordHistory)
        .values({ id: crypto.randomUUID(), userId: uid, recordId: id, snapshot: previous });
      await tx
        .update(s.notifications)
        .set({ status: 'cancelled' })
        .where(
          and(
            eq(s.notifications.recordId, id),
            sql`${s.notifications.status} IN ('pending','retry')`,
          ),
        );
      return (
        await tx
          .update(s.records)
          .set({ ...data, revision: previous.revision + 1 })
          .where(and(eq(s.records.id, id), eq(s.records.userId, uid)))
          .returning()
      )[0];
    }
    return (
      await tx
        .insert(s.records)
        .values({ ...data, id: crypto.randomUUID(), userId: uid })
        .returning()
    )[0];
  });
}
export async function archiveRecord(uid: string, id: string) {
  await ownedRecord(uid, id);
  await db().transaction(async (tx) => {
    await tx
      .update(s.records)
      .set({ cancelled: true, revision: sql`${s.records.revision}+1` })
      .where(and(eq(s.records.id, id), eq(s.records.userId, uid)));
    await tx
      .update(s.notifications)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(s.notifications.recordId, id),
          sql`${s.notifications.status} IN ('pending','retry')`,
        ),
      );
  });
}
export async function saveProfile(uid: string, input: unknown) {
  const data = profileInput.parse(input);
  if (
    !(await premium(uid)) &&
    (data.afterExpiry || data.hour !== 9 || data.offsets.some((n) => ![30, 7, 1, 0].includes(n)))
  )
    throw new AppError(403, 'Aceste preferințe necesită Premium.');
  await profile(uid);
  await db().update(s.profiles).set(data).where(eq(s.profiles.userId, uid));
}
export function summarize(
  rows: Array<{
    amountBani: number;
    category: string;
    date: string | null;
    odometer: number | null;
    vehicleId: string;
  }>,
  year: number,
  month: string,
) {
  const selected = rows.filter((r) => r.date?.startsWith(String(year)));
  const monthly = Array.from({ length: 12 }, (_, i) => ({
    month: `${year}-${String(i + 1).padStart(2, '0')}`,
    bani: 0,
  }));
  const categories: Record<string, number> = {};
  for (const r of selected) {
    const m = Number(r.date!.slice(5, 7)) - 1;
    monthly[m].bani += r.amountBani;
    categories[r.category] = (categories[r.category] || 0) + r.amountBani;
  }
  const mileage = new Map<string, number[]>();
  for (const r of selected)
    if (r.odometer != null) {
      const a = mileage.get(r.vehicleId) || [];
      a.push(r.odometer);
      mileage.set(r.vehicleId, a);
    }
  let km = 0;
  for (const a of mileage.values()) if (a.length >= 2) km += Math.max(...a) - Math.min(...a);
  const annualBani = selected.reduce((a, r) => a + r.amountBani, 0);
  return {
    annualBani,
    monthBani: selected
      .filter((r) => r.date?.startsWith(month))
      .reduce((a, r) => a + r.amountBani, 0),
    monthly,
    categories,
    costPerKm: km > 0 ? annualBani / 100 / km : null,
    km,
  };
}
export async function dashboard(uid: string) {
  const p = await profile(uid);
  const [cars, rows, sub, alerts, attachments, photos] = await Promise.all([
    db()
      .select()
      .from(s.vehicles)
      .where(eq(s.vehicles.userId, uid))
      .orderBy(desc(s.vehicles.createdAt)),
    db()
      .select()
      .from(s.records)
      .where(eq(s.records.userId, uid))
      .orderBy(desc(s.records.createdAt)),
    db().select().from(s.subscriptions).where(eq(s.subscriptions.userId, uid)),
    db()
      .select()
      .from(s.notifications)
      .where(eq(s.notifications.userId, uid))
      .orderBy(desc(s.notifications.createdAt))
      .limit(100),
    db()
      .select({
        id: s.files.id,
        recordId: s.files.recordId,
        mime: s.files.mime,
        name: s.files.name,
        size: s.files.size,
      })
      .from(s.files)
      .where(eq(s.files.userId, uid)),
    db()
      .select({ vehicleId: s.vehiclePhotos.vehicleId })
      .from(s.vehiclePhotos)
      .where(eq(s.vehiclePhotos.userId, uid)),
  ]);
  const now = new Date();
  const date = localDate(now, p.timezone);
  const grants = await activeGrants(uid);
  const price = await pricing();
  const paid = (!!sub[0]?.subscriptionId && isPremium(sub[0])) || grants.length > 0;
  const summary = summarize(
    rows.filter((r) => !r.cancelled),
    Number(date.slice(0, 4)),
    date.slice(0, 7),
  );
  return {
    profile: p,
    vehicles: cars,
    records: rows.map((r) => ({
      ...r,
      status: r.cancelled
        ? { label: 'Arhivat', state: 'archived', days: null }
        : documentStatus(r.expiresAt, now, p.timezone),
    })),
    premium: paid,
    premiumAccess: {
      paid: !!sub[0]?.subscriptionId && isPremium(sub[0]),
      manual: grants.map(({ id, grantedAt, expiresAt }) => ({ id, grantedAt, expiresAt })),
    },
    pricing: {
      monthlyBani: price.monthlyBani,
      annualBani: price.annualBani,
      currency: price.currency,
      ...savings(price.monthlyBani, price.annualBani),
    },
    subscription: sub[0] || null,
    notifications: alerts,
    attachments,
    photos,
    summary: paid ? summary : { ...summary, monthly: [], categories: {}, costPerKm: null, km: 0 },
    pushPublicKey: process.env.VAPID_PUBLIC_KEY || null,
    notificationSetup: {
      pushConfigured: !!(
        process.env.VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.VAPID_SUBJECT
      ),
      emailConfigured: !!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    },
  };
}
export async function getFile(uid: string, id: string) {
  const f = (
    await db()
      .select()
      .from(s.files)
      .where(and(eq(s.files.id, id), eq(s.files.userId, uid)))
  )[0];
  if (!f) throw new AppError(404, 'Fișier inexistent.');
  return f;
}
export function detectMime(bytes: Buffer) {
  if (bytes.subarray(0, 5).toString() === '%PDF-') return 'application/pdf';
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    return 'image/png';
  throw new AppError(400, 'Doar PDF, JPEG sau PNG valide.');
}
export async function uploadFile(
  uid: string,
  recordId: string,
  file: { name: string; bytes: Buffer },
) {
  await ownedRecord(uid, recordId);
  if (file.bytes.length > 2 * 1024 * 1024) throw new AppError(413, 'Maximum 2 MB per fișier.');
  const mime = detectMime(file.bytes);
  const max = (await premium(uid)) ? (await limits()).maxFiles : 2;
  return db().transaction(async (tx) => {
    await tx.select().from(s.user).where(eq(s.user.id, uid)).for('update');
    const count = (
      await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(s.files)
        .where(eq(s.files.userId, uid))
    )[0].n;
    if (count >= max) throw new AppError(403, `Limita este ${max} atașamente.`);
    const { data: _data, ...metadata } = (
      await tx
        .insert(s.files)
        .values({
          id: crypto.randomUUID(),
          userId: uid,
          recordId,
          name: file.name.replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 150) || 'document',
          mime,
          data: file.bytes.toString('base64'),
          size: file.bytes.length,
        })
        .returning()
    )[0];
    return metadata;
  });
}
export function csv(rows: Array<Record<string, unknown>>) {
  if (!rows.length) return '\ufeff';
  const keys = Object.keys(rows[0]);
  const quote = (v: unknown) => {
    let t = String(v ?? '');
    if (/^[\s]*[=+@-]/.test(t)) t = "'" + t;
    return '"' + t.replaceAll('"', '""') + '"';
  };
  return (
    '\ufeff' +
    [keys.map(quote).join(','), ...rows.map((r) => keys.map((k) => quote(r[k])).join(','))].join(
      '\r\n',
    )
  );
}

export async function uploadVehiclePhoto(uid: string, id: string, bytes: Buffer) {
  await ownedVehicle(uid, id);
  if (bytes.length > 2097152) throw new AppError(413, 'Maximum 2 MB.');
  const mime = detectMime(bytes);
  if (!mime.startsWith('image/'))
    throw new AppError(400, 'Fotografia trebuie să fie JPEG sau PNG.');
  await db()
    .insert(s.vehiclePhotos)
    .values({
      vehicleId: id,
      userId: uid,
      mime,
      data: bytes.toString('base64'),
      size: bytes.length,
    })
    .onConflictDoUpdate({
      target: s.vehiclePhotos.vehicleId,
      set: { mime, data: bytes.toString('base64'), size: bytes.length },
    });
}
