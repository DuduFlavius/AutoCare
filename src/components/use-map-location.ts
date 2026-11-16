'use client';

import { useEffect, useState } from 'react';
import { watchBrowserLocation } from '@/lib/browser-location';
import { browserGPSFix, type GPSFix } from '@/lib/gps-tracking';

export const mapGPSOptions: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 30000,
};

export function mapLocationError(code: number, english: boolean) {
  if (code === 1) return english
    ? 'Allow location for AutoCare in your device or browser settings, then tap My location.'
    : 'Permite localizarea precisă pentru AutoCare din setările telefonului și ale browserului, apoi apasă Poziția mea.';
  if (code === 3) return english
    ? 'Still searching for a precise position. Move outdoors; GPS will retry automatically.'
    : 'Se caută o poziție precisă. Ieși într-un loc deschis; GPS-ul reîncearcă automat.';
  return english
    ? 'GPS signal temporarily unavailable. Enable precise location; retrying automatically.'
    : 'Semnal GPS temporar indisponibil. Activează localizarea precisă; se reîncearcă automat.';
}

export function useMapLocation(enabled: boolean, english: boolean) {
  const [position, setPosition] = useState<GPSFix | null>(null);
  const [requested, setRequested] = useState(false);
  const [granted, setGranted] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    if (!enabled || !navigator.permissions) return;
    let live = true;
    let permission: PermissionStatus | undefined;
    const update = () => {
      if (live) setGranted(permission?.state === 'granted');
    };
    void navigator.permissions.query({ name: 'geolocation' }).then(value => {
      if (!live) return;
      permission = value;
      update();
      permission.addEventListener('change', update);
    }).catch(() => { /* The explicit location button works without the Permissions API. */ });
    return () => {
      live = false;
      permission?.removeEventListener('change', update);
    };
  }, [enabled]);

  const shouldWatch = enabled && (requested || granted);
  useEffect(() => {
    if (!shouldWatch || !navigator.geolocation) return;
    let live = true;
    setWaiting(true);
    const stop = watchBrowserLocation(value => {
      if (!live) return;
      const fix = browserGPSFix(value);
      if (!fix || fix.timestamp > Date.now() + 5000 || Date.now() - fix.timestamp > 15000) return;
      setPosition(previous => !previous || Date.now()-previous.timestamp>10000 || (fix.timestamp>=previous.timestamp && fix.accuracy<=previous.accuracy*1.3) ? fix : previous);
      setWaiting(false);
      setError('');
    }, failure => {
      if (!live) return;
      setWaiting(failure.code !== 1);
      setError(mapLocationError(failure.code, english));
      if (failure.code === 1) {
        setGranted(false);
        setRequested(false);
        setPosition(null);
      }
    });
    return () => {
      live = false;
      stop();
    };
  }, [shouldWatch, attempt, english]);

  function locate() {
    if (!enabled) return;
    if (!navigator.geolocation) {
      setError(mapLocationError(0, english));
      return;
    }
    setError('');
    setRequested(true);
    if (shouldWatch) {
      setAttempt(value => value + 1);
    }
  }

  return { position, locate, waiting: enabled && waiting, error };
}
