'use client';
import type { SpeedRoad } from '@/lib/road-speed-limit';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { Crosshair,Layers,Sun,Moon } from 'lucide-react';
import type { Map as RoadMap, Marker, GeoJSONSource, AllPaintProperties } from 'maplibre-gl';
import { createRoadPositionMarker, updateRoadPositionMarker } from '@/lib/road-position-marker';
import { autoPointCategories, type AutoPoint, type MapArea } from '@/lib/auto-points';
import {drivingBearing,drivingView,drivingInsets,cameraSettlingTime} from '@/lib/driving-camera';
import {defaultMapLight,mapIsDay,readMapLight,type MapLightSettings} from '@/lib/smartdrive-light';
import {matchRecordedRoadLink} from '@/lib/recorded-road-match';
import {segmentMeters} from '@/lib/gps-tracking';
import {measuredTransition,interpolateFix,interpolateAngle,cameraTurnProgress,prepareRoadInterpolation} from '@/lib/gps-animation';
import type { GPSFix } from '@/lib/gps-tracking';
import { alternateRouteGeometry, roadMapStyle, plannedRouteBounds, visualTrackGeometry, streetOnlyStyle, tripBounds, type RouteVariant } from '@/lib/road-map';
import {automaticMapQuality,readMapQuality,renderQuality,type MapQuality,type RenderQuality} from '@/lib/drive-render-quality';
import 'maplibre-gl/dist/maplibre-gl.css';
const noConfirmedRoads: readonly SpeedRoad[] = [];
const RasterRoadMap = dynamic(() => import('./raster-road-map'), { ssr: false });
export default function RoadMapView({
  points,
  mappedRoads,
  position,
  active,
  visible=true,
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
  alternateRoutes,
  onSelectRoute,
  destination,
  routeStart,
  onDestination,
  untilTurn,
  positionSegment,
}: {
  positionSegment?: string;
  untilTurn?: number;
  points: GPSFix[];
  mappedRoads?: readonly SpeedRoad[];
  position?: GPSFix | null;
  active: boolean;
  visible?: boolean;
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
  alternateRoutes?: RouteVariant[];
  onSelectRoute?: (index:number)=>void;
  destination?: { latitude: number; longitude: number } | null;
  routeStart?: [number, number];
  onDestination?: (point: { latitude: number; longitude: number }) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    map = useRef<RoadMap | null>(null),
    marker = useRef<Marker | null>(null);
  const [perspective,setPerspective]=useState(true);
  const [cameraRevision,reframeCamera]=useState(0);
  const [light,setLight]=useState(defaultMapLight);
  const [lightSettings,setLightSettings]=useState(false);
  const [now,setNow]=useState(()=>new Date());
  const [quality,setQuality]=useState<MapQuality>('auto');
  const [automatic,setAutomatic]=useState<RenderQuality>('balanced');
  const qualityRef=useRef(quality);qualityRef.current=quality;
  const effective=quality==='auto'?automatic:quality;
  const renderRef=useRef(effective);renderRef.current=effective;
  const slowFrames=useRef(0);
  const trackUpdate=useRef<number|null>(null);
  const contextLost=useRef(false);
  useEffect(()=>{
    const memory=(navigator as Navigator&{deviceMemory?:number}).deviceMemory;
    setAutomatic(automaticMapQuality(memory,navigator.hardwareConcurrency));
    try{setQuality(readMapQuality(localStorage.getItem('smartdrive-map-quality')));}catch{/* Optional preference. */}
  },[]);
  const updateQuality=(value:MapQuality)=>{
    setQuality(value);
    slowFrames.current=0;
    try{localStorage.setItem('smartdrive-map-quality',value);}catch{/* Optional preference. */}
  };
  const areaAction=useRef(onAreaChange);areaAction.current=onAreaChange;
  const areaRef=useRef(initialArea);areaRef.current=initialArea;

  const daylight=mapIsDay(light,now,position??initialArea??{latitude:45.75,longitude:21.23});
  useEffect(()=>{try{setLight(readMapLight(localStorage.getItem('smartdrive-map-light')));}catch{/* Storage may be unavailable. */}},[]);
  const updateLight=(value:MapLightSettings)=>{
    setLight(value);
    try{localStorage.setItem('smartdrive-map-light',JSON.stringify(value));}catch{/* Use the preference for this session. */}
  };
  const dayRef=useRef(daylight);dayRef.current=daylight;
  const animationFrame=useRef(0),displayPosition=useRef<GPSFix|null>(null),displayBearing=useRef(0);
  const cameraBearing=useRef(0),cameraPosition=useRef<GPSFix|null>(null);
  useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),60000);return()=>clearInterval(timer)},[]);
  const latest = useRef(points);
  latest.current = points;
  const traceRoads=mappedRoads??(history?undefined:noConfirmedRoads);
  const latestRoads=useRef(traceRoads);
  latestRoads.current=traceRoads;
  const latestPosition = useRef(position);
  latestPosition.current = position;
  const autoPointAction = useRef(onAutoPoint);
  autoPointAction.current = onAutoPoint;
  const destinationAction = useRef(onDestination);
  destinationAction.current = onDestination;
  const routeAction = useRef(onSelectRoute);
  routeAction.current = onSelectRoute;
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
    const routePoints = alternateRoutes?.length ? [...plannedRoute, ...alternateRoutes.flatMap(route => route.coordinates)] : plannedRoute;
    view.fitBounds(plannedRouteBounds(routePoints), { padding: Math.min(58, view.getCanvas().clientHeight * .2), maxZoom: 16, duration: 650 });
  }
  const manualZoom = useRef<number | null>(null);
  const [opened,setOpened]=useState(visible);
  useEffect(()=>{if(visible)setOpened(true);},[visible]);
  const trackingCamera = useRef(active);
  trackingCamera.current = active;
  useEffect(() => {
    if(!opened)return;
    contextLost.current=false;
    let disposed = false,
      resize: ResizeObserver | undefined;
    let recoveryTimer:number|undefined;
    function fallback(){
      if(disposed)return;
      disposed=true;
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(recoveryTimer);
      window.cancelAnimationFrame(animationFrame.current);
      resize?.disconnect();
      if(trackUpdate.current!==null)window.clearTimeout(trackUpdate.current);
      trackUpdate.current=null;
      marker.current?.remove();
      marker.current=null;
      map.current?.remove();
      map.current=null;
      setLoading(false);
      setFailed(true);
    }
    // Keep working tiles when a single tile fails. Fall back only if the map cannot load.
    const fallbackTimer=window.setTimeout(fallback,15000);
    void import('maplibre-gl')
      .then((lib) => {
        if (disposed || !host.current) return;
        lib.setWorkerUrl('/maps/maplibre-gl-worker.mjs');
        const p = latestPosition.current,initial=areaRef.current;
        try {
          const view = new lib.Map({
            container: host.current,
            style: roadMapStyle,
            transformStyle: (_previous, next) => streetOnlyStyle(next,dayRef.current),
            center: initial ? [initial.longitude, initial.latitude] : p ? [p.longitude, p.latitude] : [24.9668, 45.9432],
            zoom: initial?.zoom ?? (p ? 15.8 : 5.2),
            maxZoom: 19,
            pitch: 0,
            maxPitch: 65,
            attributionControl: { compact: true, customAttribution: initial
              ? '<a href="https://www.openstreetmap.org/edit" target="_blank" rel="noopener noreferrer">' + (english ? 'Fix the map' : 'Corectează harta') + '</a>'
              : undefined },
            renderWorldCopies: false,
            trackResize: false,
            pixelRatio: Math.min(window.devicePixelRatio,renderQuality[renderRef.current].pixelRatio),
            maxTileCacheSize: 48,
            fadeDuration: 100,
          });
          map.current = view;
          view.addControl(new lib.NavigationControl({ showCompass: true }), 'top-right');
          view.on('moveend', () => {
            if (trackingCamera.current && follow.current) return;
            const center = view.getCenter().wrap();
            areaAction.current?.({ latitude: center.lat, longitude: center.lng, zoom: view.getZoom() });
          });
          view.on('zoomend', event => {
            if (event.originalEvent && trackingCamera.current) manualZoom.current=view.getZoom();
          });
          view.on('click', ({ lngLat, point }) => {
            if (view.getLayer('directions-alternates-hit')) {
              const radius = 5;
              const box: [[number,number],[number,number]] = [[point.x-radius,point.y-radius],[point.x+radius,point.y+radius]];
              const onSelected = view.queryRenderedFeatures(box, {layers:['directions-line']}).length > 0;
              const variant = onSelected ? undefined : view.queryRenderedFeatures(box, {layers:['directions-alternates-hit']})[0];
              const index = variant?.properties?.index;
              if (typeof index === 'number') { routeAction.current?.(index); return; }
            }
            destinationAction.current?.({ longitude: lngLat.wrap().lng, latitude: lngLat.lat });
          });
          const suspendFollow=()=>{follow.current=false;setFollowing(false);};
          view.on('dragstart',suspendFollow);
          view.on('rotatestart',event=>{if(event.originalEvent)suspendFollow();});
          view.on('pitchstart',event=>{if(event.originalEvent)suspendFollow();});
          view.on('zoomstart',event=>{if(event.originalEvent)suspendFollow();});
          view.on('webglcontextlost',()=>{
            contextLost.current=true;
            window.cancelAnimationFrame(animationFrame.current);
            window.clearTimeout(recoveryTimer);
            recoveryTimer=window.setTimeout(fallback,4500);
          });
          view.on('webglcontextrestored',()=>{
            contextLost.current=false;
            window.clearTimeout(recoveryTimer);
            reframeCamera(revision=>revision+1);
          });
          view.on('load', () => {
            if (disposed) return;
            window.clearTimeout(fallbackTimer);
            view.addSource('directions-alternates', { type:'geojson', data: alternateRouteGeometry([]) });
            view.addLayer({ id:'directions-alternates-line',type:'line',source:'directions-alternates',
              paint:{'line-color':'#677e9b','line-width':6,'line-opacity':.8,'line-dasharray':[1.5,.5]},
              layout:{'line-cap':'round','line-join':'round'} });
            view.addLayer({ id:'directions-alternates-hit',type:'line',source:'directions-alternates',
              paint:{'line-width':20,'line-opacity':0} });
            view.addSource('directions' , { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
            view.addLayer({
              id: 'directions-outline', type: 'line', source: 'directions',
              paint: { 'line-color': '#d9f6f7', 'line-width': 11 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            view.addLayer({
              id: 'directions-line', type: 'line', source: 'directions',
              paint: { 'line-color': '#087287', 'line-width': 7 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            view.addSource('trip', { type: 'geojson', data: {type:'FeatureCollection',features:[]} });
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
              paint: { 'line-color': history ? '#5AFFC4' : '#168a9d', 'line-width': 4 },
              layout: { 'line-cap': 'round', 'line-join': 'round' },
            });
            const position = latestPosition.current;
            view.moveLayer('directions-outline');
            view.moveLayer('directions-line');
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
          let lastWidth=0,lastHeight=0;
          resize = new ResizeObserver(([entry])=>{
            if(!entry)return;
            const {width,height}=entry.contentRect;
            if(width>0&&height>0&&(width!==lastWidth||height!==lastHeight)){
              lastWidth=width;lastHeight=height;view.resize();
            }
          });
          resize.observe(host.current);
        } catch (error) {
          console.warn(
            'AutoCare street-map initialization failed',
            error instanceof Error ? error.message : 'Map unavailable',
          );
          fallback();
        }
      })
      .catch((error) => {
        console.warn(
          'AutoCare street-map module unavailable',
          error instanceof Error ? error.message : 'Map unavailable',
        );
        fallback();
      });
    return () => {
      disposed = true;
      window.clearTimeout(fallbackTimer);
      window.clearTimeout(recoveryTimer);
      if(trackUpdate.current!==null)window.clearTimeout(trackUpdate.current);
      trackUpdate.current=null;
      window.cancelAnimationFrame(animationFrame.current);
      resize?.disconnect();
      marker.current?.remove();
      marker.current = null;
      map.current?.remove();
      map.current = null;
    };
  }, [english, history, opened]);
  const previousPositionSegment = useRef<string | undefined>(undefined);
  const turnDistance = useRef(untilTurn);
  turnDistance.current = untilTurn;
  useEffect(() => {
    const view = map.current,
      p = position;
    if (!view || history || contextLost.current) return;
    if(!visible){window.cancelAnimationFrame(animationFrame.current);view.stop();return;}
    if (!p) {
      window.cancelAnimationFrame(animationFrame.current);
      if(active)return;
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
        updateRoadPositionMarker(element,active,p,latest.current);
        marker.current=new lib.Marker({element}).setLngLat([p.longitude,p.latitude]).addTo(view);
        marker.current.setRotationAlignment('map').setRotation(active?cameraBearing.current:0).setPitchAlignment('map');
        marker.current.getElement().style.setProperty('--gps-bearing','0deg');
      });
    }
    const alreadyTracking=wasActive.current;
    if(active&&!alreadyTracking){follow.current=true;setFollowing(true);}
    wasActive.current=active;
    const previousFix=cameraPosition.current;
    const aligned = positionSegment !== undefined && positionSegment === previousPositionSegment.current;
    previousPositionSegment.current = positionSegment;
    const initialHeading=(!alreadyTracking||!previousFix)&&p.speed!=null&&p.speed>=1.5&&p.heading!=null&&Number.isFinite(p.heading)&&p.heading>=0&&p.heading<360;
    const bearing=active?(initialHeading?p.heading!:drivingBearing(previousFix,p,cameraBearing.current)):0;
    cameraPosition.current=p;cameraBearing.current=bearing;
    const from=displayPosition.current??p,fromBearing=alreadyTracking?displayBearing.current:view.getBearing();
    // Explicit low GPS speed holds the visible marker against stationary drift.
    const target=active&&previousFix&&((p.speed!=null&&p.speed<0.7)||(p.speed==null&&segmentMeters(previousFix,p)<Math.max(3,Math.min(12,p.accuracy*.6))))&&
      segmentMeters(from,p)<Math.min(18,p.accuracy+previousFix.accuracy)
      ? {...p,latitude:from.latitude,longitude:from.longitude}:p;
    const startZoom=view.getZoom(),startPitch=view.getPitch();
    const lens=drivingView(p.speed,turnDistance.current);
    const desiredZoom=lens.zoom;
    const zoom=active?(manualZoom.current??(alreadyTracking&&previousFix
      ? startZoom+Math.max(-.4,Math.min(.4,desiredZoom-startZoom)) : desiredZoom)):16;
    const pitch=active&&perspective?Math.min(lens.pitch,renderQuality[effective].pitch):0;
    const begun=performance.now();
    const mapBox=view.getContainer().getBoundingClientRect();
    const cockpit=view.getContainer().closest('.sd-live-cockpit');
    const header=cockpit?.querySelector('.rg-guidance-turn, .sd-destination-toolbar')?.getBoundingClientRect();
    const dock=cockpit?.querySelector('.sd-permanent-bottom:not([hidden])')?.getBoundingClientRect();
    const top=header ? Math.max(0,header.bottom-mapBox.top) : 0;
    const bottom=dock && dock.top>mapBox.top ? Math.max(0,mapBox.bottom-dock.top) : 0;
    const padding=active?drivingInsets(mapBox.height,top,bottom):drivingInsets(0,0,0);
    const {top:initialTop=0,bottom:initialBottom=0,left:initialLeft=0,right:initialRight=0}=view.getPadding();
    const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const angle=Math.abs(((bearing-fromBearing+540)%360)-180);
    const lensChanged=Math.abs(zoom-startZoom)>.005||Math.abs(pitch-startPitch)>.05||
      Math.abs(padding.top-initialTop)+Math.abs(padding.bottom-initialBottom)>1;
    const travel=segmentMeters(from,target);
    const positionDuration=travel>.04?(duration||(!reducedMotion&&previousFix?.timestamp===p.timestamp?400:0)):0;
    const path=active&&positionDuration&&previousFix&&latestRoads.current?.length
      ? matchRecordedRoadLink({...from,timestamp:previousFix.timestamp},target,latestRoads.current)
      : null;
    const sampleRoad=path&&path.length>1?prepareRoadInterpolation(path):null;
    const cameraDuration=cameraSettlingTime(positionDuration,angle,lensChanged,reducedMotion);
    let painted=-Infinity, sampled=begun;
    const draw=(now:number)=>{
      if(map.current!==view||contextLost.current)return;
      const elapsed=now-begun;
      const positionProgress=positionDuration?Math.min(1,elapsed/positionDuration):1;
      const cameraProgress=cameraDuration?Math.min(1,elapsed/cameraDuration):1;
      const final=positionProgress>=1&&cameraProgress>=1;
      const frameMs=now-sampled;sampled=now;
      if(active&&qualityRef.current==='auto'&&renderRef.current==='balanced'&&frameMs<180){
        slowFrames.current=frameMs>38?slowFrames.current+1:Math.max(0,slowFrames.current-1);
        if(slowFrames.current>=16){slowFrames.current=0;setAutomatic('performance');}
      }
      if(!final&&now-painted<renderQuality[effective].cameraMs-.4){
        animationFrame.current=window.requestAnimationFrame(draw);return;
      }
      painted=now;
      const ease=cameraTurnProgress(cameraProgress);
      const point=sampleRoad
        ? {...target,...sampleRoad(positionProgress)}
        : active&&positionProgress<1&&travel>3&&!aligned ? from : interpolateFix(from,target,positionProgress);
      const heading=interpolateAngle(fromBearing,bearing,ease);
      const shown=displayPosition.current;
      if(!shown||shown.longitude!==point.longitude||shown.latitude!==point.latitude||heading!==displayBearing.current)
        marker.current?.setLngLat([point.longitude,point.latitude]).setRotation(heading);
      displayPosition.current=point;displayBearing.current=heading;
      const center=view.getCenter(),currentPadding=view.getPadding();
      const nextPitch=startPitch+(pitch-startPitch)*ease,nextZoom=startZoom+(zoom-startZoom)*ease;
      const nextPadding={top:initialTop+(padding.top-initialTop)*ease,bottom:initialBottom+(padding.bottom-initialBottom)*ease,
        left:initialLeft*(1-ease),right:initialRight*(1-ease)};
      if(follow.current&&(Math.abs(point.latitude-center.lat)>1e-8||Math.abs(point.longitude-center.lng)>1e-8||
        Math.abs(((heading-view.getBearing()+540)%360)-180)>.025||Math.abs(nextPitch-view.getPitch())>.04||
        Math.abs(nextZoom-view.getZoom())>.001||Math.abs(nextPadding.top-(currentPadding.top??0))+Math.abs(nextPadding.bottom-(currentPadding.bottom??0))>.25||
        Math.abs(nextPadding.left-(currentPadding.left??0))+Math.abs(nextPadding.right-(currentPadding.right??0))>.25))
        view.jumpTo({center:[point.longitude,point.latitude],bearing:heading,pitch:nextPitch,zoom:nextZoom,padding:nextPadding});
      if(!final)animationFrame.current=window.requestAnimationFrame(draw);
    };
    animationFrame.current=window.requestAnimationFrame(draw);
    updateRoadPositionMarker(marker.current?.getElement(),active,p,latest.current);
    marker.current?.getElement().style.setProperty('--gps-bearing','0deg');
      }, [position, english, history, active, loading, perspective, cameraRevision, positionSegment, effective, visible]);
  useEffect(() => {
    if(!visible||loading||contextLost.current||trackUpdate.current!==null)return;
    trackUpdate.current=window.setTimeout(()=>{
      trackUpdate.current=null;
      const source=map.current?.getSource('trip') as GeoJSONSource|undefined;
      source?.setData(visualTrackGeometry(latest.current,latestRoads.current));
    },active?425:0);
  }, [points, traceRoads, loading, active, visible, cameraRevision]);
  useEffect(()=>{
    const view=map.current;if(!view||loading||failed)return;
    const profile=renderQuality[effective];
    const ratio=Math.min(window.devicePixelRatio,profile.pixelRatio);
    if(view.getPixelRatio()!==ratio)view.setPixelRatio(ratio);
    for(const layer of view.getStyle().layers){
      const visible=layer.id==='autocare-buildings-3d'?profile.buildings&&perspective
        : layer.type==='symbol'&&/poi/.test(layer.id)?profile.poi:null;
      if(visible!==null)view.setLayoutProperty(layer.id,'visibility',visible?'visible':'none');
    }
  },[effective,perspective,loading,failed]);
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
    const source = map.current?.getSource('directions-alternates') as GeoJSONSource | undefined;
    source?.setData(alternateRouteGeometry(alternateRoutes ?? []));
  }, [alternateRoutes, loading]);
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
    if(view.getLayer('directions-line')){
      view.setPaintProperty('directions-outline','line-color',daylight?'#f2fbfb':'#10232d');
      view.setPaintProperty('directions-line','line-color',daylight?'#006681':'#69d5ed');
      view.setPaintProperty('directions-alternates-line','line-color',daylight?'#607797':'#97a7c9');
    }
    const styled=streetOnlyStyle(view.getStyle(),daylight);
    for(const layer of styled.layers){if(!view.getLayer(layer.id)||['directions','trip'].some(id=>layer.id.startsWith(id)))continue;
      for(const [property,value] of Object.entries(layer.paint||{}))view.setPaintProperty(layer.id,property as keyof AllPaintProperties,value);
    }
  },[daylight,loading,failed]);
  const themeToggle = <button type="button" aria-label={english ? 'Map theme' : 'Tema hărții'} aria-expanded={lightSettings} onClick={() => setLightSettings(open => !open)}>
    {daylight ? <Sun size={18}/> : <Moon size={18}/>}<small>{light.mode === 'auto' ? 'Auto' : daylight ? (english ? 'Day' : 'Zi') : (english ? 'Night' : 'Noapte')}</small>
  </button>;
  const appearance = !history && lightSettings && <section className="sd-map-light" aria-label={english?'Map appearance':'Aspectul hărții'}>
        <label>{english?'Map appearance':'Aspectul hărții'}<select value={light.mode} onChange={event=>updateLight({...light,mode:event.target.value as MapLightSettings['mode']})}>
          <option value="auto">{english?'AutoCare Automatic':'AutoCare Automat'}</option><option value="day">{english?'AutoCare Premium Day':'AutoCare Premium Zi'}</option><option value="night">{english?'AutoCare Premium Night':'AutoCare Premium Noapte'}</option><option value="schedule">{english?'Custom schedule':'Program personalizat'}</option>
        </select></label>
        {!failed&&<label>{english?'Graphics quality':'Calitate grafică'}<select value={quality} onChange={event=>updateQuality(readMapQuality(event.target.value))}>
          <option value="auto">{english?'Automatic':'Automat'}</option><option value="performance">{english?'Performance':'Performanță'}</option>
          <option value="balanced">{english?'Balanced':'Echilibrat'}</option><option value="premium">Premium</option>
        </select></label>}
        {light.mode==='auto'&&<label>{english?'Night starts before sunset':'Noaptea începe înainte de apus'}<select value={light.lead} onChange={event=>updateLight({...light,lead:Number(event.target.value)})}>{[0,10,20,30].map(minutes=><option key={minutes} value={minutes}>{minutes?minutes+' min':english?'At sunset':'La apus'}</option>)}</select></label>}
        {light.mode==='schedule'&&<><label>{english?'Day starts':'Început zi'}<input type="time" required value={light.day} onChange={event=>{if(event.target.value)updateLight({...light,day:event.target.value});}}/></label><label>{english?'Night starts':'Început noapte'}<input type="time" required value={light.night} onChange={event=>{if(event.target.value)updateLight({...light,night:event.target.value});}}/></label></>}
        <button type="button" onClick={()=>setLightSettings(false)}>{english?'Done':'Gata'}</button>
      </section>;
  if (failed) return <div className="rg-map-fallback" data-map-theme={daylight ? 'day' : 'night'}>
    <RasterRoadMap points={points} mappedRoads={traceRoads} position={position} active={active} visible={visible} english={english} history={history} initialArea={initialArea} onAreaChange={onAreaChange} autoPoints={autoPoints} onAutoPoint={onAutoPoint} onLocate={onLocate} locating={locating} locationError={locationError} onDestination={onDestination} plannedRoute={plannedRoute} alternateRoutes={alternateRoutes} onSelectRoute={onSelectRoute} destination={destination} routeStart={routeStart}/>
    {!history && <div className="rg-map-modes">{themeToggle}</div>}
    {appearance}
    <p className="rg-map-fallback-note" role="status">{english ? '2D fallback map' : 'Hartă de rezervă 2D'}</p>
  </div>;
  return (
    <div className="ac-road-map" data-workspace-ui data-map-theme={daylight ? 'day' : 'night'} data-map-quality={effective}>
      <div ref={host} className="ac-road-map-canvas" aria-label={english ? 'Interactive street map' : 'Hartă rutieră interactivă'}/>
      {!history && <div className="rg-map-modes">
        <button type="button" disabled={!renderQuality[effective].pitch} aria-pressed={perspective&&renderQuality[effective].pitch>0}
          aria-label={english ? 'Toggle 2D or 3D' : 'Comută 2D sau 3D'} onClick={() => setPerspective(value => !value)}>
          <Layers size={18}/>{perspective&&renderQuality[effective].pitch>0?'3D':'2D'}
        </button>
        {themeToggle}
      </div>}
      {appearance}
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
          manualZoom.current=null;
          onLocate?.();
          reframeCamera(revision=>revision+1);
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
