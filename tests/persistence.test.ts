import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('Account, session, vehicle and document survive a full application process restart without email service', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'autocare-persistence-'));
  const env: NodeJS.ProcessEnv = { ...process.env, LOCAL_DATABASE_PATH: join(folder, 'database') };
  delete env.DATABASE_URL;
  try {
    const created = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'tests/persistence-worker.ts', 'create'],
      { env, encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(created.status, 0, created.stderr);
    const output = JSON.parse(created.stdout.trim().split('\n').pop()!);
    assert.ok(output.cookie);
    const restored = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'tests/persistence-worker.ts', 'restore'],
      { env, input: JSON.stringify(output), encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(restored.status, 0, restored.stderr);
    assert.equal(JSON.parse(restored.stdout.trim()).restored, true);
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
});
