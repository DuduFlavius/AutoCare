'use client';
import { useEffect, useState } from 'react';
import { recentMileageUsage, type OdometerReading } from '@/lib/smartdrive-metrics';
/** A snapshot belongs to an exact vehicle and odometer value; stale requests cannot update it. */
export function useMileageUsage(vehicleId: string, currentKm: number, preview = false) {
  const key = vehicleId + ':' + currentKm;
  const [snapshot, setSnapshot] = useState<{
    key: string;
    value: ReturnType<typeof recentMileageUsage>;
    lastReadingAt: string | null;
  } | null>(null);
  const [settled, setSettled] = useState('');
  useEffect(() => {
    if (preview || !vehicleId) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    fetch('/api/v1/smartdrive/vehicles/' + encodeURIComponent(vehicleId) + '/readings', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error('Readings unavailable');
        return response.json() as Promise<OdometerReading[]>;
      })
      .then((rows) => {
        if (!cancelled)
          setSnapshot({
            key,
            value: recentMileageUsage(rows, new Date()),
            lastReadingAt:
              rows
                .filter((r) => Number.isFinite(Date.parse(r.recordedAt)))
                .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0]
                ?.recordedAt || null,
          });
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      })
      .finally(() => {
        clearTimeout(timer);
        if (!cancelled) setSettled(key);
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [key, vehicleId, preview]);
  return {
    confirmed: snapshot?.key === key ? snapshot.value : null,
    lastReadingAt: snapshot?.key === key ? snapshot.lastReadingAt : null,
    loading: !preview && !!vehicleId && settled !== key,
  };
}
