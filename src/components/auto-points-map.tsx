'use client';
import {FilterSelect} from './filter-select';

import dynamic from 'next/dynamic';
import { ArrowUp, CornerUpLeft, CornerUpRight, Flag, LocateFixed, MapPin, Navigation, RotateCcw, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { defaultAutoPointsArea, type MapArea } from '@/lib/auto-points';
import { browserGPSFix, latestGPSFix, type GPSFix } from '@/lib/gps-tracking';
import { navigationProgress, type Coordinate, type DrivingRoute, type Turn } from '@/lib/road-navigation';
import MapStage from './map-stage';
import { nativeMethodMissing, nativeNavigation } from '@/lib/native-tracking';
import DriveDestinationSearch, { type DriveDestination } from './drive-destination-search';
import { getDevicePosition } from '@/lib/device-location';
import { mapLocationError, useMapLocation } from './use-map-location';
import { useApplicationLocale } from './application-locale';

const RoadMap = dynamic(() => import('./road-map'), { ssr: false });
const noRoute: GPSFix[] = [];
type SavedDestination = DriveDestination & { slot?: 'home' | 'work' };

function loadSavedDestinations(key: string): SavedDestination[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(value)) return [];
    return value.filter(point => point && typeof point.name === 'string'
      && Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 85
      && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180).slice(0, 12);
  } catch {
    return [];
  }
}

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

export default function AutoPointsMap({ preview, visible, ownerId }: { preview: boolean; visible: boolean; ownerId: string }) {
  const locale = useApplicationLocale();
  const english = locale.startsWith('en');
  const t = (ro: string, en: string) => english ? en : ro;
  const [area, setArea] = useState<MapArea>(defaultAutoPointsArea);
  const location = useMapLocation(visible && !preview, english);
  const [oneShotPosition, setOneShotPosition] = useState<GPSFix | null>(null);
  const [nativePosition, setNativePosition] = useState<GPSFix | null>(null);
  const position = latestGPSFix(latestGPSFix(location.position, oneShotPosition), nativePosition);
  const [background, setBackground] = useState<'idle' | 'active' | 'upgrade' | 'blocked'>('idle');
  const wantsNavigation = useRef(false);
  const [locationError, setLocationError] = useState('');
  const [findingLocation, setFindingLocation] = useState(false);
  const [destination, setDestination] = useState<(Coordinate & { name?: string; details?: string }) | null>(null);
  const favoritesKey = 'autocare.drive.favorites.' + ownerId;
  const [favorites, setFavorites] = useState<{ key: string; points: SavedDestination[] }>({ key: '', points: [] });
  const [favoriteError, setFavoriteError] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);
  const saved = favorites.key === favoritesKey ? favorites.points : [];
  useEffect(() => {
    setShowFavorites(false);
    setFavoriteError(false);
    if (!preview && ownerId) setFavorites({ key: favoritesKey, points: loadSavedDestinations(favoritesKey) });
  }, [favoritesKey, ownerId, preview]);

  function updateFavorites(points: SavedDestination[]) {
    if (preview || !ownerId) return;
    try {
      const entries = points.slice(0, 12);
      localStorage.setItem(favoritesKey, JSON.stringify(entries));
      setFavorites({ key: favoritesKey, points: entries });
      setFavoriteError(false);
      setShowFavorites(true);
    } catch {
      setFavoriteError(true);
    }
  }

  function saveDestination(slot?: SavedDestination['slot']) {
    if (!destination) return;
    const name = destination.name || t('Punct salvat pe hartă', 'Saved map point');
    const remaining = saved.filter(point => slot ? point.slot !== slot
      : point.slot || point.latitude !== destination.latitude || point.longitude !== destination.longitude);
    updateFavorites([{ ...destination, name, slot }, ...remaining]);
  }

  const [selecting, setSelecting] = useState(false);
  const [routes, setRoutes] = useState<DrivingRoute[]>([]);
  const [alternative, setAlternative] = useState(0);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [navigating, setNavigating] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const routingRequest = useRef<AbortController | null>(null);
  const routeCard = useRef<HTMLElement>(null);
  const destinationRevision = useRef(0);
  const locationRevision = useRef(0);
  const lastReroute = useRef(0);
  const deviation = useRef(0);
  const distance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km` : `${Math.round(meters)} m`;

  useEffect(() => () => {
    wantsNavigation.current = false;
    ++locationRevision.current;
    routingRequest.current?.abort();
    if (nativeNavigation.available()) void nativeNavigation.stop(ownerId).catch(() => {});
  }, [ownerId]);
  useEffect(() => { if (destination) routeCard.current?.scrollIntoView({ block: 'nearest' }); }, [destination]);
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
    location.locate();
    getDevicePosition(value => {
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
    });
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
  const destinationName = destination?.name;
  wantsNavigation.current = navigating;
  useEffect(() => {
    if (!nativeNavigation.available() || preview) return;
    if (!navigating || !route) {
      setBackground('idle');
      setNativePosition(null);
      void nativeNavigation.stop(ownerId).catch(() => {});
      return;
    }
    let live = true;
    let subscribed = false;
    const steps = route.legs.flatMap(leg => leg.steps.map(step => ({
      coordinates: step.geometry.coordinates, meters: step.distance,
      instruction: [turnText(step.maneuver, english), step.name].filter(Boolean).join(' · ').slice(0, 200),
    })));
    void nativeNavigation.start(ownerId, destinationName || t('Navigație AutoCare', 'AutoCare navigation'), english, steps)
      .then(() => {
        if (!wantsNavigation.current) { void nativeNavigation.stop(ownerId).catch(() => {}); return; }
        if (live) { subscribed = true; setBackground('active'); }
      }).catch(failure => {
        if (live) setBackground(nativeMethodMissing(failure) ? 'upgrade' : 'blocked');
      });
    const refresh = async () => {
      if (!live || !subscribed || document.visibilityState !== 'visible') return;
      try {
        const state = await nativeNavigation.snapshot(ownerId);
        if (!live) return;
        if (!state.active) { setNavigating(false); return; }
        const fix = state.position;
        if (fix) setNativePosition(previous => previous?.timestamp === fix.timestamp ? previous : fix);
      } catch { /* Browser GPS remains available in the foreground. */ }
    };
    const timer = window.setInterval(() => void refresh(), 1200);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [navigating, route, destinationName, english, ownerId, preview]);

  const searchPosition = position && position.accuracy <= 500 && Date.now() - position.timestamp < 20000 ? position : null;
  const [fixExpired, setFixExpired] = useState(false);
  useEffect(() => {
    if (!navigating || !position) return;
    const remaining = 15000 - (Date.now() - position.timestamp);
    setFixExpired(remaining <= 0);
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setFixExpired(true), remaining);
    return () => window.clearTimeout(timer);
  }, [navigating, position]);
  const precisePosition = !fixExpired && position && position.accuracy <= 50 && Date.now() - position.timestamp < 15000 ? position : null;
  const progress = useMemo(() => navigating && route && precisePosition ? navigationProgress(route, precisePosition, stepIndex) : null, [navigating, route, precisePosition, stepIndex]);
  useEffect(() => {
    if (!progress || !precisePosition || !destination) return;
    const next = progress;
    if (next.gap < 40 && next.index > stepIndex) setStepIndex(next.index);
    deviation.current = next.gap > Math.max(65, precisePosition.accuracy * 2) ? deviation.current + 1 : 0;
    if (deviation.current >= 3 && Date.now() - lastReroute.current > 30000) {
      lastReroute.current = Date.now();
      deviation.current = 0;
      void plan(precisePosition, destination);
    }
    // Only a new GPS reading can confirm a deviation.
  }, [position, navigating, route, destination]);

  const stopGuidance = () => {
    routingRequest.current?.abort();
    setRouting(false);
    setNavigating(false);
    setStepIndex(0);
    deviation.current = 0;
  };
  const arrived = !!progress && progress.distance < 35 && progress.gap < 30;
  const turn = progress?.next;
  const modifier = turn?.maneuver.modifier;
  const TurnIcon = arrived ? Flag : !progress ? LocateFixed : turn?.maneuver.exit || modifier === 'uturn' ? RotateCcw
    : modifier?.includes('left') ? CornerUpLeft : modifier?.includes('right') ? CornerUpRight : ArrowUp;
  return (
    <section className="ac-auto-points ac-map-compact" aria-label="AutoCare Maps">
      <header><div><span className="eyebrow">AUTOCARE MAPS</span><h3>{t('Hartă și navigație', 'Map and navigation')}</h3></div></header>
      <MapStage title={navigating ? t('Ghidare AutoCare', 'AutoCare guidance') : 'AutoCare Maps'} english={english} driving={navigating}>
        <DriveDestinationSearch area={searchPosition??area} nearPosition={!!searchPosition} disabled={preview} english={english} onChoose={point => choose(point)}/>
        {!navigating && <div className="ac-navigation-tools">
          <button type="button" disabled={preview} aria-pressed={selecting} onClick={() => setSelecting(!selecting)}><MapPin size={17}/>{t('Alege destinația pe hartă', 'Pick destination on map')}</button>
          {!preview && ownerId && <button type="button" aria-expanded={showFavorites}
            onClick={() => setShowFavorites(value => !value)}>{t('Destinații salvate', 'Saved destinations')}</button>}
          {selecting && <span role="status">{t('Atinge harta pentru destinație.', 'Tap the map for your destination.')}</span>}
        </div>}
        {!navigating && showFavorites && <section className="ac-drive-favorites" aria-label={t('Destinații salvate', 'Saved destinations')}>
          {saved.length === 0 && <small>{t('Alege o destinație pentru a o salva aici.', 'Choose a destination to save it here.')}</small>}
          {saved.map((point, index) => {
            const label = point.slot === 'home' ? t('Acasă', 'Home') : point.slot === 'work' ? t('Serviciu', 'Work') : point.name;
            return <div key={point.slot ?? `${point.latitude}:${point.longitude}`}>
              <button type="button" onClick={() => choose(point)}>{label}</button>
              <button type="button" aria-label={t('Elimină ', 'Remove ') + label}
                onClick={() => updateFavorites(saved.filter((_, i) => i !== index))}>×</button>
            </div>;
          })}
        </section>}
        {destination && !navigating && <section ref={routeCard} className="ac-navigation-card ac-navigation-destination" aria-label={t('Navigație', 'Navigation')}>
          <span className="eyebrow">{t('DESTINAȚIE', 'DESTINATION')}</span>
          <div className="ac-journey-stops">
            <div><span>{t('Plecare', 'Start')}</span><strong>{t('Poziția ta GPS', 'Your GPS location')}</strong></div>
            <div><span>{t('Sosire', 'Destination')}</span><strong data-user-content>{destination.name || t('Punctul ales pe hartă', 'Point picked on map')}</strong>
            {destination.details && <small data-user-content>{destination.details}</small>}</div>
          </div>
          {findingLocation && <p role="status">{t('Se caută poziția GPS…', 'Finding GPS position…')}</p>}
          {(routeError || locationError) && <p className="ac-navigation-alert" role="alert">{routeError || locationError}</p>}
          {routing && <p role="status">{navigating ? t('Se recalculează traseul…', 'Recalculating…') : t('Se calculează traseul…', 'Calculating route…')}</p>}
          {route && <>
            <label>{t('Traseu', 'Route')}<FilterSelect value={alternative} onChange={event => { setAlternative(Number(event.target.value)); setStepIndex(0); deviation.current = 0; lastReroute.current = Date.now(); }}>
              {routes.map((option, index) => <option key={index} value={index}>{index + 1} · {distance(option.distance)} · {Math.ceil(option.duration / 60)} min</option>)}
            </FilterSelect></label>
            {!navigating && <button type="button" className="primary" onClick={() => { setNavigating(true); location.locate(); lastReroute.current = Date.now(); }}><Navigation size={16}/>{t('Navighează aici', 'Navigate here')}</button>}
          </>}
          <div className="ac-navigation-tools">
            {!route && !routing && !findingLocation && <button type="button" onClick={() => choose(destination, true)}>{t('Calculează traseul', 'Calculate route')}</button>}
          </div>
          {!preview && ownerId && <div className="ac-navigation-tools">
            <button type="button" onClick={() => saveDestination()}>{t('Salvează la favorite', 'Save to favorites')}</button>
            <button type="button" onClick={() => saveDestination('home')}>{t('Setează Acasă', 'Set Home')}</button>
            <button type="button" onClick={() => saveDestination('work')}>{t('Setează Serviciu', 'Set Work')}</button>
            {favoriteError && <small role="alert">{t('Destinația nu a putut fi salvată pe acest dispozitiv.', 'The destination could not be saved on this device.')}</small>}
          </div>}
          {!preview && <div className="ac-navigation-tools">
            <a className="button" target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving&dir_action=navigate`}>Google Maps</a>
            <a className="button" target="_blank" rel="noopener noreferrer" href={`https://waze.com/ul?ll=${destination.latitude},${destination.longitude}&navigate=yes`}>Waze</a>
          </div>}
          <button type="button" onClick={() => { ++destinationRevision.current; ++locationRevision.current; routingRequest.current?.abort(); setFindingLocation(false); setRouting(false); setNavigating(false); setRoutes([]); setDestination(null); setRouteError(''); setLocationError(''); }}>{t('Șterge destinația', 'Clear destination')}</button>
        </section>}
        <div className="ac-auto-points-layout is-guiding">
          <div className={selecting ? 'ac-map-selecting ac-guidance-map' : 'ac-guidance-map'}>
            <RoadMap points={noRoute} position={position} active={navigating} english={english}
              maneuverDistance={progress?.untilTurn}
              matchedPosition={progress && precisePosition && progress.gap <= Math.min(20, precisePosition.accuracy) ? progress.matched : undefined}
              initialArea={defaultAutoPointsArea} onAreaChange={setArea} onLocate={preview ? undefined : location.locate}
              locating={location.waiting} locationError={location.error}
              plannedRoute={route?.geometry.coordinates} destination={destination} routeStart={routeStart} onDestination={selecting ? choose : undefined}/>
            {navigating && <div className="ac-guidance-maneuver">
              <TurnIcon aria-hidden="true" size={38}/>
              <div>
                {turn && progress && !arrived && <strong>{distance(progress.untilTurn)}</strong>}
                <span>{arrived ? t('Ai ajuns', 'You arrived') : turn ? turnText(turn.maneuver, english)
                  : progress ? t('Continuă către destinație', 'Continue to destination')
                    : t('Se caută semnalul GPS', 'Acquiring GPS signal')}</span>
                {turn?.name && !arrived && <small data-user-content>{turn.name}</small>}
              </div>
            </div>}
          </div>
        </div>
        {navigating && <footer className="ac-guidance-footer">
          {progress ? <dl>
            <div><dt>{t('Sosire estimată', 'Estimated arrival')}</dt><dd>{new Date(Date.now() + progress.seconds * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</dd></div>
            <div><dt>{t('Timp rămas', 'Time left')}</dt><dd>{Math.ceil(progress.seconds / 60)} min</dd></div>
            <div><dt>{t('Distanță rămasă', 'Distance left')}</dt><dd>{distance(progress.distance)}</dd></div>
          </dl> : <small role="status">{t('În așteptarea unei poziții GPS precise…', 'Waiting for a precise GPS fix…')}</small>}
          <button type="button" onClick={stopGuidance}><X size={18} aria-hidden="true"/>{t('Oprește navigația', 'Stop navigation')}</button>
          {(routeError || routing || background === 'blocked' || background === 'upgrade') && <small role="status">{routeError || (routing ? t('Se recalculează traseul…', 'Recalculating…') : t('Ghidarea continuă cu aplicația deschisă.', 'Guidance continues while the app is open.'))}</small>}
        </footer>}
      </MapStage>
    </section>
  );
}
