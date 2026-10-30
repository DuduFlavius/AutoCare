'use client';
import { useEffect, useState } from 'react';
import { recentMileageUsage, type OdometerReading } from '@/lib/smartdrive-metrics';
/** A snapshot belongs to an exact vehicle and odometer value; stale requests cannot update it. */
export function useMileageUsage(vehicleId: string, currentKm: number, preview = false) {
  const [revision, refresh] = useState(0);
  const [manual, setManual] = useState<{ vehicleId: string; dailyKm: number | null } | null>(null);
  useEffect(() => {
    const reload = () => refresh((n) => n + 1);
    window.addEventListener('autocare-daily-usage', reload);
    window.addEventListener('focus', reload);
    return () => { window.removeEventListener('autocare-daily-usage', reload); window.removeEventListener('focus', reload); };
  }, []);
  useEffect(() => {
    if (preview || !vehicleId) return;
    const controller = new AbortController();
    fetch('/api/v1/vehicles/' + encodeURIComponent(vehicleId) + '/daily-usage', { cache: 'no-store', signal: controller.signal })
      .then(async (r) => { if (!r.ok) throw Error('Usage unavailable'); return r.json(); })
      .then((value) => { if (!controller.signal.aborted) setManual({ vehicleId, dailyKm: value.dailyKm }); })
      .catch(() => {});
    return () => controller.abort();
  }, [vehicleId, preview, revision]);
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
  const confirmed = snapshot?.key === key ? snapshot.value : null;
  const manualDailyKm = manual?.vehicleId === vehicleId ? manual.dailyKm : null;
  return {
    manualDailyKm,
    dailyKm: manualDailyKm ?? confirmed?.dailyKm ?? null,
    async saveDailyKm(dailyKm: number | null) {
      if (preview) { setManual({ vehicleId, dailyKm }); return; }
      const response = await fetch('/api/v1/vehicles/' + encodeURIComponent(vehicleId) + '/daily-usage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dailyKm }) });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not save');
      setManual({ vehicleId, dailyKm: result.dailyKm });
      window.dispatchEvent(new Event('autocare-daily-usage'));
    },
    confirmed: snapshot?.key === key ? snapshot.value : null,
    lastReadingAt: snapshot?.key === key ? snapshot.lastReadingAt : null,
    loading: !preview && !!vehicleId && settled !== key,
  };
}
