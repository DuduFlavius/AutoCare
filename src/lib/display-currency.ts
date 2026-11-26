import type { CurrencyPreference, DisplayCurrency } from './exchange-rate';

export function accountDisplayCurrency(language: 'ro' | 'en', preferred: CurrencyPreference = 'auto'): DisplayCurrency {
  if (preferred !== 'auto') return preferred;
  return language === 'en' ? 'EUR' : 'RON';
}
