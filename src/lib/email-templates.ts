import { origin } from './config';
export const emailTemplates = {
  gmail_test: {
    label: 'Test Gmail',
    title: 'O conexiune pregătită de drum.',
    subject: 'AutoCare — test Gmail premium',
    body: 'Conexiunea Gmail API funcționează. Acest email a fost solicitat manual de Fondator. Poți verifica starea automatizărilor în Mail Center.',
    cta: 'Deschide AutoCare',
    path: '/admin',
  },
  welcome: {
    label: 'Bun venit',
    title: 'Bine ai venit în garajul tău digital.',
    subject: 'Bun venit în AutoCare',
    body: 'Mașinile, documentele și istoricul de întreținere au acum un loc al lor. Adaugă prima mașină și organizează următorul drum cu mai multă claritate.',
    cta: 'Intră în garaj',
    path: '/cont',
  },
  verification: {
    label: 'Verificare email',
    title: 'Confirmă adresa ta de email.',
    subject: 'Confirmă adresa de email AutoCare',
    body: 'Mai ai un singur pas pentru a confirma adresa asociată contului tău AutoCare. Folosește butonul de mai jos. Dacă nu ai cerut acest email, îl poți ignora.',
    cta: 'Confirmă adresa de email',
    path: '/cont',
  },
  password_reset: {
    label: 'Resetare parolă',
    title: 'Un nou început, în siguranță.',
    subject: 'Resetează parola AutoCare',
    body: 'Am primit o cerere de resetare a parolei pentru contul tău AutoCare. Alege o parolă nouă folosind linkul securizat de mai jos. Dacă nu ai făcut această cerere, ignoră acest email.',
    cta: 'Resetează parola',
    path: '/autentificare',
  },
  premium_expiry: {
    label: 'Expirare Premium',
    title: 'Accesul tău Premium se apropie de final.',
    subject: 'AutoCare — verifică expirarea accesului Premium',
    body: 'Accesul Premium fără reînnoire automată se apropie de final. Verifică data și opțiunile disponibile în contul tău. Datele mașinilor tale rămân în AutoCare.',
    cta: 'Vezi abonamentul',
    path: '/cont?tab=Abonament',
  },
  renewal: {
    label: 'Reînnoire Premium',
    title: 'Mai departe, cu AutoCare Premium.',
    subject: 'AutoCare — plata pentru reînnoire a fost confirmată',
    body: 'Plata pentru reînnoirea abonamentului tău a fost confirmată. Poți verifica perioada curentă și detaliile abonamentului în cont.',
    cta: 'Vezi abonamentul',
    path: '/cont?tab=Abonament',
  },
  payment_failed: {
    label: 'Plată eșuată',
    title: 'Plata are nevoie de atenția ta.',
    subject: 'AutoCare — plata abonamentului nu a reușit',
    body: 'Procesatorul de plăți nu a putut confirma plata abonamentului. Verifică detaliile și metoda de plată în cont. Nu îți vom cere datele cardului prin email.',
    cta: 'Gestionează plata',
    path: '/cont?tab=Abonament',
  },
  administrative: {
    label: 'Anunț administrativ',
    title: 'Noutăți despre contul tău AutoCare.',
    subject: 'AutoCare — informații pentru contul tău',
    body: 'Ai primit o actualizare administrativă din partea echipei AutoCare. Consultă detaliile în contul tău.',
    cta: 'Deschide contul',
    path: '/cont',
  },
  promotional: {
    label: 'Noutăți promoționale',
    title: 'Mai mult pentru fiecare drum.',
    subject: 'Noutăți AutoCare',
    body: 'Descoperă noutățile AutoCare și opțiunile disponibile pentru garajul tău digital.',
    cta: 'Descoperă AutoCare',
    path: '/cont',
  },
  reminder: {
    label: 'Memento auto',
    title: 'Un detaliu mic. Un drum mai liniștit.',
    subject: 'AutoCare — memento pentru mașina ta',
    body: 'Verifică documentele și lucrările programate în garajul tău AutoCare.',
    cta: 'Vezi garajul',
    path: '/cont',
  },
} as const;
export type EmailTemplate = keyof typeof emailTemplates;
export type EmailContent = { subject: string; text: string; html: string };
export type TemplateInput = {
  name?: string;
  message?: string;
  subject?: string;
  ctaLabel?: string;
  ctaPath?: string;
  actionUrl?: string;
  promotional?: boolean;
};
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!,
  );
export function appLink(path: string) {
  if (!path.startsWith('/') || path.startsWith('//') || /[\\\r\n]/.test(path))
    throw new Error('EMAIL_INVALID_LINK');
  const url = new URL(path, origin());
  if (url.origin !== new URL(origin()).origin) throw new Error('EMAIL_INVALID_LINK');
  return url.toString();
}
export function renderEmail(template: EmailTemplate, input: TemplateInput = {}): EmailContent {
  const t = emailTemplates[template];
  const subject = (input.subject || t.subject).replace(/[\r\n]/g, ' ').slice(0, 180);
  const message = input.message || t.body;
  const cta = input.ctaLabel || t.cta;
  const url = input.actionUrl || appLink(input.ctaPath || t.path);
  const parsed = new URL(url);
  if (
    !['https:', 'http:'].includes(parsed.protocol) ||
    parsed.origin !== new URL(origin()).origin ||
    /[\r\n]/.test(url)
  )
    throw new Error('EMAIL_INVALID_LINK');
  const name = input.name?.trim() || 'prietene';
  const promotional = input.promotional || template === 'promotional';
  const preferences = appLink('/cont?tab=Setări');
  const footer = promotional
    ? 'Primești acest mesaj deoarece ai acceptat comunicările promoționale AutoCare. Îți poți retrage acordul din preferințele de comunicare.'
    : 'Mesaj tranzacțional AutoCare. Gestionează preferințele de comunicare din cont. Emailurile de securitate necesare autentificării sunt trimise la cererea ta.';
  const text = `AutoCare\n\nSalut, ${name}!\n\n${t.title}\n\n${message}\n\n${cta}: ${url}\n\n${footer}\nPreferințe: ${preferences}\nAutoCare · Garajul tău digital\n${appLink('/')}`;
  const e = escapeHtml;
  const html = `<!doctype html><html lang="ro"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${e(subject)}</title><style>@media only screen and (max-width:620px){.email-shell{width:100%!important}.email-pad{padding:28px 22px!important}.email-title{font-size:29px!important}.email-cta{display:block!important;text-align:center!important}.email-hero{height:auto!important}}</style></head><body style="margin:0;padding:0;background:#eef2f8;font-family:Arial,Helvetica,sans-serif;color:#17283f"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${e(message.slice(0, 130))}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef2f8"><tr><td align="center" style="padding:28px 8px"><table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden"><tr><td style="padding:24px 32px;background:#14233b"><a href="${e(appLink('/'))}" style="font-size:27px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:-1px">Auto<span style="color:#71a7ff">Care</span></a><span style="float:right;color:#bdcce0;font-size:11px;letter-spacing:2px;line-height:32px">GARAJUL TĂU DIGITAL</span></td></tr><tr><td class="email-hero" style="background:#172b4a;padding:48px 40px 52px;border-top:1px solid #31476a"><p style="margin:0 0 14px;color:#a8c7f5;font-size:11px;letter-spacing:3px;font-weight:bold">AUTOCARE · GARAJUL TĂU DIGITAL</p><p style="margin:0;color:#ffffff;font-size:32px;line-height:1.2;font-weight:800;letter-spacing:-1px">Totul despre mașina ta.<br><span style="color:#9bc1ff">Într-un singur loc.</span></p><p style="margin:20px 0 0;color:#d1def0;font-size:14px;line-height:1.6">Întreținere, documente și notificări importante.</p></td></tr><tr><td class="email-pad" style="padding:36px 40px 40px"><p style="margin:0 0 14px;font-size:12px;letter-spacing:2px;color:#2467bd;font-weight:bold">${promotional ? 'NOUTĂȚI AUTOCARE' : 'AUTOCARE · PENTRU TINE'}</p><p style="margin:0 0 16px;font-size:16px;color:#506784">Salut, ${e(name)}!</p><h1 class="email-title" style="margin:0 0 22px;font-size:34px;line-height:1.15;letter-spacing:-1px;color:#17283f">${e(t.title)}</h1>${message
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin:0 0 18px;font-size:16px;line-height:1.75;color:#506078">${e(p).replace(/\n/g, '<br>')}</p>`,
    )
    .join(
      '',
    )}<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0"><tr><td bgcolor="#2467bd" style="border-radius:8px"><a class="email-cta" href="${e(url)}" style="display:inline-block;padding:17px 25px;border:1px solid #2467bd;border-radius:8px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;mso-padding-alt:17px 25px">${e(cta)} →</a></td></tr></table><p style="font-size:12px;line-height:1.7;color:#697b91;word-break:break-all">Butonul nu funcționează? Deschide acest link:<br><a href="${e(url)}" style="color:#2467bd">${e(url)}</a></p></td></tr><tr><td class="email-pad" style="padding:26px 40px;border-top:1px solid #e2e9f3;background:#f7f9fc"><p style="font-size:12px;line-height:1.7;color:#64748b;margin:0 0 16px">${e(footer)}</p><p style="font-size:12px;line-height:1.7;margin:0"><a href="${e(preferences)}" style="color:#2467bd">Preferințe de comunicare${promotional ? ' / dezabonare' : ''}</a> · <a href="${e(appLink('/confidentialitate'))}" style="color:#2467bd">Confidențialitate</a></p><p style="font-size:12px;color:#64748b;margin:16px 0 0">© ${new Date().getUTCFullYear()} AutoCare · Garajul tău digital</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
