/** Commercial amounts are fixed catalog prices, not a live FX conversion. Minor units throughout. */
export type BillingCurrency = 'ron' | 'eur';
export type BillingInterval = 'monthly' | 'quarterly' | 'annual';
export const BILLING_AMOUNTS = {
 ron: { monthly: 15000, quarterly: 45000, annual: 170000 },
 eur: { monthly: 3000, quarterly: 9000, annual: 34000 },
} as const;
export function billingAmount(interval: BillingInterval, currency: BillingCurrency) { return BILLING_AMOUNTS[currency][interval]; }
export function billingRecurrence(interval: BillingInterval) {return {interval:interval==='annual'?'year' as const:'month' as const,interval_count:interval==='quarterly'?3:1};}
export function billingCurrency(value:unknown):BillingCurrency {if(value==='eur'||value==='EUR')return 'eur';return 'ron';}
