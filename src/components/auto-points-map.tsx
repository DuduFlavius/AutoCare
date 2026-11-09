'use client';

import dynamic from 'next/dynamic';
import { ArrowUp, Crosshair, Droplets, Fuel, LocateFixed, MapPin, Navigation, ParkingCircle, Phone, Search, Wrench, Zap } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { autoPointCategories, defaultAutoPointsArea, type AutoPoint, type AutoPointCategory, type MapArea } from '@/lib/auto-points';
import { browserGPSFix, latestGPSFix, segmentMeters, type GPSFix } from '@/lib/gps-tracking';
import { navigationProgress, type Coordinate, type DrivingRoute, type Turn } from '@/lib/road-navigation';
import MapStage from './map-stage';
import DriveDestinationSearch from './drive-destination-search';
import { mapGPSOptions, mapLocationError, useMapLocation } from './use-map-location';
import { useApplicationLocale } from './application-locale';

const RoadMap = dynamic(() => import('./road-map'), { ssr: false });
const icons = { service: Wrench, fuel: Fuel, parking: ParkingCircle, charging: Zap, tyres: LocateFixed, wash: Droplets, parts: Wrench };
const noRoute: GPSFix[] = [];
const asFix = (point: Coordinate): GPSFix => ({ ...point, accuracy: 0, timestamp: 0 });
const googleDirections = (point: Coordinate) =>
  `https://www.google.com/maps/dir/?api=1&travelmode=driving&dir_action=navigate&destination=${point.latitude},${point.longitude}`;

function turnText(turn: Turn, english: boolean) {
  const left = turn.modifier?.includes('left');
  if (turn.type === 'arrive') return english ? 'Arrive at destination' : 'Ajungi la destinație';
  if (turn.exit) return english ? `Roundabout · exit ${turn.exit}` : `Sens giratoriu · ieșirea ${turn.exit}`;
  if (turn.modifier === 'uturn') return english ? 'Make a U-turn' : 'Întoarce';
  if (turn.modifier && turn.modifier !== 'straight') {
    const keep = ['fork', 'merge', 'on ramp', 'off ramp'].includes(turn.type);
    return english ? `${keep ? 'Keep' : 'Turn'} ${left ? 'left' : 'right'}`
      : `${keep ? 'Ține' : 'Virează'} ${left ? 'stânga' : 'dreapta'}`;
  }
  return english ? 'Continue straight' : 'Continuă înainte';
}

export default function AutoPointsMap({ preview, visible }: { preview: boolean; visible: boolean }) {
  const locale = useApplicationLocale();
  const english = locale.startsWith('en');
  const t = (ro: string, en: string) => english ? en : ro;
  const [area, setArea] = useState<MapArea>(defaultAutoPointsArea);
  const location = useMapLocation(visible && !preview, english);
  const [oneShotPosition, setOneShotPosition] = useState<GPSFix | null>(null);
  const position = latestGPSFix(location.position, oneShotPosition);
  const [category, setCategory] = useState<AutoPointCategory>('service');
  const [results, setResults] = useState<AutoPoint[] | null>(null);
  const [searchCenter, setSearchCenter] = useState<Coordinate>(defaultAutoPointsArea);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [findingLocation, setFindingLocation] = useState(false);
  const [error, setError] = useState('');
  const [destination, setDestination] = useState<(Coordinate & { name?: string; details?: string }) | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [routes, setRoutes] = useState<DrivingRoute[]>([]);
  const [alternative, setAlternative] = useState(0);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [navigating, setNavigating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const routingRequest = useRef<AbortController | null>(null);
  const routeCard = useRef<HTMLElement>(null);
  const placeCard = useRef<HTMLElement>(null);
  const destinationRevision = useRef(0);
  const locationRevision = useRef(0);
  const lastReroute = useRef(0);
  const deviation = useRef(0);
  const distance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km` : `${Math.round(meters)} m`;

  useEffect(() => () => { ++locationRevision.current; pending.current?.abort(); routingRequest.current?.abort(); }, []);
  useEffect(() => { if (destination) routeCard.current?.scrollIntoView({ block: 'nearest' }); }, [destination]);
  useEffect(() => { if (selected) placeCard.current?.scrollIntoView({ block: 'nearest' }); }, [selected]);
  function locate(after: (fix: GPSFix) => void) {
    if (preview) return;
    const revision = ++locationRevision.current;
    setFindingLocation(false);
    if (!navigator.geolocation) {
      setLocationError(mapLocationError(0, english));
      return;
    }
    if (position && position.accuracy <= 500 && Date.now() - position.timestamp < 10000) {
      setLocationError('');
      after(position);
      return;
    }
    setLocationError('');
    setFindingLocation(true);
    navigator.geolocation.getCurrentPosition(value => {
      if (revision !== locationRevision.current) return;
      setFindingLocation(false);
      const next = browserGPSFix(value);
      if (!next) { setLocationError(mapLocationError(0, english)); return; }
      setOneShotPosition(next);
      setLocationError('');
      location.locate();
      after(next);
    }, failure => {
      if (revision !== locationRevision.current) return;
      setFindingLocation(false);
      setLocationError(mapLocationError(failure.code, english));
    }, mapGPSOptions);
  }

  async function search(center: Coordinate, kind: AutoPointCategory, nearest = false) {
    if (preview) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError('');
    setResults(null);
    setSelected('');
    setCategory(kind);
    setSearchCenter(center);
    try {
      const { latitude, longitude } = center;
      const response = await fetch('/api/v1/smartdrive/auto-points', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ latitude, longitude, category: kind }), signal: controller.signal,
      });
      if (!response.ok) throw new Error('Points unavailable');
      const points: AutoPoint[] = await response.json();
      if (controller.signal.aborted) return;
      const meters = (point: Coordinate) => segmentMeters(asFix(center), asFix(point));
      points.sort((a, b) => meters(a) - meters(b));
      setResults(points);
      if (nearest && points.length) setSelected(points[0].id);
    } catch {
      if (!controller.signal.aborted) setError(t('Furnizorul de puncte auto este indisponibil. Reîncearcă.', 'The auto points provider is unavailable. Try again.'));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function plan(start: GPSFix, end: Coordinate, startGuidance = false) {
    if (start.accuracy > 500 || Date.now() - start.timestamp > 20000) {
      setRouteError(t('Așteaptă o poziție GPS recentă și mai precisă.', 'Wait for a recent, more accurate GPS position.'));
      return;
    }
    routingRequest.current?.abort();
    const controller = new AbortController();
    routingRequest.current = controller;
    setRouting(true);
    setRouteError('');
    try {
      const response = await fetch('/api/v1/smartdrive/directions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start, end, startAccuracy: Math.round(start.accuracy) }), signal: controller.signal,
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'Routing unavailable');
      if (controller.signal.aborted) return;
      setRoutes(value);
      setAlternative(0);
      setStepIndex(0);
      deviation.current = 0;
      if (startGuidance) {
        setNavigating(true);
        lastReroute.current = Date.now();
        location.locate();
      }
    } catch (failure) {
      if (!controller.signal.aborted) setRouteError(failure instanceof Error ? failure.message : t('Traseul nu este disponibil.', 'Route unavailable.'));
    } finally {
      if (!controller.signal.aborted) setRouting(false);
    }
  }

  function choose(point: Coordinate & { name?: string; details?: string }, startGuidance = false) {
    const revision = ++destinationRevision.current;
    routingRequest.current?.abort();
    setRouting(false);
    setSelecting(false);
    setNavigating(false);
    setDestination(point);
    setRoutes([]);
    setRouteError('');
    setLocationError('');
    setFindingLocation(false);
    ++locationRevision.current;
    if (position && position.accuracy <= 500 && Date.now() - position.timestamp < 10000) void plan(position, point, startGuidance);
    else locate(fix => { if (revision === destinationRevision.current) void plan(fix, point, startGuidance); });

  }

  const route = routes[alternative];
  const routeStart = route?.geometry.coordinates[0];
  const precisePosition = position && position.accuracy <= 50 && Date.now() - position.timestamp <= 15000 ? position : null;
  const progress = navigating && route && precisePosition ? navigationProgress(route, precisePosition, stepIndex) : null;
  useEffect(() => {
    if (!navigating || !route || !position || !destination || position.accuracy > 50 || Date.now() - position.timestamp > 15000) return;
    const next = navigationProgress(route, position, stepIndex);
    if (next.gap < 40 && next.index > stepIndex) setStepIndex(next.index);
    deviation.current = next.gap > Math.max(65, position.accuracy * 2) ? deviation.current + 1 : 0;
    if (deviation.current >= 3 && Date.now() - lastReroute.current > 30000) {
      lastReroute.current = Date.now();
      deviation.current = 0;
      void plan(position, destination);
    }
    // Only a new GPS reading can confirm a deviation.
  }, [position, navigating, route, destination]);

  const point = results?.find(item => item.id === selected);
  const pointLabel = (item: AutoPoint) => item.name || (english ? autoPointCategories[item.category].english : autoPointCategories[item.category].label);
  const arrived = !!progress && progress.distance < 35 && progress.gap < 30;
  return (
    <section className="ac-auto-points" aria-label="AutoCare Maps">
      <header><div><span className="eyebrow">AUTOCARE MAPS</span><h3>{t('Navigație și puncte auto', 'Navigation and auto points')}</h3></div></header>
      <MapStage title={navigating ? t('Ghidare AutoCare', 'AutoCare guidance') : 'AutoCare Maps'} english={english}>
        {!navigating && <DriveDestinationSearch area={area} disabled={preview} english={english} onChoose={point => choose(point)}/>}
        {navigating && progress && <div className="ac-next-turn">
                <ArrowUp size={24} style={{ rotate: progress.next?.maneuver.modifier?.includes('left') ? '-90deg' : progress.next?.maneuver.modifier?.includes('right') ? '90deg' : undefined }}/>
                <div><strong>{arrived ? t('Ai ajuns', 'You arrived') : progress.next ? turnText(progress.next.maneuver, english) : t('Continuă către destinație', 'Continue to destination')}</strong>
                {progress.next && !arrived && <small>{distance(progress.untilTurn)}{progress.next.name ? ` · ${progress.next.name}` : ''}</small>}</div>
                <small>{distance(progress.distance)} · {Math.ceil(progress.seconds / 60)} min · ETA {new Date(Date.now() + progress.seconds * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small>
              </div>}
        {!navigating && <><div className="ac-navigation-tools">
          <button type="button" disabled={preview || busy || findingLocation} onClick={() => locate(fix => void search(fix, 'service', true))}><Wrench size={17}/>{t('Cel mai apropiat service', 'Nearest repair shop')}</button>
          <button type="button" disabled={preview} aria-pressed={selecting} onClick={() => setSelecting(!selecting)}><MapPin size={17}/>{t('Alege destinația pe hartă', 'Pick destination on map')}</button>
        </div>
        <div className="ac-auto-point-categories" role="group" aria-label={t('Categorii', 'Categories')}>
          {(Object.keys(autoPointCategories) as AutoPointCategory[]).map(key => {
            const Icon = icons[key];
            const meta = autoPointCategories[key];
            return <button key={key} type="button" aria-pressed={category === key} disabled={preview || busy || (!position && area.zoom < 11)}
              onClick={() => { if (position) void search(position, key); else if (area.zoom >= 11) void search(area, key); }}>
              <Icon size={17}/>{english ? meta.english : meta.label}
            </button>;
          })}
        </div>
        </>}
        {destination && <section ref={routeCard} className="ac-navigation-card ac-navigation-destination" aria-label={t('Navigație', 'Navigation')}>
          <span className="eyebrow">{t('DESTINAȚIE', 'DESTINATION')}</span>
          <div className="ac-journey-stops">
            <div><span>{t('Plecare', 'Start')}</span><strong>{t('Poziția ta GPS', 'Your GPS location')}</strong></div>
            <div><span>{t('Sosire', 'Destination')}</span><strong data-user-content>{destination.name || t('Punctul ales pe hartă', 'Point picked on map')}</strong>
            {destination.details && <small data-user-content>{destination.details}</small>}</div>
          </div>
          {findingLocation && <p role="status">{t('Se caută poziția GPS…', 'Finding GPS position…')}</p>}
          {(routeError || locationError) && <p className="ac-navigation-alert" role="alert">{routeError || locationError}</p>}
          {navigating && !progress && !routing && <p role="status">{t('Traseul este afișat. Indicațiile live pornesc când GPS-ul are o poziție mai precisă.', 'Route shown. Live guidance resumes once GPS has a more accurate fix.')}</p>}
          {routing && <p role="status">{navigating ? t('Se recalculează traseul…', 'Recalculating…') : t('Se calculează traseul…', 'Calculating route…')}</p>}
          {route && <>
            <label>{t('Traseu', 'Route')}<select value={alternative} onChange={event => { setAlternative(Number(event.target.value)); setStepIndex(0); deviation.current = 0; lastReroute.current = Date.now(); }}>
              {routes.map((option, index) => <option key={index} value={index}>{index + 1} · {distance(option.distance)} · {Math.ceil(option.duration / 60)} min</option>)}
            </select></label>
            {!navigating && <button type="button" className="primary" onClick={() => { setNavigating(true); location.locate(); lastReroute.current = Date.now(); }}><Navigation size={16}/>{t('Navighează aici', 'Navigate here')}</button>}
          </>}
          <div className="ac-navigation-tools">
            {navigating ? <button type="button" onClick={() => { setNavigating(false); setStepIndex(0); }}>{t('Oprește ghidarea', 'Stop guidance')}</button>
              : !route && !routing && !findingLocation && <button type="button" onClick={() => choose(destination, true)}>{t('Calculează traseul', 'Calculate route')}</button>}
            <a href={googleDirections(destination)} target="_blank" rel="noreferrer">{t('Deschide în Google Maps', 'Open in Google Maps')} ↗</a>
          </div>
          <small>{t('Estimare rutieră fără trafic live.', 'Road estimate without live traffic.')}</small>
          <button type="button" onClick={() => { ++destinationRevision.current; ++locationRevision.current; routingRequest.current?.abort(); setFindingLocation(false); setRouting(false); setNavigating(false); setRoutes([]); setDestination(null); setRouteError(''); setLocationError(''); }}>{t('Șterge destinația', 'Clear destination')}</button>
        </section>}
        <div className={navigating ? "ac-auto-points-layout is-guiding" : "ac-auto-points-layout"}>
          <div className={selecting ? 'ac-map-selecting' : undefined}>
            <RoadMap points={noRoute} position={position} active={navigating} english={english}
              initialArea={defaultAutoPointsArea} onAreaChange={setArea} onLocate={preview ? undefined : location.locate}
              locating={location.waiting} locationError={location.error}
              autoPoints={results ?? undefined} onAutoPoint={setSelected}
              plannedRoute={route?.geometry.coordinates} destination={destination} routeStart={routeStart} onDestination={selecting ? choose : undefined}/>
            {!navigating && <div className="ac-drive-map-footer">
              <span><Crosshair size={16}/>{selecting ? t('Atinge harta pentru destinație', 'Tap the map for your destination') : t('Rază aprox. 4 km · OpenStreetMap', 'Approx. 4 km radius · OpenStreetMap')}</span>
              <button type="button" onClick={() => void search(area, category)} disabled={busy || preview || area.zoom < 11}><Search size={17}/>{t('Caută în zona hărții', 'Search this map area')}</button>
            </div>}
          </div>
          {!navigating && <aside aria-label={t('Puncte auto în apropiere', 'Nearby auto points')}>
            <p className="small muted" role="status">{(!destination && (locationError || (findingLocation && t('Se caută poziția GPS…', 'Finding GPS position…')))) || error || (busy ? t('Se caută…', 'Searching…') : results
              ? results.length + t(' rezultate · distanțe în linie dreaptă', ' results · straight-line distances')
              : t('Alege o categorie sau caută pe hartă.', 'Choose a category or search the map.'))}</p>
            {point && <section ref={placeCard} className="ac-navigation-card">
              <strong>{pointLabel(point)}</strong>
              {point.address && <span>{point.address}</span>}
              {point.hours && <span>{t('Program', 'Hours')} · {point.hours}</span>}
              <div className="ac-navigation-tools">
                <button type="button" className="primary" onClick={() => choose({ ...point, name: pointLabel(point) }, true)}><Navigation size={16}/>{t('Navighează', 'Navigate')}</button>
                <a href={googleDirections(point)} target="_blank" rel="noreferrer">Google Maps ↗</a>
                {point.phone && <a href={'tel:' + point.phone.replace(/[^+\d]/g, '')}><Phone size={16}/>{t('Sună', 'Call')}</a>}
                <a href={'https://www.openstreetmap.org/' + point.id} target="_blank" rel="noreferrer">{t('Detalii pe hartă', 'Map details')} ↗</a>
              </div>
            </section>}
            <ul aria-label={t('Rezultate din apropiere', 'Nearby results')}>
              {results?.map(item => <li key={item.id}><button type="button" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
                <MapPin size={15}/><span data-user-content>{pointLabel(item)}</span><small>{distance(segmentMeters(asFix(searchCenter), asFix(item)))}</small>
              </button></li>)}
            </ul>
          </aside>}
        </div>
      </MapStage>
    </section>
  );
}
