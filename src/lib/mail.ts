export async function sendMail(to: string, subject: string, text: string, key: string) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error('EMAIL_NOT_CONFIGURED');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': key,
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`EMAIL_PROVIDER_${r.status}`);
  return (await r.json()).id as string;
}
