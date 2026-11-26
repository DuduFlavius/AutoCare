import { documentStatus } from './config';
import { currencyRateLabel, formatDisplayMoney, type DisplayCurrency, type ExchangeRate } from './exchange-rate';
import { recordCategory } from './record-categories';
import { reportAccent, reportLayout } from './report-layout';

const titles: Record<string, [string, string]> = {
  ITP: ['Inspecție tehnică periodică (ITP)', 'Periodic Technical Inspection (ITP)'],
  RCA: ['Asigurare de răspundere civilă auto (RCA)', 'Motor Third-Party Liability Insurance (RCA)'],
  Rovinietă: ['Rovinietă', 'Romanian Road Vignette'],
};
export const documentSheetTitle = (category: string, language: 'ro' | 'en') =>
  titles[category]?.[language === 'en' ? 1 : 0]
  ?? recordCategory('document', category)?.[language === 'en' ? 'en' : 'ro']
  ?? category;
export const documentSheetName = (category: string, plate: string, language: 'ro' | 'en') =>
  (language === 'en' ? 'AutoCare document sheet' : 'Fișă document AutoCare') + ' - ' +
  documentSheetTitle(category, language).replace(/[<>:"/\\|?*\p{Cc}]/gu, ' ').slice(0, 80) + ' - ' +
  plate.replace(/[<>:"/\\|?*\p{Cc}]/gu, ' ').slice(0, 20) + '.pdf';

type Vehicle = { brand: string; model: string; plate: string; year: number };
type Entry = { category: string; title: string; date: string | null; expiresAt: string | null; number: string | null;
  provider: string | null; notes: string | null; amountBani: number; amountKnown: boolean; cancelled: boolean };
export async function documentSheet(entry: Entry, vehicle: Vehicle, options: {
  language: 'ro' | 'en'; currency: DisplayCurrency; rate: ExchangeRate | null; timezone: string; now?: Date;
}) {
  const { language, currency, rate, timezone, now = new Date() } = options;
  const en = language === 'en', t = (ro: string, english: string) => en ? english : ro;
  const locale = en ? 'en-GB' : 'ro-RO';
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z'));
  const status = documentStatus(entry.expiresAt, now, timezone);
  const stateLabel = entry.cancelled ? t('Arhivat', 'Archived') : {
    valid: t('Valabil', 'Valid'), soon: t('Expiră în curând', 'Expiring Soon'),
    expired: t('Expirat', 'Expired'), incomplete: t('Fără termen înregistrat', 'No expiry recorded'),
  }[status.state] ?? t('Fără termen înregistrat', 'No expiry recorded');
  const L = await reportLayout({
    title: documentSheetTitle(entry.category, language), subtitle: t('Fișă digitală de evidență', 'Digital record sheet'),
    generated: now.toLocaleDateString(locale, { timeZone: timezone }), period: '', edition: t('DOCUMENTE AUTO', 'VEHICLE DOCUMENTS'), en,
  });
  L.graphic(48, (x, y, w, page) => {
    L.rectangle(x, y - 37, w, 39);
    L.rectangle(x, y - 37, 2, 39, reportAccent);
    const shapes: Record<string, string> = {
      ITP: 'M5 3H19V22H5Z M9 3V1H15V3 M8 12L11 15L16 9',
      RCA: 'M12 2L21 6V12Q21 19 12 23Q3 19 3 12V6Z M8 12L11 15L16 9',
      CASCO: 'M12 2L21 6V12Q21 19 12 23Q3 19 3 12V6Z M8 11H16 M12 7V15',
      Rovinietă: 'M10 2L4 22 M14 2L20 22 M12 4V8 M12 11V15 M12 18V22',
      Permis: 'M2 5H22V20H2Z M6 9H10V15H6Z M13 10H18 M13 14H18',
      CIV: 'M4 3H20V21H4Z M8 7H16 M8 12H16 M8 17H14',
      'Asistență rutieră': 'M4 14V10Q4 3 12 3Q20 3 20 10V14 M3 11H7V18H3Z M17 11H21V18H17Z M20 18Q20 22 13 22',
    };
    page.drawSvgPath(shapes[entry.category] ?? 'M5 2H15L20 7V22H5Z M15 2V7H20 M8 12H17 M8 16H16', {
      x: x+14, y:y-7, scale: .8, borderColor: reportAccent, borderWidth: 1.6,
    });
    L.text(stateLabel, x + 48, y - 22, 11, true);
    if (status.days !== null && !entry.cancelled) {
      const remaining = new Intl.NumberFormat(locale).format(Math.abs(status.days)) + ' ' +
        (status.days < 0 ? t('zile de la expirare', 'days overdue') : t('zile până la expirare', 'days until expiry'));
      L.text(remaining, x + w - 12 - L.measure(remaining, 9), y - 22, 9);
    }
  });
  L.section('01', t('Vehicul', 'Vehicle'), 58);
  L.paragraph(vehicle.brand + ' ' + vehicle.model + ' · ' + vehicle.year, { strong: true });
  L.paragraph(t('Număr de înmatriculare', 'Registration Number') + '  /  ' + vehicle.plate);
  L.section('02', t('Datele documentului', 'Document information'), 60);
  const values: [string, string | null][] = [
    [t('Numărul documentului', 'Document Number'), entry.number],
    [t('Emitent', 'Issuer'), entry.provider],
    [t('Data emiterii', 'Issue Date'), entry.date ? date(entry.date) : null],
    [t('Data expirării', 'Expiry Date'), entry.expiresAt ? date(entry.expiresAt) : null],
    [t('Perioada de valabilitate', 'Validity Period'), entry.date && entry.expiresAt ? date(entry.date) + ' – ' + date(entry.expiresAt) : null],
    [t('Cost înregistrat', 'Recorded cost'), entry.amountKnown ? formatDisplayMoney(locale, currency, rate)(entry.amountBani) : null],
  ];
  for (const [label, value] of values) if (value) L.paragraph(label + '  /  ' + value);
  if (!values.some(([, value]) => value)) L.paragraph(t('Nu au fost introduse informații suplimentare.', 'No additional information was entered.'));
  if (entry.amountKnown && currency === 'EUR') L.paragraph(currencyRateLabel(language, rate));
  const title = entry.title === entry.category ? '' : entry.title;
  if (title || entry.notes) {
    L.section('03', t('Informații suplimentare', 'Additional information'));
    if (title) L.paragraph(title, { strong: true });
    if (entry.notes) L.paragraph(entry.notes);
  }
  L.paragraph(t('Fișă informativă AutoCare. Consultă documentul oficial emis de autoritate, asigurător sau furnizor.', 'AutoCare information sheet. Refer to the official document issued by the relevant authority, insurer or provider.'));
  return L.finish();
}
