import { Capacitor } from '@capacitor/core';
import { Geolocation, type Position, type PositionOptions, type GeolocationPlugin, type PermissionStatus } from '@capacitor/geolocation';
import { watchBrowserLocation } from './browser-location';

export const preciseLocationOptions: PositionOptions = {
  enableHighAccuracy: true, maximumAge: 0, timeout: 30000,
  minimumUpdateInterval: 1000, interval: 1000,
};
const nativeLocation = () => Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('Geolocation');
export function locationFailure(error: unknown): GeolocationPositionError {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  const denied = ['OS-PLUG-GLOC-0003', 'OS-PLUG-GLOC-0008', 'PRECISE_LOCATION_REQUIRED'].includes(code);
  return { code: denied ? 1 : ['OS-PLUG-GLOC-0010','OS-PLUG-GLOC-0011'].includes(code) ? 3 : 2,
    message: error instanceof Error ? error.message : 'Location unavailable', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 };
}
function browserPosition(value: Position): GeolocationPosition {
  const coords = { ...value.coords, altitudeAccuracy: value.coords.altitudeAccuracy ?? null, toJSON: () => value.coords };
  return { coords, timestamp: value.timestamp, toJSON: () => value };
}
let permissionRequest: Promise<PermissionStatus> | undefined;
async function ensurePreciseLocation(driver: GeolocationPlugin = Geolocation) {
  let permissions = await driver.checkPermissions();
  if (permissions.location !== 'granted') {
    const pending = permissionRequest ??= driver.requestPermissions({ permissions: ['location'] });
    try { permissions = await pending; } finally { if (permissionRequest === pending) permissionRequest = undefined; }
  }
  if (permissions.location !== 'granted') throw { code: 'PRECISE_LOCATION_REQUIRED' };
}
export function getDevicePosition(ok: PositionCallback, fail: PositionErrorCallback) {
  if (!nativeLocation()) {
    navigator.geolocation.getCurrentPosition(ok, fail, preciseLocationOptions);
    return;
  }
  void ensurePreciseLocation().then(() => Geolocation.getCurrentPosition(preciseLocationOptions))
    .then(value => ok(browserPosition(value))).catch(error => fail(locationFailure(error)));
}
/** Native fused GPS for APK maps; the existing foreground service still owns trips. */
export function watchDeviceLocation(ok: PositionCallback, fail: PositionErrorCallback) {
  if (!nativeLocation()) return watchBrowserLocation(ok, fail);
  return watchNativeLocation(ok, fail);
}
export function watchNativeLocation(ok: PositionCallback, fail: PositionErrorCallback, driver: GeolocationPlugin = Geolocation) {
  let disposed = false, generation = 0, watch: string | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const clear = () => {
    clearTimeout(retry);
    if (watch) void driver.clearWatch({ id: watch }).catch(() => {});
    watch = undefined;
  };
  const failed = (error: unknown, current: number) => {
    if (disposed || current !== generation) return;
    const failure = locationFailure(error);
    ++generation;
    clear();
    if (failure.code === 1) stop();
    else retry = setTimeout(() => void start(), 2500);
    fail(failure);
  };
  const start = async () => {
    if (disposed) return;
    const current = ++generation;
    clear();
    try {
      await ensurePreciseLocation(driver);
      if (disposed || current !== generation) return;
      const id = await driver.watchPosition(preciseLocationOptions, (value, error) => {
        if (disposed || current !== generation) return;
        if (error) failed(error, current);
        else if (value) ok(browserPosition(value));
      });
      if (disposed || current !== generation) await driver.clearWatch({ id });
      else watch = id;
    } catch (error) { failed(error, current); }
  };
  const foreground = () => {
    if (document.visibilityState === 'visible') void start();
    else { ++generation; clear(); }
  };
  function stop() {
    disposed = true; ++generation; clear();
    document.removeEventListener('visibilitychange', foreground);
  }
  document.addEventListener('visibilitychange', foreground);
  void start();
  return stop;
}
