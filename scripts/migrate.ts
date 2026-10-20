import { readFile, readdir } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { db, closeLocalDb } from '../src/lib/db';
export async function migrate() {
  const d = db();
  await d.execute(
    sql.raw(
      'CREATE TABLE IF NOT EXISTS autocare_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    ),
  );
  for (const name of (await readdir('migrations')).filter((n) => n.endsWith('.sql')).sort()) {
    const done = await d.execute(sql`SELECT name FROM autocare_migrations WHERE name=${name}`);
    if (done.rows.length) continue;
    const source = await readFile('migrations/' + name, 'utf8');
    await d.transaction(async (tx) => {
      for (const statement of source.split('--> statement-breakpoint').filter((x) => x.trim()))
        await tx.execute(sql.raw(statement));
      await tx.execute(sql`INSERT INTO autocare_migrations(name) VALUES(${name})`);
    });
    console.log('Migration applied:', name);
  }
}
if (process.argv[1]?.endsWith('migrate.ts'))
  migrate()
    .then(async () => {
      await closeLocalDb();
      process.exit(0);
    })
    .catch(() => {
      console.error('Migration failed. Check database access and SQL.');
      process.exit(1);
    });
