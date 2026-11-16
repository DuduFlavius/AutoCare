import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GeolocationPlugin } from '@capacitor/geolocation';
import { watchNativeLocation, locationFailure } from '../src/lib/device-location';

test('APK mapping uses native high-accuracy GPS and cleans up after returning from background', async () => {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  const driver = {} as GeolocationPlugin;
  let precise = false, asks = 0, watches = 0;
  const cleared: string[] = [], errors: number[] = [], fixes: number[] = [];
  driver.checkPermissions = async () => ({ location: precise ? 'granted' : 'denied', coarseLocation: 'granted' });
  driver.requestPermissions = async input => { assert.deepEqual(input?.permissions, ['location']); asks++; return {location: precise ? 'granted' : 'denied', coarseLocation: 'granted'}; };
  driver.watchPosition = async (options, callback) => {
    watches++; assert.equal(options.enableHighAccuracy, true); assert.equal(options.interval, 1000);
    callback({ timestamp: Date.now(), coords: { latitude: 45, longitude: 21, accuracy: 8, altitude: null, altitudeAccuracy: null, heading: null, speed: 0, magneticHeading: null, trueHeading: null, headingAccuracy: null, course: null } });
    return String(watches);
  };
  driver.clearWatch = async ({id}) => { cleared.push(id); };
  const flush = () => new Promise(resolve => setTimeout(resolve, 0));
  let stop = () => {};
  try {
    stop = watchNativeLocation(value => fixes.push(value.coords.accuracy), error => errors.push(error.code), driver);
    await flush(); assert.deepEqual(errors, [1]); assert.equal(watches, 0); assert.equal(asks, 1);
    stop(); precise = true;
    stop = watchNativeLocation(value => fixes.push(value.coords.accuracy), error => errors.push(error.code), driver);
    await flush(); assert.deepEqual(fixes, [8]);
    doc.visibilityState = 'hidden'; doc.dispatchEvent(new Event('visibilitychange')); await flush();
    assert.deepEqual(cleared, ['1']);
    doc.visibilityState = 'visible'; doc.dispatchEvent(new Event('visibilitychange')); await flush();
    assert.equal(watches, 2); stop(); await flush(); assert.deepEqual(cleared, ['1','2']);
    assert.equal(locationFailure({code:'OS-PLUG-GLOC-0010'}).code, 3);
  } finally {
    stop();
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else Reflect.deleteProperty(globalThis, 'document');
  }
});
