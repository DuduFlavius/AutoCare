'use client';
import { useEffect, useRef, useState } from 'react';
import { hasNativeTracking, nativeMethodMissing, nativeTracking, nativeAutomation } from '@/lib/native-tracking';
import { syncAutomaticTrips } from '@/lib/sync-automatic-trips';
export default function NativeTripSync({
  ownerId,
  vehicles,
  onUpdated,
  onReview,
  english,
}: {
  ownerId: string;
  vehicles: { id: string; odometer: number }[];
  onUpdated: () => Promise<unknown>;
  onReview: () => void;
  english: boolean;
}) {
  const latest = useRef({ vehicles, onUpdated });
  latest.current = { vehicles, onUpdated };
  const [error, setError] = useState('');
  useEffect(() => {
    if (!hasNativeTracking()) return;
    document.documentElement.dataset.autocareNativeOwner = ownerId;
    let disposed = false,
      busy = false,
      paused = false,
      unsupported = false;
    async function run() {
      if (disposed || busy || paused || unsupported || document.visibilityState !== 'visible')
        return;
      busy = true;
      document.documentElement.dataset.autocareNativeUpdateSafe = 'false';
      try {
        const count = await syncAutomaticTrips(ownerId, latest.current.vehicles);
        if (!disposed && count) await latest.current.onUpdated();
        const [active, pending] = await Promise.all([nativeTracking.snapshot(ownerId), nativeAutomation.pending(ownerId)]);
        if (!disposed) document.documentElement.dataset.autocareNativeUpdateSafe = !active?.active && pending.length === 0 ? 'true' : 'false';
      } catch (e) {
        if (nativeMethodMissing(e)) unsupported = true;
        else {
          paused = true;
          if (!disposed) setError(e instanceof Error ? e.message : 'GPS sync unavailable');
        }
      } finally {
        busy = false;
      }
    }
    const retry = () => {
      paused = false;
      setError('');
      void run();
    };
    void run();
    const timer = setInterval(() => void run(), 10000);
    document.addEventListener('visibilitychange', retry);
    window.addEventListener('online', retry);
    window.addEventListener('autocare-auto-retry', retry);
    return () => {
      disposed = true;
      delete document.documentElement.dataset.autocareNativeUpdateSafe;
      delete document.documentElement.dataset.autocareNativeOwner;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', retry);
      window.removeEventListener('online', retry);
      window.removeEventListener('autocare-auto-retry', retry);
    };
  }, [ownerId]);
  if (!error) return null;
  return (
    <div className="ac-auto-sync-warning" role="status" data-workspace-ui>
      <span>
        {english
          ? 'Automatic trips need review before mileage sync.'
          : 'Traseele automate necesită verificare înainte de sincronizarea kilometrilor.'}
      </span>
      <button type="button" onClick={onReview}>
        {english ? 'Review trips' : 'Verifică traseele'}
      </button>
    </div>
  );
}
