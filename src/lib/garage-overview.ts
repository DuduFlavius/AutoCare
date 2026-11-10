import { upcomingMaintenance } from './application-home';
import type { dashboard } from './service';

type Data = Awaited<ReturnType<typeof dashboard>>;
type RecordEntry = Data['records'][number];

export function primaryVehicleKey(userId: string) {
  return 'primary-vehicle:' + userId;
}

export function garageOverview(data: Pick<Data, 'vehicles' | 'records'>, today: string) {
  const records = new Map<string, RecordEntry[]>();
  let costs = 0;
  let services = 0;
  let documents = 0;
  const activeVehicles = new Set(data.vehicles.filter(vehicle => !vehicle.archived).map(vehicle => vehicle.id));
  for (const record of data.records) {
    if (record.cancelled) continue;
    const entries = records.get(record.vehicleId) ?? [];
    entries.push(record);
    records.set(record.vehicleId, entries);
    if (record.amountKnown !== false) costs += record.amountBani;
    if (record.kind === 'service' && record.date && record.date <= today) services++;
    if (activeVehicles.has(record.vehicleId) && isActiveGarageDocument(record)) documents++;
  }
  return {
    records,
    totals: {
      vehicles: data.vehicles.length,
      active: activeVehicles.size,
      kilometers: data.vehicles.reduce((sum, vehicle) => sum + vehicle.odometer, 0),
      costs,
      services,
      documents,
    },
  };
}

function isActiveGarageDocument(record: RecordEntry) {
  return record.kind === 'document' && (record.status.days === null || record.status.days >= 0);
}

export function garageVehicleSummary(records: RecordEntry[], odometer: number, timezone: string) {
  const schedule = upcomingMaintenance(records, odometer, null, timezone);
  const maintenance = schedule.find(item => item.status.state !== 'unscheduled');
  const deadlines = [
    ...records.flatMap(record => record.kind === 'document' && record.expiresAt
      ? [{ date: record.expiresAt, title: record.category, overdue: (record.status.days ?? 0) < 0 }]
      : []),
    ...schedule.flatMap(item => item.raw
      ? [{ date: item.raw, title: item.service.title, overdue: (item.status.calendarDays ?? 0) < 0 }]
      : []),
  ];
  const deadline = deadlines.sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  return { activeDocuments: records.filter(isActiveGarageDocument).length, maintenance, deadline };
}
