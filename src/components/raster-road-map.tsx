'use client';
import { useEffect, useRef, useState } from 'react';
import type { Map as LeafletMap, Marker, Polyline } from 'leaflet';
import { createRoadPositionMarker } from '@/lib/road-position-marker';
import type { GPSFix } from '@/lib/gps-tracking';
import { routeGeometry } from '@/lib/road-map';
import 'leaflet/dist/leaflet.css';
/** Flat street tiles are the compatibility path for devices without WebGL. */
export default function RasterRoadMap({
  points,
  position,
  active,
  english,
}: {
  points: GPSFix[];
  position?: GPSFix | null;
  active: boolean;
  english: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<LeafletMap | null>(null),
    marker = useRef<Marker | null>(null),
    line = useRef<Polyline | null>(null),
    latest = useRef(points);
  latest.current = points;
  const latestPosition = useRef(position);
  latestPosition.current = position;
  const follow = useRef(true),
    [following, setFollowing] = useState(true),
    [tileError, setTileError] = useState(false);
  useEffect(() => {
    let disposed = false,
      resize: ResizeObserver | undefined;
    void import('leaflet')
      .then((L) => {
        if (disposed || !host.current) return;
        const last = latestPosition.current ?? latest.current.at(-1),
          view = L.map(host.current, {
            zoomControl: false,
            attributionControl: true,
            preferCanvas: false,
          }).setView(last ? [last.latitude, last.longitude] : [45.9432, 24.9668], last ? 16 : 6);
        map.current = view;
        L.control.zoom({ position: 'topright' }).addTo(view);
        const layer = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
        }).addTo(view);
        layer.on('tileerror', () => {
          if (!disposed) setTileError(true);
        });
        layer.on('load', () => {
          if (!disposed) setTileError(false);
        });
        line.current = L.polyline(
          routeGeometry(latest.current).features.map((f) =>
            f.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
          ),
          { color: '#2677f4', weight: 6, lineCap: 'round', lineJoin: 'round' },
        ).addTo(view);
        if (last)
          marker.current = L.marker([last.latitude, last.longitude], {
            icon: L.divIcon({
              className: 'ac-road-marker-host',
              html: createRoadPositionMarker(english),
              iconSize: [28, 28],
              iconAnchor: [14, 14],
            }),
          }).addTo(view);
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
    };
  }, [english]);
  useEffect(() => {
    const view = map.current,
      last = position ?? points.at(-1);
    if (!view) return;
    line.current?.setLatLngs(
      routeGeometry(points).features.map((f) =>
        f.geometry.coordinates.map(([lon, lat]) => [lat, lon] as [number, number]),
      ),
    );
    if (!last) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (marker.current) marker.current.setLatLng([last.latitude, last.longitude]);
    else
      void import('leaflet').then((L) => {
        if (map.current !== view || (latestPosition.current ?? latest.current.at(-1)) !== last)
          return;
        if (marker.current) {
          marker.current.setLatLng([last.latitude, last.longitude]);
          return;
        }
        marker.current = L.marker([last.latitude, last.longitude], {
          icon: L.divIcon({
            className: 'ac-road-marker-host',
            html: createRoadPositionMarker(english),
            iconSize: [28, 28],
            iconAnchor: [14, 14],
          }),
        }).addTo(view);
      });
    if (follow.current)
      view.setView([last.latitude, last.longitude], Math.max(15, view.getZoom()), {
        animate: true,
        duration: 0.7,
      });
  }, [points, position, english]);
  return (
    <div className="ac-road-map" data-workspace-ui>
      <div
        ref={host}
        className="ac-road-map-canvas"
        aria-label={english ? 'Interactive street map' : 'Hartă rutieră interactivă'}
      />
      <span className="ac-road-map-status">
        {active
          ? english
            ? 'GPS · RECORDING'
            : 'GPS · ÎNREGISTRARE'
          : english
            ? 'STREET MAP'
            : 'HARTĂ RUTIERĂ'}
      </span>
      <button
        type="button"
        className="ac-road-map-center"
        disabled={!position && !points.length}
        aria-pressed={following}
        onClick={() => {
          follow.current = true;
          setFollowing(true);
          const p = position ?? points.at(-1);
          if (p) map.current?.setView([p.latitude, p.longitude], 16, { animate: true });
        }}
      >
        {following
          ? english
            ? 'Following you'
            : 'Te urmărește'
          : english
            ? 'Recenter on me'
            : 'Recentrează pe mine'}
      </button>
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
