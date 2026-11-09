'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { Map as RoadMap, Marker, GeoJSONSource } from 'maplibre-gl';
import { createRoadPositionMarker, updateRoadPositionMarker } from '@/lib/road-position-marker';
import { autoPointCategories, type AutoPoint, type MapArea } from '@/lib/auto-points';
import type { GPSFix } from '@/lib/gps-tracking';
import { roadMapStyle, plannedRouteBounds, routeGeometry, streetOnlyStyle, tripBounds } from '@/lib/road-map';
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
}: {
  points: GPSFix[];
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
  const destinationAction = useRef(onDestination);
  destinationAction.current = onDestination;
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
    view.fitBounds(plannedRouteBounds(plannedRoute), { padding: 58, maxZoom: 16, duration: 650 });
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
          if (onAreaChange) view.on('moveend', () => {
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
            view.addSource('directions', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            view.addLayer({
              id: 'directions-outline', type: 'line', source: 'directions',
              paint: { 'line-color': '#10192a', 'line-width': 11 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            view.addLayer({
              id: 'directions-line', type: 'line', source: 'directions',
              paint: { 'line-color': '#56a8ff', 'line-width': 7 },
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
      window.clearTimeout(fallbackTimer);
      resize?.disconnect();
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, [english, history, initialArea, onAreaChange]);
  useEffect(() => {
    const view = map.current,
      p = position;
    if (!view || history) return;
    if (!p) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (marker.current) marker.current.setLngLat([p.longitude, p.latitude]);
    else {
      void import('maplibre-gl').then((lib) => {
        if (map.current !== view || latestPosition.current !== p) return;
        if (marker.current) {
          marker.current.setLngLat([p.longitude, p.latitude]);
          return;
        }
        const element = createRoadPositionMarker(english);
        updateRoadPositionMarker(element, active, p, points);
        marker.current = new lib.Marker({ element })
          .setLngLat([p.longitude, p.latitude])
          .addTo(view);
      });
    }
    if (active && !wasActive.current) {
      follow.current = true;
      setFollowing(true);
    }
    wasActive.current = active;
    if (follow.current)
      view.easeTo({
        center: [p.longitude, p.latitude],
        zoom: Math.max(15, view.getZoom()),
        duration: 750,
      });
    updateRoadPositionMarker(marker.current?.getElement(), active, p, points);
  }, [points, position, english, history, active, loading]);
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
        element.addEventListener('click', event => { event.stopPropagation(); onAutoPoint?.(point.id); });
        pins.push(new Marker({ element }).setLngLat([point.longitude, point.latitude]).addTo(view));
      }
    });
    return () => { cancelled = true; pins.forEach(pin => pin.remove()); };
  }, [autoPoints, loading, failed, english, onAutoPoint]);
  if (failed)
    return <RasterRoadMap points={points} position={position} active={active} english={english} history={history} initialArea={initialArea} onAreaChange={onAreaChange} autoPoints={autoPoints} onAutoPoint={onAutoPoint} onLocate={onLocate} locating={locating} locationError={locationError} onDestination={onDestination} plannedRoute={plannedRoute} destination={destination} routeStart={routeStart} />;
  return (
    <div className="ac-road-map" data-workspace-ui>
      <div
        ref={host}
        className="ac-road-map-canvas"
        aria-label={english ? 'Interactive street map' : 'Hartă rutieră interactivă'}
      />
      <span className="ac-road-map-status">
        {initialArea ? (english ? 'AUTO POINTS' : 'PUNCTE AUTO') : history ? (english ? 'TRIP HISTORY' : 'TRASEU SALVAT') : active
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
        onClick={() => {
          follow.current = true;
          setFollowing(true);
          onLocate?.();
          const p = position;
          if (p)
            map.current?.easeTo({ center: [p.longitude, p.latitude], zoom: 16, duration: 700 });
        }}
      >
        <Crosshair size={17}/>{locating && !position
          ? (english ? 'Finding position…' : 'Se caută poziția…')
          : (english ? 'My location' : 'Poziția mea')}
      </button>}
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
