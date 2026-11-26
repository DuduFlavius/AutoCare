import { parseEcbRate, validExchangeRate, type ExchangeRate } from './exchange-rate';

const source = 'https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml';
let lastRate: ExchangeRate | null = null;
let pending: Promise<ExchangeRate | null> | undefined;
let refreshAfter = 0;

export function latestExchangeRate(): Promise<ExchangeRate | null> {
  if (pending) return pending;
  if (Date.now() < refreshAfter) return Promise.resolve(validExchangeRate(lastRate) ? lastRate : null);
  pending = (async () => {
    try {
      const response = await fetch(source, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(10000) });
      const rate = response.ok ? parseEcbRate(await response.text()) : null;
      if (rate) lastRate = rate;
      refreshAfter = Date.now() + (rate ? 3600000 : 60000);
    } catch {
      refreshAfter = Date.now() + 60000;
    }
    return validExchangeRate(lastRate) ? lastRate : null;
  })().finally(() => { pending = undefined; });
  return pending;
}
