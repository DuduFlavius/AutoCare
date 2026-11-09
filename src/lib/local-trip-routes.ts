import type { GPSFix } from './gps-tracking';

type RouteArchive = Record<string, GPSFix[]>;
type LocalRoute = { ownerId: string; id: string; points: GPSFix[] };
const archiveKey = (ownerId: string) => 'autocare-gps-routes-v1:' + ownerId;
const storeName = 'routes';

function readLegacyRoutes(ownerId: string): RouteArchive {
  try {
    const archive = JSON.parse(localStorage.getItem(archiveKey(ownerId)) ?? '{}');
    return archive && typeof archive === 'object' && !Array.isArray(archive) ? archive : {};
  } catch {
    return {};
  }
}

async function routeTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => T,
  result: (request: T) => GPSFix[] | undefined = () => undefined,
) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('autocare-trip-geometry', 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(storeName, { keyPath: ['ownerId', 'id'] });
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise<GPSFix[] | undefined>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const request = action(transaction.objectStore(storeName));
      transaction.oncomplete = () => resolve(result(request));
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}

export async function readTripRoute(ownerId: string, id: string) {
  try {
    const points = await routeTransaction(
      'readonly',
      (store) => store.get([ownerId, id]) as IDBRequest<LocalRoute | undefined>,
      (request) => request.result?.points,
    );
    if (points) return points;
  } catch {
    // Older browsers or restricted storage can still read the previous archive.
  }
  return readLegacyRoutes(ownerId)[id];
}

/** Coordinates stay on the recording device and never travel with the odometer update. */
export async function storeTripRoutes(ownerId: string, trips: { id: string; points: GPSFix[] }[]) {
  const routes = trips
    .filter((trip) => trip.points.length > 1)
    .map(({ id, points }) => ({
      ownerId,
      id,
      points: points.slice(-1500),
    }));
  if (!routes.length) return;
  try {
    await routeTransaction('readwrite', (store) => routes.forEach((route) => store.put(route)));
  } catch {
    try {
      const archive = new Map(Object.entries(readLegacyRoutes(ownerId)));
      for (const { id, points } of routes) {
        archive.delete(id);
        archive.set(id, points);
      }
      localStorage.setItem(
        archiveKey(ownerId),
        JSON.stringify(Object.fromEntries([...archive].slice(-20))),
      );
    } catch {
      // Storage restrictions must not block trip synchronization.
    }
  }
}

export async function clearTripRoutes(ownerId: string) {
  localStorage.removeItem(archiveKey(ownerId));
  if (typeof indexedDB !== 'undefined') {
    await routeTransaction('readwrite', (store) =>
      store.delete(IDBKeyRange.bound([ownerId, ''], [ownerId, '\uffff'])),
    );
  }
}
