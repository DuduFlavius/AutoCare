'use client';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
/** Keep uploaded owner photos; use a graphic identity when none exists. */
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
      {owned ? <img
        src={original}
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
      /> : <div className="studio-vehicle-identity" aria-label="Garaj digital AutoCare"><ShieldCheck size={64} strokeWidth={1.25}/><span>AUTOCARE</span></div>}

    </div>
  );
}
