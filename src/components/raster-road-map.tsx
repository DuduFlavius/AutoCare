'use client';
import { useEffect, useRef, useState } from 'react';
import { Crosshair } from 'lucide-react';
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet';
import { createRoadPositionMarker, updateRoadPositionMarker } from '@/lib/road-position-marker';
import { autoPointCategories, type AutoPoint, type MapArea } from '@/lib/auto-points';
import type { GPSFix } from '@/lib/gps-tracking';
import { plannedRouteBounds, routeGeometry, tripBounds } from '@/lib/road-map';
import 'leaflet/dist/leaflet.css';
/** Flat street tiles are the compatibility path for devices without WebGL. */
export default function RasterRoadMap({
  points,
  position,
  active,
  english,
  history,
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
  english: boolean;
  history: boolean;
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
    map = useRef<LeafletMap | null>(null),
    marker = useRef<Marker | null>(null),
    line = useRef<Polyline | null>(null),
    planned = useRef<Polyline | null>(null),
    latest = useRef(points);
  latest.current = points;
  const latestPosition = useRef(position);
  latestPosition.current = position;
  const destinationAction = useRef(onDestination);
  destinationAction.current = onDestination;
  const shownRoute = useRef(false);
  const wasActive = useRef(false);
  const follow = useRef(true),
    [following, setFollowing] = useState(true),
    [tileError, setTileError] = useState(false),
    [ready, setReady] = useState(false);
  function showRoute() {
    const view = map.current;
    if (!view || !plannedRoute?.length) return;
    follow.current = false;
    setFollowing(false);
    const [[west, south], [east, north]] = plannedRouteBounds(plannedRoute);
    view.fitBounds([[south, west], [north, east]], { padding: [48, 48], maxZoom: 16 });
  }
  useEffect(() => {
    let disposed = false,
      resize: ResizeObserver | undefined;
    void import('leaflet')
      .then((L) => {
        if (disposed || !host.current) return;
        const last = history ? latest.current.at(-1) : latestPosition.current,
          view = L.map(host.current, {
            zoomControl: false,
            attributionControl: true,
            preferCanvas: false,
          }).setView(initialArea ? [initialArea.latitude, initialArea.longitude] : last ? [last.latitude, last.longitude] : [45.9432, 24.9668], initialArea?.zoom ?? (last ? 16 : 6));
        map.current = view;
        L.control.zoom({ position: 'topright' }).addTo(view);
        const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          className: 'ac-dark-road-tiles',
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
        }).addTo(view);
        layer.on('tileerror', () => {
          if (!disposed) setTileError(true);
        });
        layer.on('load', () => {
          if (!disposed) setTileError(false);
        });
        planned.current = L.polyline([], { color: '#56a8ff', weight: 7, interactive: false }).addTo(view);
        line.current = L.polyline(
          routeGeometry(latest.current).features.map((f) =>
            f.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
          ),
          { color: history ? '#56d6e8' : '#398bff', weight: 4, lineCap: 'round', lineJoin: 'round' },
        ).addTo(view);
        if (history && last && latest.current.length > 1) {
          const first = latest.current[0];
          L.circleMarker([first.latitude, first.longitude], { radius: 6, color: '#75c9ac', fillOpacity: 1 }).addTo(view);
          L.circleMarker([last.latitude, last.longitude], { radius: 6, color: '#56d6e8', fillOpacity: 1 }).addTo(view);
          const [sw, ne] = tripBounds(latest.current);
          view.fitBounds([[sw[1], sw[0]], [ne[1], ne[0]]], { padding: [48, 48], maxZoom: 16, animate: false });
        } else if (last) {
          marker.current = L.marker([last.latitude, last.longitude], {
            icon: L.divIcon({
              className: 'ac-road-marker-host',
              html: createRoadPositionMarker(english),
              iconSize: [30, 30],
              iconAnchor: [15, 15],
            }),
          }).addTo(view);
        }
        if (onAreaChange) view.on('moveend', () => {
          const center = view.getCenter().wrap();
          onAreaChange({ latitude: center.lat, longitude: center.lng, zoom: view.getZoom() });
        });
        view.on('click', ({ latlng }) => destinationAction.current?.({ longitude: latlng.wrap().lng, latitude: latlng.lat }));
        setReady(true);
        view.on('dragstart', () => {
          follow.current = false;
          setFollowing(false);
        });
        resize = new ResizeObserver(() => view.invalidateSize());
        resize.observe(host.current);
      })
      .catch(() => {
        if (!disposed) setTileError(true);
      });
    return () => {
      disposed = true;
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
      marker.current = null;
      line.current = null;
      planned.current = null;
    };
  }, [english, history, initialArea, onAreaChange]);
  useEffect(() => {
    const view = map.current,
      last = position;
    if (!view || history) return;
    if (!last) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (marker.current) marker.current.setLatLng([last.latitude, last.longitude]);
    else
      void import('leaflet').then((L) => {
        if (map.current !== view || latestPosition.current !== last)
          return;
        if (marker.current) {
          marker.current.setLatLng([last.latitude, last.longitude]);
          return;
        }
        const element = createRoadPositionMarker(english);
        updateRoadPositionMarker(element, active, last, points);
        marker.current = L.marker([last.latitude, last.longitude], {
          icon: L.divIcon({
            className: 'ac-road-marker-host',
            html: element,
            iconSize: [30, 30],
            iconAnchor: [15, 15],
          }),
        }).addTo(view);
      });
    if (active && !wasActive.current) {
      follow.current = true;
      setFollowing(true);
    }
    wasActive.current = active;
    if (follow.current)
      view.setView([last.latitude, last.longitude], Math.max(15, view.getZoom()), {
        animate: true,
        duration: 0.7,
      });
    updateRoadPositionMarker(marker.current?.getElement()?.querySelector<HTMLElement>('.ac-road-position'), active, last, points);
  }, [points, position, english, history, active, ready]);
  useEffect(() => {
    line.current?.setLatLngs(
      routeGeometry(points).features.map((f) =>
        f.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
      ),
    );
  }, [points, ready]);
  useEffect(() => {
    planned.current?.setLatLngs(plannedRoute?.map(([lon, lat]) => [lat, lon]) ?? []);
    if (ready && plannedRoute?.length && !active && !shownRoute.current) showRoute();
    shownRoute.current = ready && !!plannedRoute?.length;
  }, [plannedRoute, ready]);
  useEffect(() => {
    const view = map.current;
    if (!view || !ready || !destination) return;
    let disposed = false;
    const pins: import('leaflet').CircleMarker[] = [];
    void import('leaflet').then(L => {
      if (disposed || map.current !== view) return;
      pins.push(L.circleMarker([destination.latitude, destination.longitude], { radius: 8, color: '#56d6e8', fillOpacity: 1 }).addTo(view));
      if (routeStart) pins.push(L.circleMarker([routeStart[1], routeStart[0]], { radius: 7, color: '#76e3b1', fillOpacity: 1 }).addTo(view));
    });
    return () => { disposed = true; pins.forEach(pin => pin.remove()); };
  }, [destination, routeStart, ready]);
  useEffect(() => {
    const view = map.current;
    if (!view || !ready || !autoPoints?.length) return;
    let cancelled = false;
    const markers: Marker[] = [];
    void import('leaflet').then((L) => {
      if (cancelled || map.current !== view) return;
      for (const point of autoPoints) {
        const category = autoPointCategories[point.category];
        const label = point.name || (english ? category.english : category.label);
        const dot = document.createElement('span');
        dot.className = 'ac-auto-point-pin';
        dot.style.setProperty('--poi-color', category.color);
        markers.push(L.marker([point.latitude, point.longitude], {
          icon: L.divIcon({ className: 'ac-auto-point-leaflet', html: dot, iconSize: [20, 20] }),
          title: label, alt: label,
        }).on('click', () => onAutoPoint?.(point.id)).addTo(view));
      }
    });
    return () => { cancelled = true; markers.forEach(pin => pin.remove()); };
  }, [autoPoints, ready, english, onAutoPoint]);
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
          if (p) map.current?.setView([p.latitude, p.longitude], 16, { animate: true });
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
      {tileError && (
        <p className="ac-road-map-message" role="status">
          {english
            ? 'Street tiles are temporarily unavailable. GPS recording is independent.'
            : 'Drumurile nu se pot încărca momentan. Înregistrarea GPS este independentă.'}
        </p>
      )}
    </div>
  );
}
