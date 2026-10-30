export type PriorityVehicle = { id: string; odometer: number; archived: boolean };
export type PriorityRecord = {
  id: string;
  vehicleId: string;
  kind: string;
  cancelled: boolean;
  nextKm: number | null;
  status: { days: number | null };
};
/** One action per record, regardless of how many saved thresholds it reaches. */
export function premiumPriorities<T extends PriorityRecord>(
  records: T[],
  vehicles: PriorityVehicle[],
) {
  const active = new Map(vehicles.filter((v) => !v.archived).map((v) => [v.id, v]));
  return records
    .flatMap((record) => {
      const car = active.get(record.vehicleId);
      if (!car || record.cancelled || !['document', 'service'].includes(record.kind)) return [];
      const days = record.status.days;
      const remainingKm =
        record.kind === 'service' && record.nextKm !== null ? record.nextKm - car.odometer : null;
      const calendar = days !== null && Number.isFinite(days) && days <= 30;
      const mileage = remainingKm !== null && Number.isFinite(remainingKm) && remainingKm <= 1000;
      if (!calendar && !mileage) return [];
      return [
        {
          record,
          days: calendar ? days : null,
          remainingKm: mileage ? remainingKm : null,
          overdue: (calendar && days! <= 0) || (mileage && remainingKm! <= 0),
        },
      ];
    })
    .sort(
      (a, b) =>
        Number(b.overdue) - Number(a.overdue) ||
        (a.days ?? Infinity) - (b.days ?? Infinity) ||
        (a.remainingKm ?? Infinity) - (b.remainingKm ?? Infinity),
    );
}
