'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Crosshair,Layers,Sun,Moon } from 'lucide-react';
import type { Map as RoadMap, Marker, GeoJSONSource, AllPaintProperties } from 'maplibre-gl';
import { createRoadPositionMarker, updateRoadPositionMarker } from '@/lib/road-position-marker';
import { autoPointCategories, type AutoPoint, type MapArea } from '@/lib/auto-points';
import {drivingBearing,drivingZoom,daylightMap} from '@/lib/driving-camera';
import {measuredTransition,interpolateFix,interpolateAngle} from '@/lib/gps-animation';
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
  untilTurn,
}: {
  untilTurn?: number;
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
  const [perspective,setPerspective]=useState(true);
  const [theme,setTheme]=useState<'auto'|'day'|'night'>('auto');
  const [hour,setHour]=useState(()=>new Date().getHours());
  const daylight=theme==='day'||theme==='auto'&&daylightMap(hour);
  const dayRef=useRef(daylight);dayRef.current=daylight;
  const animationFrame=useRef(0),displayPosition=useRef<GPSFix|null>(null),displayBearing=useRef(0);
  const cameraBearing=useRef(0),cameraPosition=useRef<GPSFix|null>(null);
  useEffect(()=>{const timer=setInterval(()=>setHour(new Date().getHours()),60000);return()=>clearInterval(timer)},[]);
  const latest = useRef(points);
  latest.current = points;
  const latestPosition = useRef(position);
  latestPosition.current = position;
  const autoPointAction = useRef(onAutoPoint);
  autoPointAction.current = onAutoPoint;
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
            transformStyle: (_previous, next) => streetOnlyStyle(next,dayRef.current),
            center: initialArea ? [initialArea.longitude, initialArea.latitude] : p ? [p.longitude, p.latitude] : [24.9668, 45.9432],
            zoom: initialArea?.zoom ?? (p ? 15.8 : 5.2),
            maxZoom: 19,
            pitch: 0,
            attributionControl: { compact: true },
            renderWorldCopies: false,
          });
          map.current = view;
          view.addControl(new lib.NavigationControl({ showCompass: true }), 'top-right');
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
      window.cancelAnimationFrame(animationFrame.current);
            const building=view.getStyle().layers.find(layer=>layer.type==='fill'&&layer['source-layer']==='building');
            if(building&&'source' in building){view.addLayer({id:'autocare-buildings',type:'fill-extrusion',source:building.source,'source-layer':'building',minzoom:15,paint:{'fill-extrusion-color':'#456357','fill-extrusion-height':['coalesce',['get','render_height'],0],'fill-extrusion-base':['coalesce',['get','render_min_height'],0],'fill-extrusion-opacity':.5}},view.getStyle().layers.find(layer=>layer.type==='symbol')?.id);}
            view.addSource('directions' , { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            view.addLayer({
              id: 'directions-outline', type: 'line', source: 'directions',
              paint: { 'line-color': '#091611', 'line-width': 11 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            view.addLayer({
              id: 'directions-line', type: 'line', source: 'directions',
              paint: { 'line-color': '#5AFFC4', 'line-width': 7 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            view.addSource('trip', { type: 'geojson', data: routeGeometry(latest.current) });
            view.addLayer({
              id: 'trip-outline',
              type: 'line',
              source: 'trip',
              paint: { 'line-color': '#091611', 'line-width': 9 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            view.addLayer({
              id: 'trip-line',
              type: 'line',
              source: 'trip',
              paint: { 'line-color': history ? '#5AFFC4' : '#5AFFC4', 'line-width': 4 },
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
              for (const [point, color] of [[first, '#20E6A2'], [last, '#5AFFC4']] as const) {
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
      window.cancelAnimationFrame(animationFrame.current);
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
      window.cancelAnimationFrame(animationFrame.current);
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
    // Keep the last precise camera/marker while a coarse fix is reported in the status.
    if(active&&p.accuracy>50)return;
    if(active && cameraPosition.current && p.timestamp<cameraPosition.current.timestamp)return;
    const duration=active?measuredTransition(cameraPosition.current,p,window.matchMedia('(prefers-reduced-motion: reduce)').matches):0;
    if(duration===null)return;
    window.cancelAnimationFrame(animationFrame.current);
    if(!marker.current){
      void import('maplibre-gl').then(lib=>{
        if(map.current!==view||latestPosition.current!==p||marker.current)return;
        const element=createRoadPositionMarker(english);
        updateRoadPositionMarker(element,active,p,points);
        marker.current=new lib.Marker({element}).setLngLat([p.longitude,p.latitude]).addTo(view);
        marker.current.setRotationAlignment('map').setRotation(active?cameraBearing.current:0).setPitchAlignment('map');
        marker.current.getElement().style.setProperty('--gps-bearing','0deg');
      });
    }
    if(active&&!wasActive.current){follow.current=true;setFollowing(true);}
    wasActive.current=active;
    const previousFix=cameraPosition.current;
    const initialHeading=!previousFix&&p.speed!=null&&p.speed>=1.5&&p.heading!=null&&Number.isFinite(p.heading)&&p.heading>=0&&p.heading<360;
    const bearing=active?(initialHeading?p.heading!:drivingBearing(previousFix,p,cameraBearing.current)):0;
    cameraPosition.current=p;cameraBearing.current=bearing;
    const from=displayPosition.current??p,fromBearing=displayBearing.current;
    const zoom=active?drivingZoom(p.speed,untilTurn):16;
    const startZoom=view.getZoom(),startPitch=view.getPitch();
    const pitch=active&&perspective?52:0;
    const begun=performance.now();
    const draw=(now:number)=>{
      if(map.current!==view)return;
      const progress=duration?Math.min(1,(now-begun)/duration):1;
      const point=interpolateFix(from,p,progress),heading=interpolateAngle(fromBearing,bearing,progress);
      displayPosition.current=point;displayBearing.current=heading;
      marker.current?.setLngLat([point.longitude,point.latitude]).setRotation(heading);
      // One animation owns the camera. Manual dragging disables following immediately.
      if(follow.current)view.jumpTo({center:[point.longitude,point.latitude],bearing:heading,
        pitch:startPitch+(pitch-startPitch)*progress,zoom:startZoom+(zoom-startZoom)*progress,
        padding:active?{top:Math.min(240,view.getContainer().clientHeight*.3),bottom:0,left:0,right:0}:{top:0,bottom:0,left:0,right:0}});
      if(progress<1)animationFrame.current=window.requestAnimationFrame(draw);
    };
    animationFrame.current=window.requestAnimationFrame(draw);
    updateRoadPositionMarker(marker.current?.getElement(),active,p,points);
    marker.current?.getElement().style.setProperty('--gps-bearing','0deg');
    return()=>window.cancelAnimationFrame(animationFrame.current);
  }, [points, position, english, history, active, loading, perspective,untilTurn]);
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
      const finish = new Marker({ color: '#5AFFC4', scale: 0.9 }).setLngLat([destination.longitude, destination.latitude]).addTo(view);
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
  useEffect(()=>{
    const view=map.current;if(!view||loading||failed)return;
    const styled=streetOnlyStyle(view.getStyle(),daylight);
    for(const layer of styled.layers){if(['directions','trip'].some(id=>layer.id.startsWith(id)))continue;
      for(const [property,value] of Object.entries(layer.paint||{}))view.setPaintProperty(layer.id,property as keyof AllPaintProperties,value);
    }
  },[daylight,loading,failed]);
  if (failed)
    return <div className="rg-map-fallback"><RasterRoadMap points={points} position={position} active={active} english={english} history={history} initialArea={initialArea} onAreaChange={onAreaChange} autoPoints={autoPoints} onAutoPoint={onAutoPoint} onLocate={onLocate} locating={locating} locationError={locationError} onDestination={onDestination} plannedRoute={plannedRoute} destination={destination} routeStart={routeStart} /><p className="rg-map-fallback-note" role="status">{english?'2D fallback map · 3D unavailable on this device.':'Hartă de rezervă 2D · 3D indisponibil pe acest dispozitiv.'}</p></div>;
  return (
    <div className="ac-road-map" data-workspace-ui data-map-theme={daylight?'day':'night'}>
      <div
        ref={host}
        className="ac-road-map-canvas"
        aria-label={english ? 'Interactive street map' : 'Hartă rutieră interactivă'}
      />
      {!history&&<div className="rg-map-modes"><button type="button" aria-pressed={perspective} aria-label={english?'Toggle 2D or 3D':'Comută 2D sau 3D'} onClick={()=>setPerspective(v=>!v)}><Layers size={18}/>{perspective?'3D':'2D'}</button><button type="button" aria-label={english?'Map theme':'Tema hărții'} title={theme} onClick={()=>setTheme(v=>v==='auto'?'day':v==='day'?'night':'auto')}>{daylight?<Sun size={18}/>:<Moon size={18}/>}<small>{theme==='auto'?'Auto':daylight?(english?'Day':'Zi'):(english?'Night':'Noapte')}</small></button></div>}
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
        title={english?'My location':'Poziția mea'}
        aria-label={locating?(english?'Finding position':'Se caută poziția'):(english?'My location':'Poziția mea')}
        aria-pressed={following}
        onClick={() => {
          follow.current = true;
          setFollowing(true);
          onLocate?.();
          const p = position;
          if (p && (!active || p.accuracy<=50))
            map.current?.easeTo({ center: [p.longitude, p.latitude], zoom: 16, duration: 700 });
        }}
      >
        <Crosshair size={19}/><span>{locating && !position
          ? (english ? 'Finding position…' : 'Se caută poziția…')
          : (english ? 'My location' : 'Poziția mea')}</span>
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
