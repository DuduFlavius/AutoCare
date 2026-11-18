const SITE = 'https://www.autocareapp.ro';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] ?? char);
}

function safeLink(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    return url.toString();
  } catch {
    return null;
  }
}

function emailHtml(subject: string, text: string) {
  const isAction = /confirmă adresa de email|resetează parola/i.test(subject);
  const actionUrl = isAction ? text.trim() : null;
  const verifiedAction = actionUrl ? safeLink(actionUrl) : null;
  const appUrl = isAction ? verifiedAction : SITE + '/cont';
  const buttonLabel = /resetează parola/i.test(subject) ? 'Resetează parola'
    : /confirmă adresa de email/i.test(subject) ? 'Confirmă emailul'
    : 'Deschide aplicația';
  const button = appUrl
    ? `<a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#2463eb;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700">${buttonLabel}</a>`
    : '';
  const bodyText = isAction
    ? 'Pentru a continua în siguranță, folosește butonul de mai jos.'
    : text;
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 12px;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#17243b">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px">
<tr><td style="padding:32px">
<div style="font-size:21px;font-weight:800;color:#17468e">AutoCare Premium</div>
<h1 style="font-size:22px;line-height:1.35;margin:28px 0 16px">${escapeHtml(subject)}</h1>
<p style="white-space:pre-line;line-height:1.7;font-size:15px">${escapeHtml(bodyText)}</p>
<div style="margin:28px 0 16px">${button}</div>
<p style="font-size:14px"><a href="${SITE}" style="color:#17468e;text-decoration:underline">Vizitează site-ul</a></p>
<p style="font-size:12px;color:#66758c;margin-top:28px">AutoCare Premium · ${SITE}</p>
</td></tr></table></body></html>`;
}

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
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, text, html: emailHtml(subject, text) }),
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`EMAIL_PROVIDER_${r.status}`);
  return (await r.json()).id as string;
}
