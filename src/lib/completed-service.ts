import { parseServiceDetails, serializeServiceDetails } from './service-details';
import type { MaintenanceSource } from './maintenance-schedule';
/** Seed a new service; never copy old incurred costs or absolute deadlines. */
export function completedServiceSeed<T extends MaintenanceSource>(
  record: T,
  odometer: number,
  date: string,
): T {
  const details = parseServiceDetails(record.parts || '');
  for (const key of Object.keys(details))
    if (
      /^(cost|completedBy|previousService)|^filtru\d+(Cost|Km|Data)$|^urmatoarea|^verificare|^expirare/.test(
        key,
      )
    )
      delete details[key];
  const f = new FormData();
  for (const [key, value] of Object.entries(details)) f.set('ac_' + key, value);
  return {
    ...record,
    date,
    odometer,
    expiresAt: null,
    nextKm: null,
    parts: serializeServiceDetails('', f, ''),
    amountBani: 0,
    amountKnown: false,
    provider: '',
    number: '',
    notes: '',
  };
}
