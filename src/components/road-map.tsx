'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { Map as RoadMap, Marker, GeoJSONSource } from 'maplibre-gl';
import { createRoadPositionMarker } from '@/lib/road-position-marker';
import type { GPSFix } from '@/lib/gps-tracking';
import { roadMapStyle, routeGeometry, streetOnlyStyle } from '@/lib/road-map';
import 'maplibre-gl/dist/maplibre-gl.css';
const RasterRoadMap = dynamic(() => import('./raster-road-map'), { ssr: false });
export default function RoadMapView({
  points,
  position,
  active,
  english = false,
}: {
  points: GPSFix[];
  position?: GPSFix | null;
  active: boolean;
  english?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<RoadMap | null>(null),
    marker = useRef<Marker | null>(null);
  const latest = useRef(points);
  latest.current = points;
  const latestPosition = useRef(position);
  latestPosition.current = position;
  const follow = useRef(true);
  const [failed, setFailed] = useState(false),
    [loading, setLoading] = useState(true),
    [following, setFollowing] = useState(true);
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
        const p = latestPosition.current ?? latest.current.at(-1);
        try {
          const view = new lib.Map({
            container: host.current,
            style: roadMapStyle,
            transformStyle: (_previous, next) => streetOnlyStyle(next),
            center: p ? [p.longitude, p.latitude] : [24.9668, 45.9432],
            zoom: p ? 15.8 : 5.2,
            maxZoom: 19,
            pitch: 0,
            attributionControl: { compact: true },
            renderWorldCopies: false,
          });
          map.current = view;
          view.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
          view.on('dragstart', () => {
            follow.current = false;
            setFollowing(false);
          });
          view.on('load', () => {
            if (disposed) return;
            window.clearTimeout(fallbackTimer);
            view.addSource('trip', { type: 'geojson', data: routeGeometry(latest.current) });
            view.addLayer({
              id: 'trip-outline',
              type: 'line',
              source: 'trip',
              paint: { 'line-color': '#ffffff', 'line-width': 10 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            view.addLayer({
              id: 'trip-line',
              type: 'line',
              source: 'trip',
              paint: { 'line-color': '#2677f4', 'line-width': 6 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            const element = createRoadPositionMarker(english);
            const position = latestPosition.current ?? latest.current.at(-1);
            if (position)
              marker.current = new lib.Marker({ element })
                .setLngLat([position.longitude, position.latitude])
                .addTo(view);
            // GPS can arrive while the style is loading, before the points effect
            // has a usable map. Apply the latest fix when loading completes.
            if (position && follow.current)
              view.jumpTo({ center: [position.longitude, position.latitude], zoom: 16 });
            setLoading(false);
          });
          view.on('error', () => {
            if (!disposed) {
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
  }, [english]);
  useEffect(() => {
    const view = map.current,
      p = position ?? points.at(-1);
    if (!view) return;
    const source = view.getSource('trip') as GeoJSONSource | undefined;
    source?.setData(routeGeometry(points));
    if (!p) {
      marker.current?.remove();
      marker.current = null;
      return;
    }
    if (marker.current) marker.current.setLngLat([p.longitude, p.latitude]);
    else if (view.isStyleLoaded()) {
      void import('maplibre-gl').then((lib) => {
        if (map.current !== view || (latestPosition.current ?? latest.current.at(-1)) !== p) return;
        if (marker.current) {
          marker.current.setLngLat([p.longitude, p.latitude]);
          return;
        }
        const element = createRoadPositionMarker(english);
        marker.current = new lib.Marker({ element })
          .setLngLat([p.longitude, p.latitude])
          .addTo(view);
      });
    }
    if (follow.current)
      view.easeTo({
        center: [p.longitude, p.latitude],
        zoom: Math.max(15, view.getZoom()),
        duration: 750,
      });
  }, [points, position, english]);
  if (failed)
    return <RasterRoadMap points={points} position={position} active={active} english={english} />;
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
          if (p)
            map.current?.easeTo({ center: [p.longitude, p.latitude], zoom: 16, duration: 700 });
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
      {loading && !failed && (
        <p className="ac-road-map-message" role="status">
          {english ? 'Loading street map…' : 'Se încarcă harta rutieră…'}
        </p>
      )}
      {failed && (
        <p className="ac-road-map-message" role="status">
          {english
            ? 'Map tiles are unavailable. GPS recording is independent and can continue.'
            : 'Harta nu se poate încărca momentan. Înregistrarea GPS este independentă și poate continua.'}
        </p>
      )}
    </div>
  );
}
