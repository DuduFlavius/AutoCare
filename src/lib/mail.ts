const SITE = 'https://www.autocareapp.ro';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char] ?? char);
}

function safeActionLink(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch { return null; }
}

type MailKind = 'verification' | 'password' | 'expiry' | 'service' | 'security' | 'update';

function kindOf(subject: string, text: string): MailKind {
  const combined = (subject + ' ' + text).toLocaleLowerCase('ro');
  if (/confirmă adresa de email|verifică adresa de email/.test(combined)) return 'verification';
  if (/resetează parola|resetare parolă/.test(combined)) return 'password';
  if (/expir|roviniet|\brca\b|\bitp\b|casco/.test(combined)) return 'expiry';
  if (/revizi|service|mentenan|kilometraj/.test(combined)) return 'service';
  if (/securitate|autentificare|parolă schimbată|conectare nouă/.test(combined)) return 'security';
  return 'update';
}

function emailHtml(subject: string, text: string) {
  const kind = kindOf(subject, text);
  const action = kind === 'verification' || kind === 'password';
  const secureUrl = action ? safeActionLink(text.trim()) : null;
  const url = action ? secureUrl : SITE + '/cont';
  const heading: Record<MailKind, string> = {
    verification: 'Confirmă adresa de email.',
    password: 'Resetează parola în siguranță.',
    expiry: 'Un document auto necesită atenția ta.',
    service: 'Ai o actualizare despre întreținerea mașinii.',
    security: 'O notificare importantă despre cont.',
    update: 'Noutăți din garajul tău digital.',
  };
  const intro: Record<MailKind, string> = {
    verification: 'Confirmă adresa pentru a continua folosirea contului AutoCare.',
    password: 'Ai solicitat resetarea parolei. Dacă nu ai făcut această solicitare, poți ignora mesajul.',
    expiry: 'Verifică detaliile documentului și data de expirare în contul tău.',
    service: 'Consultă detaliile reviziei sau ale întreținerii în cont.',
    security: 'Consultă detaliile acestei notificări și verifică securitatea contului.',
    update: 'Ai primit o actualizare de la AutoCare. Consultă detaliile mai jos.',
  };
  const primary: Record<MailKind, string> = {
    verification: 'Confirmă emailul',
    password: 'Resetează parola',
    expiry: 'Deschide aplicația',
    service: 'Deschide aplicația',
    security: 'Deschide aplicația',
    update: 'Deschide aplicația',
  };
  const detail = action ? '' : `<p style="font-size:15px;line-height:1.75;color:#485676;white-space:pre-line;margin:0 0 26px">${escapeHtml(text)}</p>`;
  const mainButton = url ? `<a href="${escapeHtml(url)}" style="display:inline-block;background:#5d35b7;color:#ffffff;text-decoration:none;border-radius:11px;padding:16px 23px;font-size:15px;font-weight:bold;margin:0 10px 10px 0">${primary[kind]} &rarr;</a>` : '';
  const fallback = url ? `<p style="font-size:12px;color:#6b7890;line-height:1.6;margin-top:20px">Butonul nu funcționează? Deschide acest link:<br><a href="${escapeHtml(url)}" style="color:#6541c1;overflow-wrap:anywhere">${escapeHtml(url)}</a></p>` : '';
  return `<!doctype html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:25px 10px;background:#edf1f7;font-family:Arial,Helvetica,sans-serif;color:#171d35">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:auto;background:#ffffff;border-radius:18px;overflow:hidden;border-collapse:separate">
<tr><td style="background:#121429;padding:25px 32px 20px;border-bottom:3px solid #9b5bdd">
<div style="font-size:27px;letter-spacing:-1px;font-weight:800;color:#ffffff">Auto<span style="color:#ba82ff">Care</span></div>
<div style="font-size:11px;color:#c6c5e5;letter-spacing:2px;margin-top:7px">AUTOCARE · GARAJUL TĂU DIGITAL</div></td></tr>
<tr><td style="background:#19132e;padding:29px 32px 30px;color:#ffffff">
<div style="font-size:12px;color:#c49bff;letter-spacing:2px;font-weight:bold;margin-bottom:12px">AUTOCARE PREMIUM</div>
<div style="font-size:28px;line-height:1.25;font-weight:bold;margin-bottom:13px">Garajul tău digital,<br><span style="color:#bd91ff">oriunde cu tine.</span></div>
<div style="font-size:13px;color:#ddd5ef;line-height:1.9">▣ Documente și expirări &nbsp; · &nbsp; ◉ GPS și trasee<br>♧ Notificări inteligente &nbsp; · &nbsp; ◇ Administrare auto</div>
</td></tr>
<tr><td style="padding:34px 32px 28px">
<div style="font-size:11px;letter-spacing:2px;font-weight:bold;color:#7854c8;margin-bottom:18px">AUTOCARE</div>
<h1 style="font-size:25px;line-height:1.3;margin:0 0 17px;color:#171d35">${heading[kind]}</h1>
<p style="font-size:15px;line-height:1.75;color:#485676;margin:0 0 17px">${intro[kind]}</p>
${detail}
<div style="margin-top:20px">${mainButton}<a href="${SITE}" style="display:inline-block;border:1px solid #9d78dd;color:#5732ae;text-decoration:none;border-radius:11px;padding:15px 20px;font-size:15px;font-weight:bold">Vizitează site-ul</a></div>
${fallback}
</td></tr>
<tr><td style="background:#f4f6fb;border-top:1px solid #e2e7f0;padding:23px 32px;color:#66728b;font-size:12px;line-height:1.8">
AutoCare · Garajul tău digital. Gestionează preferințele de comunicare din cont.<br>
<a href="${SITE}/cont" style="color:#6943be">Preferințe de comunicare</a> · <a href="${SITE}" style="color:#6943be">Vizitează site-ul</a><br>
© ${new Date().getUTCFullYear()} AutoCare
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
