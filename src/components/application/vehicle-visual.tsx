'use client';
import { useState } from 'react';
/** Owned photos use the existing authenticated endpoint; the illustration is decorative. */
export default function VehicleVisual({
  vehicleId,
  hasPhoto,
  preview,
}: {
  vehicleId: string;
  hasPhoto: boolean;
  preview: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const personal = hasPhoto && !preview && !failed;
  return (
    <div
      className={'app-vehicle-visual' + (personal ? ' app-vehicle-personal' : '')}
      aria-hidden="true"
    >
      <img
        src={
          personal
            ? '/api/v1/vehicles/' + encodeURIComponent(vehicleId) + '/photo'
            : '/images/autocare-app-premium.webp'
        }
        alt=""
        onError={personal ? () => setFailed(true) : undefined}
        fetchPriority="high"
        decoding="async"
      />
      <span className="app-vehicle-visual-shade" />
    </div>
  );
}
