export type DisplayCurrency = 'RON' | 'EUR';
export type CurrencyPreference = DisplayCurrency | 'auto';
export const currencyPreferenceKey = (ownerId: string) => 'preferences:currency:' + ownerId;
export type ExchangeRate = { date: string; ronPerEuro: string };

export function validExchangeRate(value: unknown, today = new Date().toISOString().slice(0, 10)): value is ExchangeRate {
  if (!value || typeof value !== 'object') return false;
  const { date, ronPerEuro } = value as ExchangeRate;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return false;
  const age = Date.parse(today) - Date.parse(date);
  return age >= 0 && age <= 7 * 86400000 && new Date(Date.parse(date)).toISOString().slice(0, 10) === date &&
    typeof ronPerEuro === 'string' && /^\d{1,2}\.\d{1,6}$/.test(ronPerEuro) && Number(ronPerEuro) > 0;
}

export function parseEcbRate(xml: string, today?: string): ExchangeRate | null {
  const date = xml.match(/<Cube\s+time=['"](\d{4}-\d{2}-\d{2})['"]\s*>/)?.[1];
  const ronPerEuro = xml.match(/<Cube\s+currency=['"]RON['"]\s+rate=['"]([0-9.]+)['"]/i)?.[1];
  const candidate = { date, ronPerEuro };
  return validExchangeRate(candidate, today) ? candidate : null;
}

export function currencyPreference(value: unknown): CurrencyPreference {
  return value === 'RON' || value === 'EUR' ? value : 'auto';
}

export function formatDisplayMoney(locale: string, currency: DisplayCurrency, rate: ExchangeRate | null) {
  const effective = currency === 'EUR' && rate ? 'EUR' : 'RON';
  const format = new Intl.NumberFormat(locale, { style: 'currency', currency: effective });
  if (effective === 'RON' || !rate) return (bani: number) => format.format(bani / 100);
  const digits = rate.ronPerEuro.split('.')[1].length;
  const factor = 10n ** BigInt(digits);
  const units = BigInt(rate.ronPerEuro.replace('.', ''));
  return (bani: number) => {
    if (!Number.isInteger(bani)) return format.format(bani / Number(rate.ronPerEuro) / 100);
    const absolute = Math.abs(bani);
    const cents = Number((2n * BigInt(Math.round(absolute)) * factor + units) / (2n * units));
    return format.format((bani < 0 ? -cents : cents) / 100);
  };
}

export function currencyRateLabel(language: 'ro' | 'en', rate: ExchangeRate | null) {
  if (!rate) return language === 'en' ? 'Exchange rate unavailable. Amounts shown in RON.' : 'Curs indisponibil. Sumele sunt afișate în RON.';
  const locale = language === 'en' ? 'en-GB' : 'ro-RO';
  const date = new Intl.DateTimeFormat(locale, {dateStyle:'medium',timeZone:'UTC'}).format(new Date(rate.date + 'T12:00:00Z'));
  const value = new Intl.NumberFormat(locale, {maximumFractionDigits:6}).format(Number(rate.ronPerEuro));
  return language === 'en' ? `Indicative ECB rate · ${date} · 1 EUR = ${value} RON` : `Curs orientativ BCE · ${date} · 1 EUR = ${value} RON`;
}

export function ronBaniFromEuroCents(cents: number, rate: ExchangeRate): number {
  const decimals = rate.ronPerEuro.split('.')[1].length;
  const scale = 10n ** BigInt(decimals);
  const rateUnits = BigInt(rate.ronPerEuro.replace('.', ''));
  return Number((2n * BigInt(cents) * rateUnits + scale) / (2n * scale));
}
