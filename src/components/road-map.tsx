'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { Map as RoadMap, Marker, GeoJSONSource } from 'maplibre-gl';
import { createRoadPositionMarker, updateRoadPositionMarker } from '@/lib/road-position-marker';
import { autoPointCategories, type AutoPoint, type MapArea } from '@/lib/auto-points';
import type { GPSFix } from '@/lib/gps-tracking';
import { roadMapStyle, plannedRouteBounds, routeGeometry, streetOnlyStyle, tripBounds } from '@/lib/road-map';
import { driveFrame, shortestAngle } from '@/lib/drive-camera';
import 'maplibre-gl/dist/maplibre-gl.css';
const RasterRoadMap = dynamic(() => import('./raster-road-map'), { ssr: false });
export default function RoadMapView({
  points,
  position,
  active,
  english = false,
  history = false,
  initialArea,
  onAreaChange,
  autoPoints,
  onAutoPoint,
  onLocate,
  locating = false,
  locationError,
  plannedRoute,
  destination,
  routeStart,
  onDestination,
  maneuverDistance,
  matchedPosition,
}: {
  points: GPSFix[];
  maneuverDistance?: number;
  matchedPosition?: [number, number];
  position?: GPSFix | null;
  active: boolean;
  english?: boolean;
  history?: boolean;
  initialArea?: MapArea;
  onAreaChange?: (area: MapArea) => void;
  autoPoints?: AutoPoint[];
  onAutoPoint?: (id: string) => void;
  onLocate?: () => void;
  locating?: boolean;
  locationError?: string;
  plannedRoute?: [number, number][];
  destination?: { latitude: number; longitude: number } | null;
  routeStart?: [number, number];
  onDestination?: (point: { latitude: number; longitude: number }) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<RoadMap | null>(null),
    marker = useRef<Marker | null>(null);
  const latest = useRef(points);
  latest.current = points;
  const latestPosition = useRef(position);
  latestPosition.current = position;
  const autoPointAction = useRef(onAutoPoint);
  autoPointAction.current = onAutoPoint;
  const destinationAction = useRef(onDestination);
  destinationAction.current = onDestination;
  const activeRef = useRef(active);
  activeRef.current = active;
  const latestManeuver = useRef(maneuverDistance);
  latestManeuver.current = maneuverDistance;
  const latestMatch = useRef(matchedPosition);
  latestMatch.current = matchedPosition;
  const previousFix = useRef<GPSFix | null>(null);
  const drivingBearing = useRef(0);
  const renderedBearing = useRef(0);
  const frame = useRef(0);
  const [recenter, setRecenter] = useState(0);
  const [threeD, setThreeD] = useState(true);
  const shownRoute = useRef(false);
  const wasActive = useRef(false);
  const follow = useRef(true);
  const [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(true),
    [following, setFollowing] = useState(true);
  function showRoute() {
    const view = map.current;
    if (!view || !plannedRoute?.length) return;
    follow.current = false;
    setFollowing(false);
    view.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
    view.fitBounds(plannedRouteBounds(plannedRoute), { padding: 58, maxZoom: 16, duration: 650, pitch: 0, bearing: 0 });
  }
  useEffect(() => {
    let disposed = false,
      resize: ResizeObserver | undefined;
    // A stalled style/worker request need not leave a permanent loading panel.
    const fallbackTimer = window.setTimeout(() => {
      if (disposed) return;
      resize?.disconnect();
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
      setFailed(true);
    }, 15000);
    void import('maplibre-gl')
      .then((lib) => {
        if (disposed || !host.current) return;
        lib.setWorkerUrl('/maps/maplibre-gl-worker.mjs');
        const p = latestPosition.current;
        try {
          const view = new lib.Map({
            container: host.current,
            style: roadMapStyle,
            transformStyle: (_previous, next) => streetOnlyStyle(next),
            center: initialArea ? [initialArea.longitude, initialArea.latitude] : p ? [p.longitude, p.latitude] : [24.9668, 45.9432],
            zoom: initialArea?.zoom ?? (p ? 15.8 : 5.2),
            maxZoom: 19,
            pitch: 0,
            attributionControl: { compact: true },
            renderWorldCopies: false,
          });
          map.current = view;
          view.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
          if (onAreaChange) view.on('moveend', (event) => {
            if (activeRef.current && !event.originalEvent) return;
            const center = view.getCenter().wrap();
            onAreaChange({ latitude: center.lat, longitude: center.lng, zoom: view.getZoom() });
          });
          view.on('click', ({ lngLat }) => destinationAction.current?.({ longitude: lngLat.wrap().lng, latitude: lngLat.lat }));
          view.on('dragstart', () => {
            follow.current = false;
            setFollowing(false);
          });
          view.on('load', () => {
            if (disposed) return;
            window.clearTimeout(fallbackTimer);
            const building = view.getLayer('building');
            if (building?.type === 'fill' && building.source && building.sourceLayer) view.addLayer({
              id: 'driving-buildings', type: 'fill-extrusion',
              source: building.source, 'source-layer': building.sourceLayer, minzoom: 15.6,
              layout: { visibility: 'none' },
              paint: {
                'fill-extrusion-color': '#263b56',
                'fill-extrusion-height': ['coalesce', ['get', 'render_height'], 6],
                'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
                'fill-extrusion-opacity': 0.78,
              },
            }, 'building');
            view.addSource('directions', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            view.addLayer({
              id: 'directions-outline', type: 'line', source: 'directions',
              paint: { 'line-color': '#0555ba', 'line-width': 13, 'line-opacity': 0.7, 'line-blur': 2 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            view.addLayer({
              id: 'directions-line', type: 'line', source: 'directions',
              paint: { 'line-color': '#43caff', 'line-width': 7 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            view.addSource('trip', { type: 'geojson', data: routeGeometry(latest.current) });
            view.addLayer({
              id: 'trip-outline',
              type: 'line',
              source: 'trip',
              paint: { 'line-color': '#111925', 'line-width': 9 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            view.addLayer({
              id: 'trip-line',
              type: 'line',
              source: 'trip',
              paint: { 'line-color': history ? '#56d6e8' : '#398bff', 'line-width': 4 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            const position = latestPosition.current;
            if (position && !history && !marker.current)
              marker.current = new lib.Marker({ element: createRoadPositionMarker(english) })
                .setLngLat([position.longitude, position.latitude])
                .addTo(view);
            // GPS can arrive while the style is loading, before the points effect
            // has a usable map. Apply the latest fix when loading completes.
            if (history && latest.current.length > 1) {
              const first = latest.current[0], last = latest.current.at(-1)!;
              for (const [point, color] of [[first, '#75c9ac'], [last, '#56d6e8']] as const) {
                new lib.Marker({ color, scale: 0.72 }).setLngLat([point.longitude, point.latitude]).addTo(view);
              }
              view.fitBounds(tripBounds(latest.current), { padding: 52, maxZoom: 16, duration: 0 });
            } else if (position && follow.current)
              view.jumpTo({ center: [position.longitude, position.latitude], zoom: 16 });
            setLoading(false);
          });
          view.on('error', () => {
            if (!disposed && !view.loaded() && !view.getSource('trip')) {
              window.clearTimeout(fallbackTimer);
              resize?.disconnect();
              marker.current?.remove();
              marker.current = null;
              map.current?.remove();
              map.current = null;
              setFailed(true);
            }
          });
          resize = new ResizeObserver(() => view.resize());
          resize.observe(host.current);
        } catch (error) {
          console.warn(
            'AutoCare street-map initialization failed',
            error instanceof Error ? error.message : 'Map unavailable',
          );
          if (!disposed) {
            setFailed(true);
            setLoading(false);
          }
        }
      })
      .catch((error) => {
        console.warn(
          'AutoCare street-map module unavailable',
          error instanceof Error ? error.message : 'Map unavailable',
        );
        if (!disposed) {
          setFailed(true);
          setLoading(false);
        }
      });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame.current);
      previousFix.current = null;
      window.clearTimeout(fallbackTimer);
      resize?.disconnect();
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, [english, history, initialArea, onAreaChange]);
  useEffect(() => {
    const view = map.current;
    if (view?.getLayer('driving-buildings'))
      view.setLayoutProperty('driving-buildings', 'visibility', active && threeD ? 'visible' : 'none');
  }, [active, threeD, loading]);
  useEffect(() => {
    const view = map.current,
      p = position;
    if (!view || history) return;
    if (!p) {
      cancelAnimationFrame(frame.current);
      previousFix.current = null;
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (loading) return;
    const previous = previousFix.current;
    if (active && !wasActive.current) {
      follow.current = true;
      setFollowing(true);
    }
    wasActive.current = active;
    const camera = driveFrame(previous, p, drivingBearing.current, latestManeuver.current);
    if (previous?.timestamp !== p.timestamp && (!active || (p.accuracy <= 50 && !camera.outlier))) previousFix.current = p;
    if (active && p.accuracy <= 50) drivingBearing.current = camera.bearing;
    const animate = (pin: Marker) => {
      cancelAnimationFrame(frame.current);
      const target: [number, number] = (active && latestMatch.current) || [p.longitude, p.latitude];
      const start = pin.getLngLat();
      const driving = active && threeD;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const duration = active && !reducedMotion ? camera.duration : 0;
      const stationary = active && (camera.hold || (p.accuracy > 50 && !!previous));
      const center: [number, number] = stationary ? [start.lng, start.lat] : target;
      const ease = (value: number) => value * (2 - value);
      const bearing = driving ? drivingBearing.current : 0;
      if (follow.current) view.easeTo({
        center,
        bearing,
        pitch: driving ? 60 : 0,
        padding: { top: driving ? Math.round(view.getContainer().clientHeight * 0.36) : 0, bottom: 0, left: 0, right: 0 },
        zoom: driving ? camera.zoom : Math.max(15, view.getZoom()),
        duration: active ? duration : 600,
        easing: ease,
      });
      const element = pin.getElement();
      updateRoadPositionMarker(element, active, p, points);
      if (!active) {
        pin.setLngLat(center);
        return;
      }
      const started = performance.now();
      const headingStart = renderedBearing.current;
      const headingChange = shortestAngle(headingStart, drivingBearing.current);
      const render = (now: number) => {
        if (map.current !== view || marker.current !== pin) return;
        const time = duration ? Math.min(1, (now - started) / duration) : 1;
        const amount = ease(time);
        pin.setLngLat([start.lng + shortestAngle(start.lng, center[0]) * amount, start.lat + (center[1] - start.lat) * amount]);
        renderedBearing.current = headingStart + headingChange * amount;
        element.style.setProperty('--gps-bearing', shortestAngle(view.getBearing(), renderedBearing.current) + 'deg');
        if (time < 1) frame.current = requestAnimationFrame(render);
      };
      render(started);
    };
    if (marker.current) animate(marker.current);
    else void import('maplibre-gl').then(({ Marker }) => {
      if (map.current !== view || latestPosition.current !== p || marker.current) return;
      marker.current = new Marker({ element: createRoadPositionMarker(english) })
        .setLngLat([p.longitude, p.latitude]).addTo(view);
      animate(marker.current);
    });
  }, [points, position, english, history, active, loading, threeD, recenter]);
  useEffect(() => {
    const source = map.current?.getSource('trip') as GeoJSONSource | undefined;
    source?.setData(routeGeometry(points));
  }, [points, loading]);
  useEffect(() => {
    const view = map.current;
    const source = view?.getSource('directions') as GeoJSONSource | undefined;
    source?.setData({ type: 'FeatureCollection', features: plannedRoute?.length ? [{
      type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: plannedRoute },
    }] : [] });
    if (source && plannedRoute?.length && !active && !shownRoute.current) showRoute();
    shownRoute.current = !!source && !!plannedRoute?.length;
  }, [plannedRoute, loading]);
  useEffect(() => {
    const view = map.current;
    if (!view || loading || !destination) return;
    let disposed = false;
    const pins: Marker[] = [];
    void import('maplibre-gl').then(({ Marker }) => {
      if (disposed || map.current !== view) return;
      const finish = new Marker({ color: '#56d6e8', scale: 0.9 }).setLngLat([destination.longitude, destination.latitude]).addTo(view);
      finish.getElement().setAttribute('aria-label', english ? 'Destination' : 'Sosire');
      pins.push(finish);
      if (routeStart) {
        const departure = new Marker({ color: '#76e3b1', scale: 0.75 }).setLngLat(routeStart).addTo(view);
        departure.getElement().setAttribute('aria-label', english ? 'Route start' : 'Plecare');
        pins.push(departure);
      }
    });
    return () => { disposed = true; pins.forEach(pin => pin.remove()); };
  }, [destination, routeStart, loading, english]);
  useEffect(() => {
    const view = map.current;
    if (!view || loading || failed || !autoPoints?.length) return;
    let cancelled = false;
    const pins: Marker[] = [];
    void import('maplibre-gl').then(({ Marker }) => {
      if (cancelled || map.current !== view) return;
      for (const point of autoPoints) {
        const element = document.createElement('button');
        element.type = 'button';
        element.className = 'ac-auto-point-pin';
        const category = autoPointCategories[point.category];
        const label = point.name || (english ? category.english : category.label);
        element.setAttribute('aria-label', label);
        element.title = label;
        element.style.setProperty('--poi-color', category.color);
        element.addEventListener('click', event => { event.stopPropagation(); autoPointAction.current?.(point.id); });
        pins.push(new Marker({ element }).setLngLat([point.longitude, point.latitude]).addTo(view));
      }
    });
    return () => { cancelled = true; pins.forEach(pin => pin.remove()); };
  }, [autoPoints, loading, failed, english]);
  if (failed)
    return <RasterRoadMap points={points} position={position} active={active} english={english} history={history} initialArea={initialArea} onAreaChange={onAreaChange} autoPoints={autoPoints} onAutoPoint={onAutoPoint} onLocate={onLocate} locating={locating} locationError={locationError} onDestination={onDestination} plannedRoute={plannedRoute} destination={destination} routeStart={routeStart} />;
  return (
    <div className={active ? "ac-road-map ac-road-map-driving" : "ac-road-map"} data-workspace-ui>
      <div
        ref={host}
        className="ac-road-map-canvas"
        aria-label={english ? 'Interactive street map' : 'Hartă rutieră interactivă'}
      />
      <span className="ac-road-map-status">
        {initialArea && active ? (english ? 'GPS · GUIDANCE' : 'GPS · GHIDARE') : history ? (english ? 'TRIP HISTORY' : 'TRASEU SALVAT') : active
          ? english
            ? 'GPS · RECORDING'
            : 'GPS · ÎNREGISTRARE'
          : english
            ? 'STREET MAP'
            : 'HARTĂ RUTIERĂ'}
      </span>
      {!history && (onLocate || active || position) && <button
        type="button"
        className="ac-road-map-center"
        aria-pressed={following}
        aria-label={english ? 'Recenter on my location' : 'Recentrează pe poziția mea'}
        onClick={() => {
          follow.current = true;
          setFollowing(true);
          const p = position;
          if (!p || Date.now() - p.timestamp > 15000) onLocate?.();
          if (active) setRecenter(value => value + 1);
          if (p && !active) map.current?.easeTo({ center: [p.longitude, p.latitude], zoom: 16, duration: 700 });
        }}
      >
        <Crosshair size={20} aria-hidden="true"/><span>{locating && !position
          ? (english ? 'Finding position…' : 'Se caută poziția…')
          : (english ? 'My location' : 'Poziția mea')}</span>
      </button>}
      {active && <button type="button" className="ac-road-map-mode" aria-pressed={threeD}
        aria-label={english ? '3D driving view' : 'Perspectivă de condus 3D'}
        onClick={() => {
          follow.current = true;
          setFollowing(true);
          setThreeD(value => !value);
        }}>{threeD ? '3D' : '2D'}</button>}
      {!!plannedRoute?.length && <button type="button" className="ac-road-map-overview" onClick={showRoute}>
        {english ? 'Show full route' : 'Vezi traseul complet'}
      </button>}
      {!history && (position || locationError) && (
        <p className="ac-map-location-state" role="status">
          {locationError || (position && (english ? 'GPS accuracy ±' : 'Precizie GPS ±') + Math.round(position.accuracy) + ' m')}
        </p>
      )}
      {loading && !failed && (
        <p className="ac-road-map-message" role="status">
          {english ? 'Loading street map…' : 'Se încarcă harta rutieră…'}
        </p>
      )}
    </div>
  );
}
