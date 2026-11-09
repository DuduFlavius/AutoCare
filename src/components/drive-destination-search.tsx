'use client';

import { MapPin, Search } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { Coordinate } from '@/lib/road-navigation';

export type DriveDestination = Coordinate & { name: string; details?: string };

export default function DriveDestinationSearch({ area, disabled, english, onChoose }: {
  area: Coordinate;
  disabled: boolean;
  english: boolean;
  onChoose: (point: DriveDestination) => void;
}) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<DriveDestination[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  const t = (ro: string, en: string) => english ? en : ro;

  useEffect(() => () => pending.current?.abort(), []);

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = query.trim();
    if (text.length < 3 || disabled) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true);
    setError('');
    setMatches(null);
    try {
      const response = await fetch('/api/v1/smartdrive/destinations', {
        method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text, area: { latitude: area.latitude, longitude: area.longitude } }),
      });
      if (!response.ok) throw new Error('Destination search unavailable');
      setMatches(await response.json());
    } catch {
      if (!controller.signal.aborted) setError(t('Nu am putut căuta adresa. Reîncearcă sau alege un punct pe hartă.', 'Could not search the address. Retry or choose a point on the map.'));
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }

  return (
    <section className="ac-destination-search" aria-label={t('Caută destinația', 'Search destination')}>
      <form onSubmit={search}>
        <label htmlFor="ac-destination-address">{t('Unde mergi?', 'Where are you going?')}</label>
        <div className="ac-destination-search-row">
          <input id="ac-destination-address" type="search" placeholder={t('Stradă, număr și oraș', 'Street, number and city')} value={query}
            maxLength={160} disabled={disabled} autoComplete="off"
            onChange={event => { pending.current?.abort(); setQuery(event.target.value); setMatches(null); setLoading(false); setError(''); }}/>
          <button type="submit" className="primary" disabled={disabled || loading || query.trim().length < 3}><Search size={17}/>{t('Caută', 'Search')}</button>
        </div>
      </form>
      {loading && <p role="status">{t('Caut destinația…', 'Finding your destination…')}</p>}
      {error && <p role="alert">{error}</p>}
      {matches?.length === 0 && <p role="status">{t('Nicio adresă găsită. Adaugă orașul sau alege pe hartă.', 'No address found. Add the city or select a point on the map.')}</p>}
      {!!matches?.length && <ul aria-label={t('Destinații găsite', 'Matching destinations')}>
        {matches.map((point, index) => <li key={`${point.latitude}:${point.longitude}:${index}`}>
          <button type="button" onClick={() => { setMatches(null); onChoose(point); }}>
            <MapPin size={18}/><span data-user-content><strong>{point.name}</strong>{point.details && <small>{point.details}</small>}</span>
          </button>
        </li>)}
      </ul>}
    </section>
  );
}
