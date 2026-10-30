import { randomBytes, createHash } from 'node:crypto';
import { and, eq, desc, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from './db';
import * as s from './schema';
import { AppError, premium, ownedVehicle, assertActiveAccount } from './service';
export type ShareSnapshot = {
  vehicle: string;
  records: Array<{
    id: string;
    title: string;
    category: string;
    date: string | null;
    odometer: number | null;
    amountBani?: number;
  }>;
  files: Array<{ id: string; name: string }>;
};
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export async function createMechanicShare(uid: string, input: unknown) {
  if (!(await premium(uid))) throw new AppError(403, 'Premium necesar.');
  const value = z
    .object({
      vehicleId: z.string().uuid(),
      recordIds: z.array(z.string().uuid()).min(1).max(100),
      days: z.union([z.literal(1), z.literal(3), z.literal(7)]),
      includeFiles: z.boolean(),
      includeCosts: z.boolean(),
    })
    .parse(input);
  const car = await ownedVehicle(uid, value.vehicleId);
  if (car.archived) throw new AppError(400, 'Mașină arhivată.');
  const rows = await db()
    .select()
    .from(s.records)
    .where(
      and(
        eq(s.records.userId, uid),
        eq(s.records.vehicleId, car.id),
        eq(s.records.cancelled, false),
        inArray(s.records.id, value.recordIds),
      ),
    );
  if (rows.length !== new Set(value.recordIds).size)
    throw new AppError(400, 'Verifică înregistrările selectate.');
  const files = value.includeFiles
    ? await db()
        .select({ id: s.files.id, name: s.files.name })
        .from(s.files)
        .where(
          and(
            eq(s.files.userId, uid),
            inArray(
              s.files.recordId,
              rows.map((r) => r.id),
            ),
          ),
        )
    : [];
  const snapshot: ShareSnapshot = {
    vehicle: [car.brand, car.model, car.plate].join(' · '),
    records: rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      date: r.date,
      odometer: r.odometer,
      ...(value.includeCosts && r.amountKnown ? { amountBani: r.amountBani } : {}),
    })),
    files,
  };
  const token = randomBytes(32).toString('base64url'),
    id = crypto.randomUUID(),
    expiresAt = new Date(Date.now() + value.days * 86400000);
  await db()
    .insert(s.mechanicShares)
    .values({
      id,
      userId: uid,
      tokenHash: digest(token),
      snapshot,
      fileIds: files.map((f) => f.id),
      expiresAt,
    });
  return { id, token, expiresAt };
}
export async function listMechanicShares(uid: string) {
  return db()
    .select({
      id: s.mechanicShares.id,
      expiresAt: s.mechanicShares.expiresAt,
      revoked: s.mechanicShares.revoked,
      createdAt: s.mechanicShares.createdAt,
    })
    .from(s.mechanicShares)
    .where(eq(s.mechanicShares.userId, uid))
    .orderBy(desc(s.mechanicShares.createdAt))
    .limit(50);
}
export async function revokeMechanicShare(uid: string, id: string) {
  await db()
    .update(s.mechanicShares)
    .set({ revoked: true })
    .where(and(eq(s.mechanicShares.id, id), eq(s.mechanicShares.userId, uid)));
  return { ok: true };
}
export async function readMechanicShare(token: string, now = new Date()) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token))
    throw new AppError(404, 'Dosar indisponibil sau expirat.');
  const row = (
    await db()
      .select()
      .from(s.mechanicShares)
      .where(eq(s.mechanicShares.tokenHash, digest(token)))
  )[0];
  if (!row || row.revoked || row.expiresAt <= now)
    throw new AppError(404, 'Dosar indisponibil sau expirat.');
  await assertActiveAccount(row.userId);
  if (!(await premium(row.userId))) throw new AppError(404, 'Dosar indisponibil sau expirat.');
  return { ...row, snapshot: row.snapshot as ShareSnapshot };
}
export async function readMechanicFile(token: string, id: string) {
  const share = await readMechanicShare(token);
  if (!share.fileIds.includes(id)) throw new AppError(404, 'Fișier indisponibil.');
  const file = (
    await db()
      .select()
      .from(s.files)
      .where(and(eq(s.files.id, id), eq(s.files.userId, share.userId)))
  )[0];
  if (!file) throw new AppError(404, 'Fișier indisponibil.');
  return file;
}
