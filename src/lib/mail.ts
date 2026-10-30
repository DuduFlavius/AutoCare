import { renderEmail, type EmailContent, type EmailTemplate } from './email-templates';
import { safeSystemMailLog } from './mail-log';
export async function sendMail(
  to: string,
  subject: string,
  text: string,
  key: string,
  content?: EmailContent,
  tracking?: { userId: string; template: EmailTemplate },
) {
  const rendered = content || renderEmail('administrative', { subject, message: text });
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    try {
      const { sendGoogleMail } = await import('./google-mail');
      const providerId = await sendGoogleMail(to, rendered, key);
      if (tracking) await safeSystemMailLog(tracking.userId, tracking.template, key, to, 'accepted', providerId);
      return providerId;
    } catch (error) {
      const code = error instanceof Error && 'code' in error && typeof error.code === 'string' ? error.code : 'GMAIL_DELIVERY_UNCONFIRMED';
      if (tracking) await safeSystemMailLog(tracking.userId, tracking.template, key, to, 'unknown', undefined, code);
      throw new Error('EMAIL_TRANSPORT_UNCONFIRMED', { cause: error });
    }
  }
  let providerId: string;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': key,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [to],
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error(`EMAIL_PROVIDER_${r.status}`);
    providerId = (await r.json()).id as string;
  } catch (e) {
    const message =
      e instanceof Error && /^EMAIL_PROVIDER_\d{3}$/.test(e.message)
        ? e.message
        : 'EMAIL_TRANSPORT_UNCONFIRMED';
    if (tracking)
      await safeSystemMailLog(
        tracking.userId,
        tracking.template,
        key,
        to,
        /EMAIL_PROVIDER_4/.test(message) ? 'failed' : 'unknown',
        undefined,
        message,
      );
    // eslint-disable-next-line preserve-caught-error -- Raw provider errors must never enter authentication logs.
    throw new Error(message);
  }
  if (tracking)
    await safeSystemMailLog(tracking.userId, tracking.template, key, to, 'accepted', providerId);
  return providerId;
}
