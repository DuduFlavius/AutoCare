'use client';

import { useEffect, useState } from 'react';
import { browserGPSFix, type GPSFix } from '@/lib/gps-tracking';

export const mapGPSOptions: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 5000,
  timeout: 15000,
};

export function mapLocationError(code: number, english: boolean) {
  if (code === 1) return english
    ? 'Allow location for AutoCare in your device or browser settings, then tap My location.'
    : 'Permite localizarea pentru AutoCare din setările telefonului sau ale browserului, apoi apasă Poziția mea.';
  return english
    ? 'GPS position unavailable. Check that location is on and try again.'
    : 'Poziția GPS nu este disponibilă. Verifică dacă localizarea este pornită și încearcă din nou.';
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
    const watch = navigator.geolocation.watchPosition(value => {
      if (!live) return;
      const fix = browserGPSFix(value);
      if (!fix) return;
      setPosition(previous => !previous || fix.timestamp >= previous.timestamp ? fix : previous);
      setWaiting(false);
      setError('');
    }, failure => {
      if (!live) return;
      setWaiting(false);
      setError(mapLocationError(failure.code, english));
      if (failure.code === 1) {
        setGranted(false);
        setRequested(false);
        setPosition(null);
      }
    }, mapGPSOptions);
    return () => {
      live = false;
      navigator.geolocation.clearWatch(watch);
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
    if (shouldWatch && !waiting && (!position || Date.now() - position.timestamp > 15000 || error)) {
      setAttempt(value => value + 1);
    }
  }

  return { position, locate, waiting: enabled && waiting, error };
}
