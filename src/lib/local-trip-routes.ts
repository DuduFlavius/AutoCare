import type { GPSFix } from './gps-tracking';

type RouteArchive = Record<string, GPSFix[]>;
const archiveKey = (ownerId: string) => 'autocare-gps-routes-v1:' + ownerId;

export function readTripRoutes(ownerId: string): RouteArchive {
  try {
    const archive = JSON.parse(localStorage.getItem(archiveKey(ownerId)) ?? '{}');
    return archive && typeof archive === 'object' && !Array.isArray(archive) ? archive : {};
  } catch {
    return {};
  }
}

/** Coordinates stay on the recording device and never travel with the odometer update. */
export function storeTripRoutes(ownerId: string, trips: { id: string; points: GPSFix[] }[]) {
  try {
    const archive = new Map(Object.entries(readTripRoutes(ownerId)));
    for (const { id, points } of trips) {
      if (points.length < 2) continue;
      archive.delete(id);
      archive.set(id, points.slice(-1500));
    }
    localStorage.setItem(archiveKey(ownerId), JSON.stringify(Object.fromEntries([...archive].slice(-20))));
  } catch {
    // Storage restrictions must not block the trip or cause a second odometer update.
  }
}

export function clearTripRoutes(ownerId: string) {
  localStorage.removeItem(archiveKey(ownerId));
}
