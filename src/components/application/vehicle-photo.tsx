'use client';
import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { useApplicationLanguage } from '../application-locale';
/** Keep uploaded owner photos; use a graphic identity when none exists. */
export default function VehiclePhoto({
  vehicleId,
  name,
  uploaded = false,
  preview = false,
  priority = false,
  illustration = false,
}: {
  vehicleId: string;
  name: string;
  uploaded?: boolean;
  preview?: boolean;
  priority?: boolean;
  illustration?: boolean;
}) {
  const language = useApplicationLanguage();
  const [failed, setFailed] = useState('');
  const original =
    uploaded && !preview ? '/api/v1/vehicles/' + encodeURIComponent(vehicleId) + '/photo' : '';
  const owned = original && failed !== original;
  return (
    <div className="studio-vehicle-photo">
      {owned ? (
        <img
          src={original}
          alt={(language === 'en' ? 'Vehicle photo: ' : 'Fotografia mașinii ') + name}
          width={1200}
          height={675}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          onError={() => {
            if (original) setFailed(original);
          }}
        />
      ) : illustration ? (
        <div className="studio-vehicle-illustration">
          <Image src="/images/autocare-studio-coupe.webp" alt="" fill sizes="(max-width: 760px) 100vw, 55vw" loading={priority ? 'eager' : 'lazy'} />
          <span className="ac-illustrative-photo">{language === 'en' ? 'Illustration' : 'Imagine ilustrativă'}</span>
        </div>
      ) : (
        <div className="studio-brand-emblem" aria-label="Garaj digital AutoCare">
          <ShieldCheck size={64} strokeWidth={1.25} />
          <span>AUTOCARE</span>
        </div>
      )}
    </div>
  );
}
