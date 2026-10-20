import { unstable_cache } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { settings } from './schema';
export const verificationKey = 'google-site-verification';
export const googleVerification = unstable_cache(
  async (): Promise<string | null> => {
    if (process.env.DATABASE_URL || process.env.LOCAL_DATABASE_PATH) {
      try {
        const row = (
          await db().select().from(settings).where(eq(settings.key, verificationKey))
        )[0];
        if (typeof row?.value === 'string') return row.value;
      } catch {
        /* Public pages remain available during a database outage. */
      }
    }
    return process.env.GOOGLE_SITE_VERIFICATION || null;
  },
  ['autocare-google-verification'],
  { tags: ['autocare-google-verification'], revalidate: 3600 },
);
