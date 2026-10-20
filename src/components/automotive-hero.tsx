'use client';
import { useState } from 'react';
import { ArrowUpRight, CarFront, Gauge, Fuel, Plus } from 'lucide-react';

export default function AutomotiveHero({
  name, photo, vehicleName, vehicleYear, vehicleFuel, vehiclePlate, vehicleKm, hasCars, navigate, add,
}: {
  name: string;
  photo?: string;
  vehicleName?: string;
  vehicleYear?: number | string | null;
  vehicleFuel?: string | null;
  vehiclePlate?: string | null;
  vehicleKm?: number | null;
  hasCars: boolean;
  navigate: (tab: string) => void;
  add: (kind: 'vehicle' | 'service') => void;
}) {
  const [failed, setFailed] = useState<string[]>([]);
  const source = photo && !failed.includes(photo) ? photo : '/design-car.jpg';
  const missing = failed.includes(source);
  return (
    <section className="automotive-hero panoramic-hero autocare-car-showcase" aria-label="Mașina selectată">
      <div className="automotive-image autocare-car-image">
        {missing ? (
          <div className="automotive-image-fallback"><CarFront size={90} strokeWidth={0.8} /><span>Garajul tău digital</span></div>
        ) : (
          <img key={source} src={source} alt={photo === source ? 'Fotografia mașinii ' + vehicleName : 'Imagine auto de prezentare'} fetchPriority="high" onError={() => setFailed((v) => v.includes(source) ? v : [...v, source])} />
        )}
      </div>
      <div className="autocare-car-details">
        <span className="autocare-car-year">{[vehicleYear, vehicleFuel].filter(Boolean).join(' · ') || 'MAȘINA TA'}</span>
        <h2>{vehicleName || 'Bine ai venit în garaj'}</h2>
        {vehiclePlate && <span className="autocare-plate"><b>RO</b>{vehiclePlate}</span>}
        {hasCars ? (
          <div className="autocare-car-facts">
            <span><Gauge size={19}/><strong>{typeof vehicleKm === 'number' ? vehicleKm.toLocaleString('ro-RO') : '—'} km</strong><small>Kilometraj</small></span>
            {vehicleFuel && <span><Fuel size={19}/><strong>{vehicleFuel}</strong><small>Combustibil</small></span>}
          </div>
        ) : (
          <button className="primary" onClick={() => add('vehicle')}><Plus size={17}/> Adaugă prima mașină</button>
        )}
        {hasCars && <button className="autocare-car-open" onClick={() => navigate('Garaj')}>Vezi mașina <ArrowUpRight size={16}/></button>}
      </div>
    </section>
  );
}
