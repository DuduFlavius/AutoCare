import { Pool } from 'pg';
import { drizzle as pgDrizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as liteDrizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './schema';
type DB = NodePgDatabase<typeof schema>;
const globalDb = globalThis as unknown as { autoDb?: DB; autoLite?: PGlite };
export function db(): DB {
  if (globalDb.autoDb) return globalDb.autoDb;
  if (process.env.DATABASE_URL) {
    globalDb.autoDb = pgDrizzle(new Pool({ connectionString: process.env.DATABASE_URL, max: 5 }), {
      schema,
    });
  } else if (
    process.env.LOCAL_DATABASE_PATH &&
    !process.env.VERCEL &&
    (process.env.NODE_ENV !== 'production' || process.env.ALLOW_LOCAL_PRODUCTION === '1')
  ) {
    const lite = new PGlite(
      process.env.LOCAL_DATABASE_PATH === 'memory' ? undefined : process.env.LOCAL_DATABASE_PATH,
    );
    globalDb.autoLite = lite;
    globalDb.autoDb = liteDrizzle(lite, { schema }) as unknown as DB;
  } else throw new Error('DATABASE_URL lipsește. Configurează baza de date înainte de utilizare.');
  return globalDb.autoDb;
}
export async function closeLocalDb() {
  await globalDb.autoLite?.close();
  delete globalDb.autoDb;
  delete globalDb.autoLite;
}
