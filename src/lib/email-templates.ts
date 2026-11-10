import { origin } from './config';
export const emailTemplates = {
  invoice_help: { label: 'Factură și istoric plăți', title: 'Consultă documentele de facturare', subject: 'AutoCare — Factură și istoric plăți', body: 'Deschide abonamentul din cont și consultă istoricul plăților. Pentru o clarificare, trimite echipei data plății și referința facturii, fără datele cardului.', cta: 'Vezi abonamentul', path: '/cont?tab=Abonament', category: 'transactional' },
  subscription_cancelled: { label: 'Reînnoire oprită', title: 'Verifică perioada rămasă', subject: 'AutoCare — Reînnoirea automată este oprită', body: 'Consultă în cont data până la care ai acces. Istoricul mașinii rămâne disponibil conform planului tău după expirare.', cta: 'Vezi abonamentul', path: '/cont?tab=Abonament', category: 'transactional' },
  export_help: { label: 'Descărcare rapoarte', title: 'Pregătește un raport al garajului', subject: 'AutoCare — Cum descarci rapoartele', body: 'Alege mașina, tipul înregistrărilor și intervalul în rapoartele Premium. Exportul de date personale este disponibil separat în setările contului.', cta: 'Deschide Premium', path: '/cont?tab=Premium', category: 'transactional' },
  map_help: { label: 'Localizare și navigație', title: 'Configurează poziția pe hartă', subject: 'AutoCare — Localizare și navigație', body: 'În AutoCare Maps, apasă Poziția mea și permite localizarea precisă. Alege un punct auto sau marchează destinația pe hartă, apoi selectează traseul disponibil.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  service_folder: { label: 'Dosar pentru mecanic', title: 'Trimite istoricul esențial către service', subject: 'AutoCare — Dosar temporar pentru mecanic', body: 'Din Premium poți crea un link temporar la dosarul mașinii. Verifică informațiile partajate înainte de trimitere. Poți revoca oricând linkul.', cta: 'Deschide Premium', path: '/cont?tab=Premium', category: 'transactional' },
  first_vehicle: { label: 'Primul vehicul', title: 'Configurează garajul', subject: 'AutoCare — Adaugă prima mașină', body: 'Adaugă vehiculul și copiază kilometrajul din bord. Înregistrează apoi RCA, ITP și ultima revizie pentru ca mementourile să folosească datele corecte.', cta: 'Intră în garaj', path: '/cont', category: 'transactional' },
  incident_open: { label: 'Incident în investigare', title: 'Investigăm problema raportată', subject: 'AutoCare — Incident în investigare', body: 'Am înregistrat problema raportată. Completează aici simptomele confirmate și eventualele măsuri temporare. Vom reveni cu o actualizare în conversația de suport.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  incident_progress: { label: 'Actualizare incident', title: 'Informații noi despre incident', subject: 'AutoCare — Actualizare incident', body: 'Completează aici progresul confirmat al investigației, funcțiile afectate și următorul moment estimat pentru o informare.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  incident_resolved: { label: 'Incident remediat', title: 'Remedierea este disponibilă pentru verificare', subject: 'AutoCare — Incident remediat', body: 'Am publicat o remediere pentru problema raportată. Actualizează aplicația dacă este necesar și verifică din nou funcția afectată. Scrie-ne în suport dacă problema persistă.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  android_update: { label: 'Actualizare Android', title: 'Verifică actualizarea Android', subject: 'AutoCare — Actualizare Android', body: 'Verifică versiunea disponibilă din Setări în aplicația Android. Salvează întâi traseele GPS. Instalează numai kitul oficial oferit de AutoCare.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  update_failed: { label: 'Actualizare nereușită', title: 'Ajutor pentru actualizarea aplicației', subject: 'AutoCare — Actualizare nereușită', body: 'Dacă instalarea nu a reușit, păstrează aplicația existentă și datele ei. Trimite echipei versiunea instalată și mesajul exact afișat de Android.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  permissions_help: { label: 'Permisiuni aplicație', title: 'Verifică permisiunile necesare', subject: 'AutoCare — Permisiuni aplicație', body: 'Pentru funcțiile activate de tine, verifică permisiunile de localizare și notificare din setările telefonului. Pentru AutoDrive, selectează numai Bluetooth-ul mașinii tale.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  gps_review: { label: 'Verificare kilometraj GPS', title: 'Verifică traseul înainte de sincronizare', subject: 'AutoCare — Verificare kilometraj GPS', body: 'Am primit o sesizare privind traseul sau kilometrajul. Păstrează citirea reală de pe bord și trimite detaliile în conversația de suport. Nu modifica repetat kilometrajul pentru același traseu.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  bluetooth_help: { label: 'Ajutor asociere Bluetooth', title: 'Asociază dispozitivul exact al mașinii', subject: 'AutoCare — Ajutor asociere Bluetooth', body: 'În AutoDrive, verifică numele și adresa Bluetooth ale mașinii. Căștile, ceasurile și alte dispozitive nu trebuie selectate pentru pornirea automată.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  offline_help: { label: 'Sincronizare după lipsa internetului', title: 'Revino online pentru sincronizare', subject: 'AutoCare — Sincronizare după lipsa internetului', body: 'Deschide AutoCare cu internet activ și verifică traseele salvate local. Nu șterge datele aplicației înainte de confirmarea sincronizării.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  account_security: { label: 'Siguranța contului', title: 'Verifică activitatea contului tău', subject: 'AutoCare — Siguranța contului', body: 'Dacă observi activitate pe care nu o recunoști, schimbă parola din fluxul oficial al aplicației și contactează suportul. Echipa nu îți cere parola prin email.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  planned_outage: { label: 'Lucrări programate', title: 'Informare despre lucrările programate', subject: 'AutoCare — Lucrări programate', body: 'Completează intervalul confirmat al lucrărilor și funcțiile afectate. Salvează modificările în curs înainte de intervalul comunicat.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  data_request: { label: 'Solicitare privind datele', title: 'Am înregistrat solicitarea privind datele', subject: 'AutoCare — Solicitare privind datele', body: 'Solicitarea ta a fost înregistrată. Vom continua verificarea identității și comunicarea detaliilor prin canalul de suport securizat.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  itp: { label: 'Expirare ITP', title: 'Verifică termenul inspecției tehnice', subject: 'AutoCare — Expirare ITP', body: 'Verifică data ITP și programează inspecția înainte de expirare. Actualizează documentul în cont după efectuarea inspecției.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  rca: { label: 'Expirare RCA', title: 'Verifică valabilitatea asigurării RCA', subject: 'AutoCare — Expirare RCA', body: 'Consultă data expirării RCA din cont și verifică polița înainte de următoarea deplasare.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  vignette: { label: 'Expirare rovinietă', title: 'Verifică rovinieta înainte de drum', subject: 'AutoCare — Expirare rovinietă', body: 'Verifică valabilitatea rovinietei și datele vehiculului. După reînnoire, actualizează documentul în AutoCare.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  oil_change: { label: 'Schimb de ulei', title: 'Pregătește următorul schimb de ulei', subject: 'AutoCare — Schimb de ulei', body: 'Consultă intervalul de schimb pentru ulei și filtre. Programează lucrarea și înregistrează kilometrajul după intervenție.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  service_due: { label: 'Revizie programată', title: 'Verifică următoarea revizie', subject: 'AutoCare — Revizie programată', body: 'Consultă planul de întreținere al mașinii și confirmă lucrările necesare împreună cu service-ul ales.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  tires: { label: 'Anvelope de sezon', title: 'Pregătește mașina pentru sezon', subject: 'AutoCare — Anvelope de sezon', body: 'Verifică starea anvelopelor, presiunea și recomandările producătorului. Notează lucrările efectuate în istoricul mașinii.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  gps_setup: { label: 'Configurare GPS și Bluetooth', title: 'Configurează AutoDrive pentru mașina ta', subject: 'AutoCare — Configurare GPS și Bluetooth', body: 'Selectează Bluetooth-ul exact al mașinii în AutoDrive și acordă permisiunile cerute. Verifică o sesiune scurtă înainte de utilizarea obișnuită.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  gps_sync: { label: 'Sincronizare trasee', title: 'Verifică sincronizarea traseelor', subject: 'AutoCare — Sincronizare trasee', body: 'Deschide AutoCare cu internet activ și verifică traseele în așteptare. Consultă kilometrajul rezultat înainte de a adăuga o citire manuală.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  app_update: { label: 'Actualizare aplicație', title: 'Verifică actualizările AutoCare', subject: 'AutoCare — Actualizare aplicație', body: 'Consultă versiunea instalată și actualizările disponibile în aplicație. După actualizare, verifică permisiunile pentru GPS și Bluetooth.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  maintenance_notice: { label: 'Mentenanță platformă', title: 'Informații despre disponibilitatea AutoCare', subject: 'AutoCare — Mentenanță platformă', body: 'Completează aici intervalul confirmat al mentenanței și funcțiile afectate. Te vom informa despre reluarea funcționării.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  support_reply: { label: 'Răspuns suport', title: 'Ai un răspuns în centrul de suport', subject: 'AutoCare — Răspuns suport', body: 'Echipa AutoCare a actualizat conversația ta. Deschide centrul de suport din cont pentru a vedea răspunsul.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  support_resolved: { label: 'Solicitare rezolvată', title: 'Verifică soluția pentru solicitarea ta', subject: 'AutoCare — Solicitare rezolvată', body: 'Consultă răspunsul echipei și verifică soluția propusă. Dacă problema persistă, răspunde în conversația din cont.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  document_update: { label: 'Actualizare documente', title: 'Verifică documentele mașinii', subject: 'AutoCare — Actualizare documente', body: 'Consultă documentele din garaj și actualizează fișierele și datele care s-au schimbat.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  premium_grant: { label: 'Acces Premium acordat', title: 'Verifică accesul tău Premium', subject: 'AutoCare — Acces Premium acordat', body: 'Verifică în cont perioada și condițiile accesului Premium acordat. Detaliile actuale sunt disponibile în secțiunea Abonament.', cta: 'Deschide contul', path: '/cont', category: 'transactional' },
  feedback: { label: 'Solicitare feedback', title: 'Cum a fost experiența ta cu AutoCare?', subject: 'AutoCare — Solicitare feedback', body: 'Spune-ne ce funcționează bine și ce ai vrea să îmbunătățim. Ne poți scrie din centrul de suport.', cta: 'Deschide contul', path: '/cont', category: 'promotional' },
  feature_news: { label: 'Funcții noi', title: 'Descoperă noutățile AutoCare', subject: 'AutoCare — Funcții noi', body: 'Consultă noutățile disponibile în contul tău și descoperă funcțiile care te ajută să îți organizezi garajul.', cta: 'Deschide contul', path: '/cont', category: 'promotional' },
  special_offer: { label: 'Ofertă Premium', title: 'Descoperă opțiunile Premium', subject: 'AutoCare — Ofertă Premium', body: 'Verifică ofertele și prețurile afișate în cont. Condițiile și perioada ofertei sunt cele prezentate în secțiunea Abonament.', cta: 'Deschide contul', path: '/cont', category: 'promotional' },
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
  payment_receipt: {
    label: 'Confirmare plată și factură',
    title: 'Plata ta a fost confirmată',
    subject: 'AutoCare — confirmare plată și factură',
    body: 'Plata abonamentului a fost confirmată. Poți deschide factura și istoricul plăților din contul AutoCare.',
    cta: 'Vezi factura',
    path: '/cont?tab=Abonament',
  },
  release_news: {
    label: 'AutoCare News · Lansare importantă',
    title: 'Noutăți AutoCare',
    subject: 'AutoCare News — lansare importantă',
    body: 'Descrie funcțiile noi și schimbările importante din această versiune.',
    cta: 'Explorează AutoCare',
    path: '/functionalitati',
    category: 'promotional',
  },
  renewal: {
    label: 'Reînnoire Premium',
    title: 'Mai departe, cu AutoCare Premium.',
    subject: 'AutoCare — plata pentru reînnoire a fost confirmată',
    body: 'Plata pentru reînnoirea abonamentului tău a fost confirmată. Poți verifica perioada curentă și deschide factura din istoricul plăților.',
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
export function templateCategory(id: keyof typeof emailTemplates): 'transactional' | 'promotional' {
  const t = emailTemplates[id];
  return id === 'promotional' || ('category' in t && t.category === 'promotional') ? 'promotional' : 'transactional';
}
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
  const promotional = input.promotional || templateCategory(template) === 'promotional';
  const preferences = appLink('/cont?tab=Setări');
  const isReminder = template === 'reminder';
  const footer = promotional
    ? 'Primești acest mesaj deoarece ai acceptat comunicările promoționale AutoCare. Îți poți retrage acordul din preferințele de comunicare.'
    : isReminder ? 'Memento AutoCare. Frecvența și canalele se gestionează din setările contului.' : 'Mesaj tranzacțional AutoCare. Gestionează preferințele de comunicare din cont. Emailurile de securitate necesare autentificării sunt trimise la cererea ta.';
  const text = `AutoCare\n\nSalut, ${name}!\n\n${t.title}\n\n${message}\n\n${cta}: ${url}\n\n${footer}\nPreferințe: ${preferences}\nAutoCare · Garajul tău digital\n${appLink('/contact')}`;
  const e = escapeHtml;
  const html = `<!doctype html><html lang="ro"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark light"><title>${e(subject)}</title><style>@media only screen and (max-width:620px){.email-shell{width:100%!important}.email-pad{padding:28px 22px!important}.email-title{font-size:29px!important}.email-cta{display:block!important;text-align:center!important}.email-hero{height:auto!important}}</style></head><body style="margin:0;padding:0;background:#090D14;font-family:Arial,Helvetica,sans-serif;color:#F3F6FA"><div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${e(message.slice(0, 130))}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#090D14"><tr><td align="center" style="padding:28px 8px"><table role="presentation" class="email-shell" width="600" cellspacing="0" cellpadding="0" border="0" style="width:600px;max-width:600px;background:#111925;border-radius:16px;overflow:hidden"><tr><td style="padding:24px 32px;background:#14233b"><a href="${e(appLink('/'))}" style="font-size:27px;font-weight:800;color:#ffffff;text-decoration:none;letter-spacing:-1px">Auto<span style="color:#71a7ff">Care</span></a><span style="float:right;color:#bdcce0;font-size:11px;letter-spacing:2px;line-height:32px">GARAJUL TĂU DIGITAL</span></td></tr><tr><td class="email-hero" style="background:#172b4a;padding:48px 40px 52px;border-top:1px solid #31476a"><p style="margin:0 0 14px;color:#a8c7f5;font-size:11px;letter-spacing:3px;font-weight:bold">AUTOCARE · GARAJUL TĂU DIGITAL</p><p style="margin:0;color:#ffffff;font-size:32px;line-height:1.2;font-weight:800;letter-spacing:-1px">Totul despre mașina ta.<br><span style="color:#9bc1ff">Într-un singur loc.</span></p><p style="margin:20px 0 0;color:#d1def0;font-size:14px;line-height:1.6">Întreținere, documente și notificări importante.</p></td></tr><tr><td class="email-pad" style="padding:36px 40px 40px"><p style="margin:0 0 14px;font-size:12px;letter-spacing:2px;color:#82baff;font-weight:bold">${promotional ? 'AUTOCARE NEWS' : isReminder ? 'AUTOCARE · MEMENTO INTELIGENT' : 'AUTOCARE · CONT ȘI OPERAȚIUNI'}</p><p style="margin:0 0 16px;font-size:16px;color:#B8C4D2">Salut, ${e(name)}!</p><h1 class="email-title" style="margin:0 0 22px;font-size:34px;line-height:1.15;letter-spacing:-1px;color:#F3F6FA">${e(t.title)}</h1>${message
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin:0 0 18px;font-size:16px;line-height:1.75;color:#B8C4D2">${e(p).replace(/\n/g, '<br>')}</p>`,
    )
    .join(
      '',
    )}<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0"><tr><td bgcolor="#2467bd" style="border-radius:8px"><a class="email-cta" href="${e(url)}" style="display:inline-block;padding:17px 25px;border:1px solid #2467bd;border-radius:8px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none;mso-padding-alt:17px 25px">${e(cta)} →</a></td></tr></table><p style="font-size:12px;line-height:1.7;color:#9eafc4;word-break:break-all">Butonul nu funcționează? Deschide acest link:<br><a href="${e(url)}" style="color:#82baff">${e(url)}</a></p></td></tr><tr><td class="email-pad" style="padding:26px 40px;border-top:1px solid #344253;background:#1B2633"><p style="font-size:12px;line-height:1.7;color:#B8C4D2;margin:0 0 16px">${e(footer)}</p><p style="font-size:12px;line-height:1.7;margin:0"><a href="${e(preferences)}" style="color:#82baff">Preferințe de comunicare${promotional ? ' / dezabonare' : ''}</a> · <a href="${e(appLink('/confidentialitate'))}" style="color:#82baff">Confidențialitate</a> · <a href="${e(appLink('/contact'))}" style="color:#82baff">Contact</a></p><p style="font-size:12px;color:#B8C4D2;margin:16px 0 0">© ${new Date().getUTCFullYear()} AutoCare · Garajul tău digital</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
