import { nativeAutomation, nativeTracking, type NativeTrip } from './native-tracking';
import { storeTripRoutes } from './local-trip-routes';
type Car = { id: string; odometer: number };
const locks = new Map<string, Promise<number>>();
export async function syncAutomaticTrips(
  ownerId: string,
  cars: Car[],
  archiveVehicle?: string,
): Promise<number> {
  const previous = locks.get(ownerId);
  if (previous) {
    await previous;
    if (!archiveVehicle) return 0;
  }
  const operation = (async () => {
    const queue = await nativeAutomation.pending(ownerId),
      active = await nativeTracking.snapshot(ownerId);
    const groups = new Map<string, NativeTrip[]>();
    for (const row of queue) {
      if (archiveVehicle && row.vehicleId !== archiveVehicle) continue;
      const values = groups.get(row.vehicleId) || [];
      values.push(row);
      groups.set(row.vehicleId, values);
    }
    let count = 0;
    const confirmedOdometers = new Map(cars.map((car) => [car.id, car.odometer]));
    for (const [id, rows] of groups) {
      if (active?.active && active.vehicleId === id) continue;
      if (!cars.some((c) => c.id === id))
        throw Error(
          'Mașina unui traseu nu mai este activă. Verifică garajul înainte de sincronizare.',
        );
      rows.sort((a, b) => a.startedAt - b.startedAt);
      const response = await fetch(
        '/api/v1/smartdrive/vehicles/' + encodeURIComponent(id) + '/trip-batch',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expectedOdometer: rows[0].baseline,
            syncMileage: !archiveVehicle,
            trips: rows.map((t) => ({
              id: t.id,
              distanceMeters: Math.round(t.distance),
              durationSeconds: Math.max(1, Math.round((t.endedAt! - t.startedAt) / 1000)),
              startedAt: new Date(t.startedAt).toISOString(),
              endedAt: new Date(t.endedAt!).toISOString(),
            })),
          }),
        },
      );
      const value = await response.json();
      if (!response.ok) throw Error(value.error || 'Nu s-au putut sincroniza traseele.');
      if (!Array.isArray(value.ids) || rows.some((t) => !value.ids.includes(t.id)))
        throw Error('Serverul nu a confirmat toate traseele.');
      storeTripRoutes(ownerId, rows);
      await nativeAutomation.acknowledge(ownerId, value.ids);
      if (Number.isSafeInteger(value.odometer)) confirmedOdometers.set(id, value.odometer);
      count += rows.length;
      window.dispatchEvent(
        new CustomEvent('autocare-native-synced', { detail: { ids: value.ids } }),
      );
      window.dispatchEvent(new Event('autocare-trips-updated'));
    }
    // Never rebase a queued or currently recording trip. Both native platforms guard this.
    for (const car of cars)
      await nativeAutomation.updateVehicle(
        ownerId,
        car.id,
        confirmedOdometers.get(car.id) ?? car.odometer,
      );
    return count;
  })();
  locks.set(ownerId, operation);
  try {
    return await operation;
  } finally {
    if (locks.get(ownerId) === operation) locks.delete(ownerId);
  }
}
