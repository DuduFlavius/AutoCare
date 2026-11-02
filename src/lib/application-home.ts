import { maintenanceTargets, rankMaintenanceForecasts, type MaintenanceSource } from './maintenance-schedule';
export function selectActiveVehicle<T extends { id: string; archived: boolean }>(vehicles: T[], selected: string) {
  const active = vehicles.filter(v => !v.archived);
  return active.find(v => v.id === selected) ?? active[0] ?? null;
}
export function upcomingMaintenance(records: Array<MaintenanceSource & { kind: string; cancelled: boolean }>, currentKm: number, dailyKm: number | null, timezone: string, today = new Date()) {
  return rankMaintenanceForecasts(records.filter(r => r.kind === 'service' && !r.cancelled).flatMap(maintenanceTargets), currentKm, dailyKm, timezone, today);
}
