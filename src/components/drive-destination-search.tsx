'use client';

import { MapPin, Search } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Coordinate } from '@/lib/road-navigation';

export type DriveDestination = Coordinate & { name: string; details?: string; distanceKm?: number };

export default function DriveDestinationSearch({ area, nearPosition, disabled, english, onChoose }: {
  area: Coordinate;
  nearPosition: boolean;
  disabled: boolean;
  english: boolean;
  onChoose: (point: DriveDestination) => void;
}) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<DriveDestination[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();
  const searchArea = useRef(area);
  searchArea.current = area;
  const lastQuery = useRef('');
  const pending = useRef<AbortController | null>(null);
  const t = (ro: string, en: string) => english ? en : ro;
  const distance = new Intl.NumberFormat(english ? 'en' : 'ro', { maximumFractionDigits: 1 });

  useEffect(() => () => pending.current?.abort(), []);

  const search = useCallback(async (text: string) => {
    if (text.length < 3 || disabled || lastQuery.current === text) return;
    lastQuery.current = text;
    const area = searchArea.current;
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
      const results = await response.json();
      if (!controller.signal.aborted) setMatches(results);
    } catch {
      if (!controller.signal.aborted) setError(english ? 'Could not search the address. Retry or choose a point on the map.' : 'Nu am putut căuta adresa. Reîncearcă sau alege un punct pe hartă.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [disabled, english]);

  useEffect(() => {
    if (disabled || query.trim().length < 3) return;
    const timer = window.setTimeout(() => void search(query.trim()), 650);
    return () => window.clearTimeout(timer);
  }, [query, disabled, search]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    lastQuery.current = '';
    void search(query.trim());
  }

  return (
    <section className="ac-destination-search" aria-label={t('Caută destinația', 'Search destination')}>
      <form onSubmit={submit}>
        <label htmlFor={inputId}>{t('Unde vrei să mergi?', 'Where are you going?')}</label>
        <div className="ac-destination-search-row">
          <Search className="ac-destination-search-icon" size={20} aria-hidden="true"/>
          <input id={inputId} type="search" placeholder={t('Unde vrei să mergi?', 'Where are you going?')} value={query}
            maxLength={160} disabled={disabled} autoComplete="off"
            onChange={event => { pending.current?.abort(); lastQuery.current = ''; setQuery(event.target.value); setMatches(null); setLoading(false); setError(''); }}/>
          <button type="submit" className="primary" disabled={disabled || loading || query.trim().length < 3}><Search size={17}/>{t('Caută', 'Search')}</button>
        </div>
      </form>
      {loading && <p role="status">{t('Caut destinația…', 'Finding your destination…')}</p>}
      {error && <p role="alert">{error}</p>}
      {matches?.length === 0 && <p role="status">{t('Nicio adresă găsită. Adaugă orașul sau alege pe hartă.', 'No address found. Add the city or select a point on the map.')}</p>}
      {!!matches?.length && <ul aria-label={t('Destinații găsite', 'Matching destinations')}>
        {matches.map((point, index) => <li key={`${point.latitude}:${point.longitude}:${index}`}>
          <button type="button" onClick={() => { setMatches(null); setQuery(''); lastQuery.current = ''; onChoose(point); }}>
            <MapPin size={18}/><span data-user-content><strong>{point.name}</strong>{point.details&&<small>{point.details}</small>}{nearPosition&&point.distanceKm!=null&&<small>{distance.format(point.distanceKm)} {t('km în linie dreaptă', 'km away in a straight line')}</small>}</span>
          </button>
        </li>)}
      </ul>}
    </section>
  );
}
