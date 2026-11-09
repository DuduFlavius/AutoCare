'use client';

import { useEffect, useRef, useState } from 'react';
import { BatteryCharging, CarFront, CircleParking, Fuel, MapPin, Wrench } from 'lucide-react';
import { autoPointCategories, type AutoPoint, type AutoPointCategory, type MapArea } from '@/lib/auto-points';
import { segmentMeters, type GPSFix } from '@/lib/gps-tracking';

const categories = { service: Wrench, fuel: Fuel, parking: CircleParking, tyres: CarFront, charging: BatteryCharging } as const;
type Category = keyof typeof categories;

export default function NearbyDrivePlaces({ area, position, english, onResults, onChoose }: {
  area: MapArea;
  position: GPSFix | null;
  english: boolean;
  onResults: (places: AutoPoint[]) => void;
  onChoose: (point: AutoPoint) => void;
}) {
  const [category, setCategory] = useState<AutoPointCategory | null>(null);
  const [results, setResults] = useState<AutoPoint[] | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const disclosure = useRef<HTMLDetailsElement>(null);
  const request = useRef<AbortController | null>(null);
  const t = (ro: string, en: string) => english ? en : ro;

  useEffect(() => () => request.current?.abort(), []);
  async function search(next: Category) {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const center = position || { ...area, accuracy: 0, timestamp: 0 };
    setCategory(next);
    setPending(true);
    setError(false);
    setResults(null);
    onResults([]);
    try {
      const response = await fetch('/api/v1/smartdrive/auto-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: next, latitude: center.latitude, longitude: center.longitude }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Search unavailable');
      const points: AutoPoint[] = await response.json();
      if (controller.signal.aborted) return;
      const distance = (point: AutoPoint) => segmentMeters(center, { ...point, accuracy: 0, timestamp: 0 });
      points.sort((a, b) => distance(a) - distance(b));
      setResults(points);
      if (disclosure.current?.open) onResults(points);
    } catch {
      if (!controller.signal.aborted) setError(true);
    } finally {
      if (!controller.signal.aborted) setPending(false);
    }
  }

  return (
    <details ref={disclosure} className="ac-nearby-places" onToggle={event => onResults(event.currentTarget.open ? results || [] : [])}>
      <summary><MapPin size={17}/>{t('Locuri în apropiere', 'Nearby places')}</summary>
      <div className="ac-nearby-categories">{(Object.keys(categories) as Category[]).map(key => {
        const Icon = categories[key];
        const labels = autoPointCategories[key];
        return <button key={key} type="button" aria-pressed={category === key} onClick={() => void search(key)}><Icon size={17}/>{english ? labels.english : labels.label}</button>;
      })}</div>
      {pending && <p role="status">{t('Se caută locuri…', 'Finding nearby places…')}</p>}
      {error && <p role="alert">{t('Căutarea este indisponibilă momentan.', 'Search is currently unavailable.')}</p>}
      {results?.length === 0 && <p role="status">{t('Niciun rezultat în zona căutată.', 'No results in the search area.')}</p>}
      {!!results?.length && <ul>{results.map(point => <li key={point.id}><button type="button" onClick={() => onChoose(point)}>
        <MapPin size={16}/><span data-user-content>{point.name || (english ? autoPointCategories[point.category].english : autoPointCategories[point.category].label)}</span>
      </button></li>)}</ul>}
    </details>
  );
}
