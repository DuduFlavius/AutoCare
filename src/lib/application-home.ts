import { isPlannedService } from './planned-service';
import { localDate } from './config';
import {isOilMaintenance} from './maintenance-kind';
export {isOilMaintenance} from './maintenance-kind';
import { parseServiceDetails } from './service-details';
import { maintenanceTargets, rankMaintenanceForecasts, type MaintenanceSource } from './maintenance-schedule';
export function selectActiveVehicle<T extends { id: string; archived: boolean }>(vehicles: T[], selected: string) {
  const active = vehicles.filter(v => !v.archived);
  return active.find(v => v.id === selected) ?? active[0] ?? null;
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
  return rankMaintenanceForecasts(currentHomeMaintenance(records.filter(record => !isPlannedService(record, localDate(today, timezone)))).flatMap(maintenanceTargets), currentKm, dailyKm, timezone, today);
}

export function vehicleCareScore(
  documents: ReadonlyArray<{ status: { days: number | null } }>,
  maintenance: ReadonlyArray<{ status: { state: string } }>,
) {
  const dated = documents.filter(record => record.status.days != null);
  const scheduled = maintenance.filter(item => item.status.state !== 'unscheduled');
  const total = dated.length + scheduled.length;
  const valid = dated.filter(record => (record.status.days ?? 0) > 30).length
    + scheduled.filter(item => item.status.state === 'valid').length;
  return { total, valid, percent: total ? Math.round(valid / total * 100) : null };
}
