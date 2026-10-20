import { documentStatus } from './config';
export type RecordFilters = {
  kind?: string;
  vehicleId?: string;
  category?: string;
  status?: string;
  archived?: string;
  q?: string;
  from?: string;
  to?: string;
};
type Filterable = {
  kind: string;
  vehicleId: string;
  category: string;
  title: string;
  provider: string | null;
  date: string | null;
  expiresAt: string | null;
  cancelled: boolean;
};
export function filterRecords<T extends Filterable>(
  rows: T[],
  f: RecordFilters,
  now = new Date(),
  timezone = 'Europe/Bucharest',
) {
  return rows.filter((r) => {
    if (f.kind && r.kind !== f.kind) return false;
    if (f.vehicleId && r.vehicleId !== f.vehicleId) return false;
    if (f.category && r.category !== f.category) return false;
    if (f.archived === 'only' && !r.cancelled) return false;
    if (f.archived !== 'all' && f.archived !== 'only' && f.status !== 'archived' && r.cancelled)
      return false;
    if (
      f.status &&
      (r.cancelled ? 'archived' : documentStatus(r.expiresAt, now, timezone).state) !== f.status
    )
      return false;
    if (f.from && (!r.date || r.date < f.from)) return false;
    if (f.to && (!r.date || r.date > f.to)) return false;
    return (
      !f.q ||
      `${r.title} ${r.category} ${r.provider || ''}`
        .toLocaleLowerCase('ro')
        .includes(f.q.trim().toLocaleLowerCase('ro'))
    );
  });
}
export function documentCounts(
  rows: Filterable[],
  now = new Date(),
  timezone = 'Europe/Bucharest',
) {
  const active = rows.filter((r) => r.kind === 'document' && !r.cancelled);
  const states = active.map((r) => documentStatus(r.expiresAt, now, timezone).state);
  return {
    total: active.length,
    valid: states.filter((x) => x === 'valid').length,
    soon: states.filter((x) => x === 'soon').length,
    expired: states.filter((x) => x === 'expired').length,
    incomplete: states.filter((x) => x === 'incomplete').length,
  };
}
export function serviceStats<
  T extends Filterable & {
    amountBani: number;
    amountKnown?: boolean;
    odometer: number | null;
    nextKm: number | null;
  },
>(rows: T[], now = new Date(), timezone = 'Europe/Bucharest') {
  const active = rows.filter((r) => r.kind === 'service' && !r.cancelled);
  const upcoming = active
    .filter((r) => r.expiresAt && documentStatus(r.expiresAt, now, timezone).days! >= 0)
    .sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!))[0];
  const mileage =
    active
      .filter((r) => r.odometer !== null)
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0]?.odometer ?? null;
  return {
    count: active.length,
    totalBani: active
      .filter((r) => r.amountKnown !== false)
      .reduce((sum, r) => sum + r.amountBani, 0),
    unknownCosts: active.filter((r) => r.amountKnown === false).length,
    next: upcoming?.expiresAt || null,
    lastOdometer: mileage,
  };
}
