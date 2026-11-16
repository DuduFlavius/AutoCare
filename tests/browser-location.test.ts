import { test } from 'node:test';
import assert from 'node:assert/strict';
import { watchBrowserLocation } from '../src/lib/browser-location';

test('browser GPS retries transient failures, resumes in foreground, and stops on denial', async () => {
  const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
  const win = new EventTarget();
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: win });
  let failure!: PositionErrorCallback;
  let success!: PositionCallback;
  let calls = 0, received = 0;
  const cleared: number[] = [];
  const geo = {
    watchPosition(ok: PositionCallback, fail: PositionErrorCallback, options: PositionOptions) {
      assert.equal(options.enableHighAccuracy, true);
      assert.equal(options.maximumAge, 0);
      success = ok; failure = fail; return ++calls;
    },
    clearWatch(id: number) { cleared.push(id); },
  } as Geolocation;
  const stop = watchBrowserLocation(() => received++, () => {}, geo);
  try {
    failure({ code: 2 } as GeolocationPositionError);
    await new Promise(resolve => setTimeout(resolve, 2100));
    assert.equal(calls, 2);
    success({} as GeolocationPosition);
    assert.equal(received, 1);
    doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(calls, 3);
    failure({ code: 1 } as GeolocationPositionError);
    doc.dispatchEvent(new Event('visibilitychange'));
    assert.equal(calls, 3);
    success({} as GeolocationPosition);
    assert.equal(received, 1, 'late callbacks after disposal are ignored');
    assert.deepEqual(cleared, [1, 2, 3]);
  } finally {
    stop();
    if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument); else Reflect.deleteProperty(globalThis, 'document');
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow); else Reflect.deleteProperty(globalThis, 'window');
  }
});
