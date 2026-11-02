import { parseServiceDetails } from './service-details';
import { maintenanceTargets, rankMaintenanceForecasts, type MaintenanceSource } from './maintenance-schedule';
export function selectActiveVehicle<T extends { id: string; archived: boolean }>(vehicles: T[], selected: string) {
  const active = vehicles.filter(v => !v.archived);
  return active.find(v => v.id === selected) ?? active[0] ?? null;
}
export function isOilMaintenance(record: {category: string; title: string}) {
  const label = [record.category, record.title].join(' ').toLocaleLowerCase('ro-RO');
  return /ulei/.test(label) && /(schimb|motor|revizie)/.test(label);
}
export function currentHomeMaintenance<T extends MaintenanceSource & {kind: string; cancelled: boolean}>(records: T[]) {
  const ordered = records.filter(r => r.kind === 'service' && !r.cancelled && !parseServiceDetails(r.parts ?? '').completedBy).sort((a,b) => (b.date ?? '').localeCompare(a.date ?? '') || (b.odometer ?? 0) - (a.odometer ?? 0));
  const seen = new Set<string>();
  return ordered.filter(record => {
    const key = isOilMaintenance(record) ? 'oil' : record.category === 'Distribuție' ? 'timing' : null;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}
export function upcomingMaintenance(records: Array<MaintenanceSource & { kind: string; cancelled: boolean }>, currentKm: number, dailyKm: number | null, timezone: string, today = new Date()) {
  return rankMaintenanceForecasts(currentHomeMaintenance(records).flatMap(maintenanceTargets), currentKm, dailyKm, timezone, today);
}
