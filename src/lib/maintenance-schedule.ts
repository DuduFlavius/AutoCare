import { parseServiceDetails } from './service-details';
const positive = (value: string | undefined) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};
const firstDate = (dates: Array<string | null | undefined>) =>
  dates
    .filter(
      (x): x is string =>
        !!x &&
        /^\d{4}-\d{2}-\d{2}$/.test(x) &&
        Number.isFinite(Date.parse(x + 'T00:00:00Z')) &&
        new Date(x + 'T00:00:00Z').toISOString().slice(0, 10) === x,
    )
    .sort()[0] || null;
export function maintenanceSchedule({
  category,
  odometer,
  nextKm,
  expiresAt,
  date,
  details,
}: {
  category: string;
  odometer: number | null;
  nextKm: number | null;
  expiresAt?: string | null;
  date?: string | null;
  details: Record<string, string>;
}) {
  const interval =
    positive(details.intervalIntretinere) ||
    positive(
      category === 'Schimb ulei'
        ? details.intervalUlei
        : category === 'Distribuție'
          ? details.intervalDistributie
          : undefined,
    );
  const categoryDates: Record<string, string> = {
    ITP: 'expirareITP',
    Frâne: 'verificareFrane',
    Baterie: 'verificareBaterie',
    Distribuție: 'urmatoareaDataDistributie',
  };
  let monthDate: string | null = null;
  const months = positive(details.intervalLuni);
  if (months && months <= 1200 && date && firstDate([date])) {
    const start = new Date(date + 'T00:00:00Z'),
      target = new Date(start);
    target.setUTCDate(1);
    target.setUTCMonth(target.getUTCMonth() + months);
    const last = new Date(
      Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
    ).getUTCDate();
    target.setUTCDate(Math.min(start.getUTCDate(), last));
    monthDate = target.toISOString().slice(0, 10);
  }
  const filters = Array.from(
    new Set(
      Object.keys(details)
        .filter((key) => /^filtru\d+(?:Tip|Interval|Km|Data)$/.test(key))
        .map((key) => key.match(/^filtru\d+/)![0]),
    ),
  );
  const filterKm = filters
    .map(
      (key) =>
        positive(details[key + 'Km']) ||
        (odometer !== null && positive(details[key + 'Interval'])
          ? odometer + positive(details[key + 'Interval'])!
          : null),
    )
    .filter((x): x is number => x !== null);
  const ownKm = nextKm ?? (odometer !== null && interval ? odometer + interval : null);
  return {
    nextKm: ownKm ?? (filterKm.length ? Math.min(...filterKm) : null),
    expiresAt:
      expiresAt ||
      firstDate([
        details[categoryDates[category] || 'urmatoareaVerificare'],
        monthDate,
        ...filters.map((key) => details[key + 'Data']),
      ]),
  };
}
export type MaintenanceSource = {
  id: string;
  title: string;
  category: string;
  odometer: number | null;
  nextKm: number | null;
  date: string | null;
  expiresAt: string | null;
  parts: string | null;
};
export function maintenanceTargets(record: MaintenanceSource) {
  const details = parseServiceDetails(record.parts || '');
  const schedule = maintenanceSchedule({ ...record, details });
  const targets: Array<{
    id: string;
    title: string;
    nextKm: number | null;
    expiresAt: string | null;
  }> = [];
  const filterKeys = Array.from(
    new Set(
      Object.keys(details)
        .filter((key) => /^filtru\d+(?:Tip|Interval|Km|Data)$/.test(key))
        .map((key) => key.match(/^filtru\d+/)![0]),
    ),
  );
  if (record.category !== 'Filtre' || !filterKeys.length)
    if (schedule.nextKm !== null || schedule.expiresAt)
      targets.push({ id: record.id, title: record.title || record.category, ...schedule });
  for (const key of filterKeys) {
    const interval = positive(details[key + 'Interval']);
    const next =
      positive(details[key + 'Km']) ??
      (interval && record.odometer !== null ? record.odometer + interval : null);
    const due = firstDate([details[key + 'Data']]);
    if (next !== null || due)
      targets.push({
        id: record.id + ':' + key,
        title:
          (record.title || record.category) +
          ' · ' +
          (details[key + 'Tip'] || '#' + (Number(key.match(/\d+/)![0]) + 1)),
        nextKm: next,
        expiresAt: due,
      });
  }
  return targets;
}
