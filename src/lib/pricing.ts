import { eq } from 'drizzle-orm';
import { db } from './db';
import { settings } from './schema';
export const DEFAULT_PRICING = {
  monthlyBani: 15000,
  annualBani: 170000,
  currency: 'ron' as const,
  monthlyPriceId: null as string | null,
  annualPriceId: null as string | null,
  version: 1,
};
export async function pricing() {
  const row = (await db().select().from(settings).where(eq(settings.key, 'billing-pricing')))[0];
  return {
    ...DEFAULT_PRICING,
    ...((row?.value as Partial<typeof DEFAULT_PRICING>) || {}),
    currency: 'ron' as const,
    ...(process.env.AUTOCARE_ENABLE_LIVE_PAYMENTS === 'true' ? {
      monthlyBani: 15000,
      annualBani: 170000,
      monthlyPriceId: process.env.STRIPE_MONTHLY_PRICE_ID || null,
      annualPriceId: process.env.STRIPE_ANNUAL_PRICE_ID || null,
    } : {}),
  };
}
export { savings } from './pricing-display';
