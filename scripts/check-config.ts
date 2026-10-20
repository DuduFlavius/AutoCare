const required = [
  'DATABASE_URL',
  'APP_URL',
  'BETTER_AUTH_SECRET',
  'RESEND_API_KEY',
  'EMAIL_FROM',
  'CRON_SECRET',
];
const optional = [
  'RESEND_WEBHOOK_SECRET',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_MONTHLY_PRICE_ID',
  'STRIPE_ANNUAL_PRICE_ID',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
];
let ok = true;
for (const name of required) {
  const present = !!process.env[name];
  console.log(`${name}: ${present ? 'configured' : 'MISSING'}`);
  if (!present) ok = false;
}
for (const name of optional)
  console.log(
    `${name}: ${process.env[name] ? 'configured' : 'not configured (feature unavailable)'}`,
  );
if (process.env.APP_URL && !process.env.APP_URL.startsWith('https://')) {
  console.log('APP_URL: HTTPS required for production.');
  ok = false;
}
if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.startsWith('sk_test_')) {
  console.log('Stripe live mode is blocked by this release.');
  ok = false;
}
console.log(
  ok
    ? 'Required variables are present. Run live acceptance checks before launch.'
    : 'Configuration incomplete. No service was activated.',
);
process.exitCode = ok ? 0 : 1;
