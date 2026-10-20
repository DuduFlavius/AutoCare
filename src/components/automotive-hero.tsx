'use client';
import { useState } from 'react';
import { ArrowUpRight, Plus, CarFront } from 'lucide-react';
export default function AutomotiveHero({
  name,
  photo,
  vehicleName,
  hasCars,
  navigate,
  add,
}: {
  name: string;
  photo?: string;
  vehicleName?: string;
  hasCars: boolean;
  navigate: (tab: string) => void;
  add: (kind: 'vehicle' | 'service') => void;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = photo && !failed.includes(photo) ? photo : '/design-car.jpg';
  const missing = failed.includes(source);
  return (
    <section className="automotive-hero panoramic-hero" aria-labelledby="automotive-title">
      <div className="automotive-copy">
        <p className="eyebrow">AUTOCARE / GARAJUL TĂU DIGITAL</p>
        <p className="automotive-greeting">Bună, {name.split(' ')[0] || name}.</p>
        <h2 id="automotive-title">
          Grijă pentru mașina ta.
          <br />
          <span>Mai multă liniște la fiecare drum.</span>
        </h2>
        <p className="automotive-description">
          Documente, întreținere și cheltuieli. Toate informațiile importante, organizate simplu
          într-un singur loc.
        </p>
        <div className="automotive-actions">
          <button
            className="primary"
            onClick={() => (hasCars ? navigate('Garaj') : add('vehicle'))}
          >
            {hasCars ? 'Gestionează mașina' : 'Adaugă prima mașină'}
            <ArrowUpRight size={18} />
          </button>
          <button onClick={() => (hasCars ? add('service') : add('vehicle'))}>
            <Plus size={17} />
            {hasCars ? 'Adaugă o operațiune' : 'Începe cu mașina ta'}
          </button>
        </div>
      </div>
      <div className="automotive-image">
        {missing ? (
          <div className="automotive-image-fallback">
            <CarFront size={100} strokeWidth={0.7} />
            <span>Fiecare drum începe cu grijă.</span>
          </div>
        ) : (
          <img
            key={source}
            src={source}
            alt={
              photo === source
                ? 'Fotografia mașinii ' + vehicleName
                : 'Fotografie auto de prezentare'
            }
            fetchPriority="high"
            onError={() =>
              setFailed((current) => (current.includes(source) ? current : [...current, source]))
            }
          />
        )}
        <span className="automotive-caption">
          {photo === source ? vehicleName : 'AUTOCARE · IMAGINE DE PREZENTARE'}
        </span>
      </div>
    </section>
  );
}
