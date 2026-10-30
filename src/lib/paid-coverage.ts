import { and, eq, sql, desc } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
export function addPaidMonths(base: Date, months: number) {
  const out = new Date(base);
  const day = out.getUTCDate();
  out.setUTCDate(1);
  out.setUTCMonth(out.getUTCMonth() + months);
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return out;
}
export async function paidExtensions(uid: string, now = new Date()) {
  return db()
    .select()
    .from(s.subscriptionExtensions)
    .where(
      and(
        eq(s.subscriptionExtensions.userId, uid),
        eq(s.subscriptionExtensions.status, 'paid'),
        sql`${s.subscriptionExtensions.endsAt}>${now.toISOString()}::timestamptz`,
      ),
    )
    .orderBy(desc(s.subscriptionExtensions.endsAt));
}
