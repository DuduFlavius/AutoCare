import { parseServiceDetails } from './service-details';

type Service = { kind: string; date: string | null; expiresAt?: string | null; parts?: string | null; createdAt?: Date | string };

export function isPlannedService(record: Service, today: string) {
  return record.kind === 'service' && (
    parseServiceDetails(record.parts ?? '').planned === '1' ||
    (!!record.date && (record.date > today || (!!record.createdAt && record.date > new Date(record.createdAt).toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' }))))
  );
}

export function calendarRecordDate(record: Service, today: string) {
  if (record.kind === 'service' && parseServiceDetails(record.parts ?? '').completedBy) return null;
  return isPlannedService(record, today) ? record.date ?? record.expiresAt ?? null : record.expiresAt ?? null;
}
