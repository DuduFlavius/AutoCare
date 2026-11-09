'use client';

import dynamic from 'next/dynamic';
import { Crosshair, Fuel, MapPin, ParkingCircle, Search, Wrench, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  autoPointCategories,
  defaultAutoPointsArea,
  type AutoPoint,
  type AutoPointCategory,
} from '@/lib/auto-points';
import { segmentMeters, type GPSFix } from '@/lib/gps-tracking';
import MapStage from './map-stage';
import { useApplicationLocale } from './application-locale';

const RoadMap = dynamic(() => import('./road-map'), { ssr: false });
const icons = { service: Wrench, fuel: Fuel, parking: ParkingCircle, charging: Zap };
const noRoute: GPSFix[] = [];

export default function AutoPointsMap({ preview }: { preview: boolean }) {
  const locale = useApplicationLocale();
  const english = locale.startsWith('en');
  const t = (ro: string, en: string) => (english ? en : ro);
  const [initialArea, setInitialArea] = useState(defaultAutoPointsArea);
  const [area, setArea] = useState(defaultAutoPointsArea);
  const [category, setCategory] = useState<AutoPointCategory>('service');
  const [results, setResults] = useState<AutoPoint[] | null>(null);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);

  async function search() {
    if (area.zoom < 11 || preview || busy) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError('');
    setResults(null);
    setSelected('');
    try {
      const { latitude, longitude } = area;
      const response = await fetch('/api/v1/smartdrive/auto-points', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, category }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Points unavailable');
      const points: AutoPoint[] = await response.json();
      const center = { latitude, longitude, accuracy: 0, timestamp: 0 };
      const distance = (point: AutoPoint) =>
        segmentMeters(center, { ...point, accuracy: 0, timestamp: 0 });
      setResults(points.sort((a, b) => distance(a) - distance(b)));
    } catch {
      if (!controller.signal.aborted)
        setError(
          t(
            'Furnizorul de puncte auto nu răspunde momentan. Reîncearcă.',
            'The auto points provider is temporarily unavailable. Try again.',
          ),
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setError(
        t(
          'Localizarea nu este disponibilă pe acest dispozitiv.',
          'Location is unavailable on this device.',
        ),
      );
      return;
    }
    setLocating(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { latitude: coords.latitude, longitude: coords.longitude, zoom: 14 };
        setArea(next);
        setInitialArea(next);
        setResults(null);
        setSelected('');
        setLocating(false);
      },
      () => {
        setLocating(false);
        setError(
          t(
            'Poziția nu este disponibilă. Poți muta harta manual.',
            'Location is unavailable. You can move the map manually.',
          ),
        );
      },
      { maximumAge: 30000, timeout: 10000 },
    );
  }

  const point = results?.find((item) => item.id === selected);
  return (
    <section className="ac-auto-points" aria-label="AutoCare Maps">
      <header>
        <div>
          <span className="eyebrow">AUTOCARE MAPS</span>
          <h3>{t('Puncte auto în zona aleasă', 'Auto points in your area')}</h3>
        </div>
      </header>
      <MapStage title="AutoCare Maps" english={english}>
        <button
          className="ac-auto-point-location"
          type="button"
          onClick={locate}
          disabled={locating || busy || preview}
        >
          <Crosshair size={17} />
          {t('Poziția mea', 'My location')}
        </button>
        <div
          className="ac-auto-point-categories"
          role="group"
          aria-label={t('Categorii', 'Categories')}
        >
          {(Object.keys(autoPointCategories) as AutoPointCategory[]).map((key) => {
            const Icon = icons[key];
            const meta = autoPointCategories[key];
            return (
              <button
                key={key}
                type="button"
                aria-pressed={category === key}
                disabled={busy}
                onClick={() => {
                  if (key !== category) {
                    setCategory(key);
                    setResults(null);
                    setSelected('');
                  }
                }}
              >
                <Icon size={17} />
                {english ? meta.english : meta.label}
              </button>
            );
          })}
        </div>
        <div className="ac-auto-points-layout">
          <div>
            <RoadMap
              points={noRoute}
              active={false}
              english={english}
              initialArea={initialArea}
              key={initialArea.latitude + ':' + initialArea.longitude}
              onAreaChange={setArea}
              autoPoints={results ?? undefined}
              onAutoPoint={setSelected}
            />
            <div className="ac-drive-map-footer">
              <span>
                <MapPin size={16} />
                {t(
                  'Rază de căutare aprox. 4 km · OpenStreetMap',
                  'Approx. 4 km search radius · OpenStreetMap',
                )}
              </span>
              <button
                className="primary"
                type="button"
                onClick={() => void search()}
                disabled={busy || locating || preview || area.zoom < 11}
              >
                <Search size={17} />
                {busy
                  ? t('Se caută…', 'Searching…')
                  : t('Caută în zona hărții', 'Search this map area')}
              </button>
            </div>
          </div>
          <aside>
            <p className="small muted" role="status">
              {error ||
                (area.zoom < 11
                  ? t(
                      'Mărește harta pentru a căuta în această zonă.',
                      'Zoom in to search this area.',
                    )
                  : results
                    ? results.length + t(' rezultate găsite', ' results found')
                    : t(
                        'Mută harta în zona dorită și pornește căutarea.',
                        'Move the map to the desired area and start the search.',
                      ))}
            </p>
            {point && (
              <a
                className="button primary"
                href={`https://www.google.com/maps/dir/?api=1&destination=${point.latitude},${point.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                {t('Navighează în Google Maps', 'Navigate in Google Maps')} ↗
              </a>
            )}
            <ul>
              {results?.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selected === item.id}
                    onClick={() => setSelected(item.id)}
                  >
                    <MapPin size={15} />
                    <span data-user-content>
                      {item.name ||
                        (english
                          ? autoPointCategories[item.category].english
                          : autoPointCategories[item.category].label)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </MapStage>
    </section>
  );
}
