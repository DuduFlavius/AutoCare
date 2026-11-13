import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv, randomBytes } from 'node:crypto';
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
  const vehicleId=crypto.randomUUID();
  await db().insert(s.vehicles).values({
    id: vehicleId,
    userId: id,
    brand: 'Test',
    model: 'Backup',
    year: 2024,
    plate: 'BACKUP',
    fuel: 'Electric',
    odometer: 42,
  });
  await db().insert(s.mileageReadings).values({id:crypto.randomUUID(),userId:id,vehicleId,odometer:42,source:'manual'});
  await db().insert(s.gpsTrips).values({id:crypto.randomUUID(),userId:id,vehicleId,distanceMeters:1234,durationSeconds:180,startedAt:new Date('2026-11-12T08:00:00Z'),endedAt:new Date('2026-11-12T08:03:00Z')});
  await db().insert(s.mileageReminderPreferences).values({userId:id,frequencyDays:7});
  await db().insert(s.subscriptionExtensions).values({id:crypto.randomUUID(),userId:id,sessionId:'isolated-session',months:3,amountBani:45000,status:'completed'});
  await db().insert(s.mechanicShares).values({id:crypto.randomUUID(),userId:id,tokenHash:'isolated-hash',snapshot:{vehicle:'Backup'},fileIds:[],expiresAt:new Date('2026-12-01T00:00:00Z')});
  const key = randomBytes(32);
  const backup = await encryptedBackup(key);
  assert.ok(!backup.toString().includes('backup@example.invalid'));
  const envelope=JSON.parse(backup.toString());
  const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.iv,'base64'));
  decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
  const payload=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString());
  assert.deepEqual(Object.keys(payload.tables).sort(),Object.keys(s).sort(),'Every schema table must be included in the encrypted backup');
  assert.equal(payload.version,2);
  await assert.rejects(() => restoreEncrypted(backup, key), /empty/);
  await closeLocalDb();
  await migrate();
  await assert.rejects(() => restoreEncrypted(backup, randomBytes(32)));
  await restoreEncrypted(backup, key);
  assert.equal((await db().select().from(s.user))[0].email, 'backup@example.invalid');
  assert.equal((await db().select().from(s.vehicles))[0].odometer, 42);
  assert.ok((await db().select().from(s.user))[0].createdAt instanceof Date);
  assert.equal((await db().select().from(s.mileageReadings))[0].odometer,42);
  assert.equal((await db().select().from(s.gpsTrips))[0].distanceMeters,1234);
  assert.equal((await db().select().from(s.mileageReminderPreferences))[0].frequencyDays,7);
  assert.equal((await db().select().from(s.subscriptionExtensions))[0].amountBani,45000);
  assert.equal((await db().select().from(s.mechanicShares))[0].tokenHash,'isolated-hash');
  await closeLocalDb();
});
