// Apply only this additive migration after a successful production build.
import { readFile } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import { db, closeLocalDb } from '../src/lib/db';
async function main() {
  // Git branch previews do not share production database credentials.
  // Keep the production migration mandatory; visual previews never mutate a database.
  if (process.env.VERCEL_ENV === 'preview') {
    console.log('Mail Center migration skipped for Preview; production migration remains required.');
    return;
  }
  if (process.env.DATABASE_URL) {
    const url = new URL(process.env.DATABASE_URL);
    if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
    process.env.DATABASE_URL = url.toString();
  }
  const migrations = ['0010_mail_center.sql', '0011_mechanic_shares.sql', '0012_subscription_extensions.sql', '0013_ai_support_workspace.sql'];
  const sources = await Promise.all(migrations.map(name => readFile('migrations/' + name, 'utf8')));
  const source = sources.join('\n--> statement-breakpoint\n');
  await db().transaction(async (tx) => {
    for (const statement of source.split('--> statement-breakpoint').filter((x) => x.trim()))
      await tx.execute(sql.raw(statement));
    await tx.execute(
      sql`CREATE TABLE IF NOT EXISTS autocare_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`,
    );
    for (const name of migrations) await tx.execute(sql`INSERT INTO autocare_migrations(name) VALUES(${name}) ON CONFLICT DO NOTHING`);
  });
  console.log('Additive migrations completed.');
}
main()
  .then(async () => {
    await closeLocalDb();
    process.exit(0);
  })
  .catch(() => {
    console.error('Mail Center migration failed. No connection details are logged.');
    process.exit(1);
  });
