import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { getTableColumns, notLike, sql } from 'drizzle-orm';
import { db } from './db';
import * as s from './schema';
// Explicit dependency order. No credentials or environment configuration are exported.
const tables = {
  user: s.user,
  account: s.account,
  session: s.session,
  verification: s.verification,
  rateLimit: s.rateLimit,
  profiles: s.profiles,
  vehicles: s.vehicles,
  vehiclePhotos: s.vehiclePhotos,
  records: s.records,
  files: s.files,
  subscriptions: s.subscriptions,
  notifications: s.notifications,
  pushes: s.pushes,
  webhookEvents: s.webhookEvents,
  jobRuns: s.jobRuns,
  support: s.support,
  supportMessages: s.supportMessages,
  supportThreads: s.supportThreads,
  premiumGrants: s.premiumGrants,
  accountRestrictions: s.accountRestrictions,
  billingPrices: s.billingPrices,
  supportChatMessages: s.supportChatMessages,
  supportParticipants: s.supportParticipants,
  supportReads: s.supportReads,
  supportChatFiles: s.supportChatFiles,
  settings: s.settings,
  invoices: s.invoices,
  recordHistory: s.recordHistory,
  deliveryAttempts: s.deliveryAttempts,
  audit: s.audit,
  requestLimits: s.requestLimits,
  emailEvents: s.emailEvents,
};
export async function encryptedBackup(key: Buffer) {
  if (key.length !== 32) throw new Error('BACKUP_KEY must be 32 bytes');
  const data = await db().transaction(async (tx) => {
    await tx.execute(sql`SET TRANSACTION ISOLATION LEVEL REPEATABLE READ`);
    const dump: Record<string, unknown[]> = {};
    for (const [name, table] of Object.entries(tables))
      dump[name] =
        name === 'settings'
          ? await tx
              .select()
              .from(s.settings)
              .where(notLike(s.settings.key, 'private:google-mail:%'))
          : await tx.select().from(table);
    return dump;
  });
  const iv = randomBytes(12),
    cipher = createCipheriv('aes-256-gcm', key, iv);
  const bytes = Buffer.concat([
    cipher.update(
      JSON.stringify({ version: 1, createdAt: new Date().toISOString(), tables: data }),
      'utf8',
    ),
    cipher.final(),
  ]);
  return Buffer.from(
    JSON.stringify({
      version: 1,
      iv: iv.toString('base64'),
      tag: cipher.getAuthTag().toString('base64'),
      data: bytes.toString('base64'),
    }),
  );
}
export async function restoreEncrypted(bytes: Buffer, key: Buffer) {
  if (key.length !== 32) throw new Error('BACKUP_KEY must be 32 bytes');
  const env = JSON.parse(bytes.toString());
  if (env.version !== 1) throw new Error('Unsupported backup');
  const cipher = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64'));
  cipher.setAuthTag(Buffer.from(env.tag, 'base64'));
  const backup = JSON.parse(
    Buffer.concat([cipher.update(Buffer.from(env.data, 'base64')), cipher.final()]).toString(),
  );
  if (backup.version === 1 && backup.tables)
    for (const key of [
      'supportThreads',
      'supportChatMessages',
      'supportParticipants',
      'supportReads',
      'supportChatFiles',
      'premiumGrants',
      'accountRestrictions',
      'billingPrices',
    ])
      if (!(key in backup.tables)) backup.tables[key] = [];
  if (backup.version !== 1 || Object.keys(tables).some((k) => !Array.isArray(backup.tables[k])))
    throw new Error('Invalid backup');
  await db().transaction(async (tx) => {
    for (const table of Object.values(tables)) {
      if ((await tx.select().from(table).limit(1)).length)
        throw new Error('Restore target must be empty');
    }
    for (const [name, table] of Object.entries(tables)) {
      const columns: Record<string, { dataType: string }> = getTableColumns(table);
      const rows = backup.tables[name].map((row: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(row).map(([k, v]) => [
            k,
            v != null && columns[k]?.dataType === 'date' ? new Date(String(v)) : v,
          ]),
        ),
      );
      for (let i = 0; i < rows.length; i += 50)
        await tx.insert(table).values(rows.slice(i, i + 50));
    }
  });
}
