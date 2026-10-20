import { writeFile, readFile } from 'node:fs/promises';
import { encryptedBackup, restoreEncrypted } from '../src/lib/backup';
import { closeLocalDb } from '../src/lib/db';
async function main() {
  const [mode, file] = process.argv.slice(2);
  if (!file || !['create', 'restore'].includes(mode))
    throw new Error('Usage: node --import tsx scripts/backup.ts create|restore /absolute/file.enc');
  const key = Buffer.from(process.env.BACKUP_KEY || '', 'hex');
  if (key.length !== 32) throw new Error('BACKUP_KEY must contain 64 hexadecimal characters');
  if (mode === 'create')
    await writeFile(file, await encryptedBackup(key), { mode: 0o600, flag: 'wx' });
  else {
    if (process.env.RESTORE_TARGET_EMPTY !== 'YES')
      throw new Error('Set RESTORE_TARGET_EMPTY=YES for an empty isolated target');
    await restoreEncrypted(await readFile(file), key);
  }
  console.log(
    mode === 'create' ? 'Encrypted backup created.' : 'Backup restored into empty database.',
  );
  await closeLocalDb();
  process.exit(0);
}
main().catch((e) => {
  console.error(e instanceof Error ? e.message : 'Backup operation failed');
  process.exit(1);
});
