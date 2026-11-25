import { stripeReadiness } from './provider-readiness.mjs';

if (process.env.VERCEL_ENV === 'production' && process.env.AUTOCARE_ENABLE_EUR_PAYMENTS === 'true') {
  const result = await stripeReadiness(process.env);
  if (result.status !== 'catalog_ready' || result.mode !== 'live' ||
      !result.webhookConfigured || !result.livePaymentsEnabled) {
    console.error('Stripe EUR activation blocked:', JSON.stringify(result));
    process.exitCode = 1;
  } else {
    console.log('Stripe live billing catalog verified:', result.checked, 'recurring prices in RON and EUR');
  }
}
