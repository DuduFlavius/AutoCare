import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { migrate } from '../scripts/migrate';
import { db, closeLocalDb } from '../src/lib/db';
import * as s from '../src/lib/schema';
import { encryptedBackup, restoreEncrypted } from '../src/lib/backup';
process.env.LOCAL_DATABASE_PATH = 'memory';
test('Encrypted full backup restores into an empty PostgreSQL-compatible database and rejects wrong key/nonempty target', async () => {
  await migrate();
  const id = crypto.randomUUID();
  await db()
    .insert(s.user)
    .values({ id, name: 'Backup Test', email: 'backup@example.invalid', emailVerified: true });
  await db().insert(s.vehicles).values({
    id: crypto.randomUUID(),
    userId: id,
    brand: 'Test',
    model: 'Backup',
    year: 2024,
    plate: 'BACKUP',
    fuel: 'Electric',
    odometer: 42,
  });
  const key = randomBytes(32);
  const backup = await encryptedBackup(key);
  assert.ok(!backup.toString().includes('backup@example.invalid'));
  await assert.rejects(() => restoreEncrypted(backup, key), /empty/);
  await closeLocalDb();
  await migrate();
  await assert.rejects(() => restoreEncrypted(backup, randomBytes(32)));
  await restoreEncrypted(backup, key);
  assert.equal((await db().select().from(s.user))[0].email, 'backup@example.invalid');
  assert.equal((await db().select().from(s.vehicles))[0].odometer, 42);
  assert.ok((await db().select().from(s.user))[0].createdAt instanceof Date);
  await closeLocalDb();
});
