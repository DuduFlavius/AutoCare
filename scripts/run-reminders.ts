async function main() {
  const url = process.env.APP_URL,
    secret = process.env.CRON_SECRET;
  if (!url || !secret) throw new Error('APP_URL and CRON_SECRET are required');
  const response = await fetch(new URL('/api/v1/jobs/reminders', url), {
    headers: { Authorization: `Bearer ${secret}` },
    signal: AbortSignal.timeout(65000),
  });
  if (!response.ok) {
    console.error('Reminder job failed with HTTP', response.status);
    process.exitCode = 1;
  } else console.log('Reminder job completed:', await response.json());
}
main().catch(() => {
  console.error('Reminder job could not be completed.');
  process.exitCode = 1;
});
export {};
