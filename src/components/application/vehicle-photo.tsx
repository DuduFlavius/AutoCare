'use client';
import { useState } from 'react';
/** Owner-uploaded photos take priority; the fallback is explicitly illustrative. */
export default function VehiclePhoto({
  vehicleId,
  name,
  uploaded = false,
  preview = false,
  priority = false,
}: {
  vehicleId: string;
  name: string;
  uploaded?: boolean;
  preview?: boolean;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState('');
  const original =
    uploaded && !preview ? '/api/v1/vehicles/' + encodeURIComponent(vehicleId) + '/photo' : '';
  const owned = original && failed !== original;
  return (
    <div className="studio-vehicle-photo">
      <img
        src={owned ? original : '/images/autocare-studio-coupe.webp'}
        alt={
          owned
            ? 'Fotografia mașinii ' + name
            : 'Imagine auto de prezentare, diferită de mașina din cont'
        }
        width={1200}
        height={675}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
        onError={() => {
          if (original) setFailed(original);
        }}
      />
      {!owned && (
        <span className="studio-photo-caption">
          {preview ? 'Imagine de prezentare' : 'Imagine ilustrativă · poți adăuga fotografia ta'}
        </span>
      )}
    </div>
  );
}
