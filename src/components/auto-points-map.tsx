'use client';

import dynamic from 'next/dynamic';
import { ArrowUp, MapPin, Navigation } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { autoPointCategories, defaultAutoPointsArea, type AutoPoint, type MapArea } from '@/lib/auto-points';
import { browserGPSFix, latestGPSFix, type GPSFix } from '@/lib/gps-tracking';
import { navigationProgress, type Coordinate, type DrivingRoute, type Turn } from '@/lib/road-navigation';
import MapStage from './map-stage';
import { nativeMethodMissing, nativeNavigation } from '@/lib/native-tracking';
import NearbyDrivePlaces from './nearby-drive-places';
import DriveDestinationSearch from './drive-destination-search';
import { mapGPSOptions, mapLocationError, useMapLocation } from './use-map-location';
import { useApplicationLocale } from './application-locale';

const RoadMap = dynamic(() => import('./road-map'), { ssr: false });
const noRoute: GPSFix[] = [];

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
  const [nearby, setNearby] = useState<AutoPoint[]>([]);
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

  function chooseNearby(point: AutoPoint) {
    const label = autoPointCategories[point.category];
    choose({ ...point, name: point.name || (english ? label.english : label.label) });
  }
  const arrived = !!progress && progress.distance < 35 && progress.gap < 30;
  return (
    <section className="ac-auto-points ac-map-compact" aria-label="AutoCare Maps">
      <header><div><span className="eyebrow">AUTOCARE MAPS</span><h3>{t('Hartă și navigație', 'Map and navigation')}</h3></div></header>
      <MapStage title={navigating ? t('Ghidare AutoCare', 'AutoCare guidance') : 'AutoCare Maps'} english={english}>
        {!navigating && <DriveDestinationSearch area={area} disabled={preview} english={english} onChoose={point => choose(point)}/>}
        {navigating && progress && <div className="ac-next-turn">
                <ArrowUp size={24} style={{ rotate: progress.next?.maneuver.modifier?.includes('left') ? '-90deg' : progress.next?.maneuver.modifier?.includes('right') ? '90deg' : undefined }}/>
                <div><strong>{arrived ? t('Ai ajuns', 'You arrived') : progress.next ? turnText(progress.next.maneuver, english) : t('Continuă către destinație', 'Continue to destination')}</strong>
                {progress.next && !arrived && <small>{distance(progress.untilTurn)}{progress.next.name ? ` · ${progress.next.name}` : ''}</small>}</div>
                <small>{distance(progress.distance)} · {Math.ceil(progress.seconds / 60)} min · ETA {new Date(Date.now() + progress.seconds * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}</small>
              </div>}
        {!navigating && <div className="ac-navigation-tools">
          <button type="button" disabled={preview} aria-pressed={selecting} onClick={() => setSelecting(!selecting)}><MapPin size={17}/>{t('Alege destinația pe hartă', 'Pick destination on map')}</button>
          {selecting && <span role="status">{t('Atinge harta pentru destinație.', 'Tap the map for your destination.')}</span>}
        </div>}
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
          </div>
          {navigating && <small className="ac-navigation-background" role="status">
            {background === 'active'
              ? t('Ghidarea în fundal este activă. Indicațiile apar în notificarea AutoCare.', 'Background guidance is active. Directions appear in the AutoCare notification.')
              : background === 'upgrade'
                ? t('Pentru ghidare în fundal, ai nevoie de o versiune Android actualizată.', 'Background guidance requires an updated Android app.')
                : background === 'blocked'
                  ? t('Ghidarea în fundal nu a pornit. Verifică permisiunile pentru locație precisă și notificări.', 'Background guidance could not start. Check precise location and notification permissions.')
                  : t('Ține această pagină deschisă pentru ghidare. Modul în fundal este disponibil în aplicația Android compatibilă.', 'Keep this page open for guidance. Background mode is available in the compatible Android app.')}
          </small>}
          <button type="button" onClick={() => { ++destinationRevision.current; ++locationRevision.current; routingRequest.current?.abort(); setFindingLocation(false); setRouting(false); setNavigating(false); setRoutes([]); setDestination(null); setRouteError(''); setLocationError(''); }}>{t('Șterge destinația', 'Clear destination')}</button>
        </section>}
        <div className="ac-auto-points-layout is-guiding">
          <div className={selecting ? 'ac-map-selecting' : undefined}>
            <RoadMap points={noRoute} position={position} active={navigating} english={english}
              initialArea={defaultAutoPointsArea} onAreaChange={setArea} onLocate={preview ? undefined : location.locate}
              locating={location.waiting} locationError={location.error}
              autoPoints={navigating ? undefined : nearby} onAutoPoint={id => {
                const match = nearby.find(point => point.id === id);
                if (match) chooseNearby(match);
              }}
              plannedRoute={route?.geometry.coordinates} destination={destination} routeStart={routeStart} onDestination={selecting ? choose : undefined}/>
          </div>
        </div>
        {!navigating && !preview && <NearbyDrivePlaces area={area} position={position} english={english} onResults={setNearby} onChoose={chooseNearby}/>}
      </MapStage>
    </section>
  );
}
