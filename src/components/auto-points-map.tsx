'use client';
import { Capacitor } from '@capacitor/core';
import {DriveSessionPanel,type DrivePanelData} from './drive-session-panel';

import dynamic from 'next/dynamic';
import { MapPin,Volume2,VolumeX,ChevronDown,X,SlidersHorizontal,ArrowLeft,MoreHorizontal,History,Bluetooth } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState,type ReactNode } from 'react';
import { autoPointCategories, defaultAutoPointsArea, type AutoPoint, type MapArea } from '@/lib/auto-points';
import { browserGPSFix, latestGPSFix, segmentMeters, type GPSFix } from '@/lib/gps-tracking';
import { guidanceFix, initialGuidanceObservation, navigationProgress, observeGuidance, rerouteDue, routeDisplayFix, type Coordinate, type DrivingRoute } from '@/lib/road-navigation';
import {parseSavedDestinations,rememberDestination,destinationIdentity,type SavedDestination} from '@/lib/drive-destinations';
import {useRoadSpeed} from './use-road-speed';
import {gpsTelemetry} from '@/lib/gps-status';
import './smartdrive-navigation.css';
import './smartdrive-session.css';
import './smartdrive-maps.css';
import { describeDriveManeuver as turnText, driveManeuver } from '@/lib/drive-maneuvers';
import type { RouteVariant } from '@/lib/road-map';
import { DriveManeuverIcon } from './drive-maneuver-icon';
import DriveRoutePreview from './drive-route-preview';
import {driveRouting} from '@/lib/drive-routing';
import { nativeMethodMissing, nativeNavigation } from '@/lib/native-tracking';
import NearbyDrivePlaces from './nearby-drive-places';
import DriveDestinationSearch from './drive-destination-search';
import { getDevicePosition } from '@/lib/device-location';
import { mapLocationError, useMapLocation } from './use-map-location';
import { useApplicationLocale } from './application-locale';

const RoadMap = dynamic(() => import('./road-map'), { ssr: false });
const noRoute: GPSFix[] = [];

export type NavigationSession=DrivePanelData & {now?:number;position:GPSFix|null;points:GPSFix[];meters:number;active:boolean;controls:ReactNode;vehicle:ReactNode;messages?:ReactNode;start:()=>void;stop:()=>void;locate:()=>void};
export default function AutoPointsMap({ preview, visible, ownerId, session,onExit,onView,previewRoute,previewNavigation=false }: { preview: boolean; visible: boolean; ownerId: string;session?:NavigationSession;onExit?:()=>void;onView?:(view:'live'|'history'|'points'|'bluetooth')=>void;previewRoute?:DrivingRoute;previewNavigation?:boolean }) {
  const locale = useApplicationLocale();
  const english = locale.startsWith('en');
  const t = (ro: string, en: string) => english ? en : ro;
  const [androidApk, setAndroidApk] = useState(false);
  useEffect(() => {
    setAndroidApk(Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android');
  }, []);
  const [nativeScreen,setNativeScreen]=useState(false);
  useEffect(()=>{const active=visible&&(androidApk||nativeNavigation.available());setNativeScreen(active);if(!active)return;document.documentElement.dataset.autocareSmartdriveScreen='true';return()=>{delete document.documentElement.dataset.autocareSmartdriveScreen;};},[androidApk,visible]);
  const [recent,setRecent]=useState<SavedDestination[]>([]);
  const [favorites,setFavorites]=useState<SavedDestination[]>([]);
  const placesKey='autocare-destinations:'+ownerId;
  useEffect(()=>{try{const data=JSON.parse(localStorage.getItem(placesKey)||'null');setRecent(parseSavedDestinations(data?.recent));setFavorites(parseSavedDestinations(data?.favorites));}catch{/* Device storage unavailable. */}},[placesKey]);
  function persistPlaces(recent:SavedDestination[],favorites:SavedDestination[]){try{localStorage.setItem(placesKey,JSON.stringify({recent,favorites}));}catch{/* Routing remains available without storage. */}}
  function replaceRecent(next: SavedDestination[]) {
    setRecent(next);
    persistPlaces(next, favorites);
  }
  const [nearby, setNearby] = useState<AutoPoint[]>([]);
  const [area, setArea] = useState<MapArea>(defaultAutoPointsArea);
  const location = useMapLocation(visible && !preview && !session, english);
  const [oneShotPosition, setOneShotPosition] = useState<GPSFix | null>(null);
  const [nativePosition, setNativePosition] = useState<GPSFix | null>(null);
  const position = latestGPSFix(latestGPSFix(latestGPSFix(location.position, oneShotPosition), nativePosition),session?.position??null);
  const requestLocate=session?.locate||location.locate;
  const [audioMode, setAudioMode] = useState<'off' | 'alerts' | 'full'>('off');
  const muted = audioMode !== 'full';
  const currentMute = useRef(true);
  const [nativeVoice,setNativeVoice]=useState(false);
  const [voiceError,setVoiceError]=useState("");
  const [details,setDetails]=useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [searchFocused,setSearchFocused]=useState(false);
  const [mapClock,setMapClock]=useState(()=>Date.now());
  const ownsClock=session?.now===undefined;
  const now=session?.now??mapClock;
  const spoken=useRef('');
  useEffect(()=>{if(!visible||!ownsClock)return;setMapClock(Date.now());const timer=setInterval(()=>setMapClock(Date.now()),2000);return()=>clearInterval(timer);},[visible,ownsClock]);
  const [background, setBackground] = useState<'idle' | 'active' | 'upgrade' | 'blocked'>('idle');
  const wantsNavigation = useRef(false);
  const [locationError, setLocationError] = useState('');
  const [findingLocation, setFindingLocation] = useState(false);
  const [destination, setDestination] = useState<(Coordinate & { name?: string; details?: string }) | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [routes, setRoutes] = useState<DrivingRoute[]>(preview&&previewRoute?[previewRoute]:[]);
  const [alternative, setAlternative] = useState(0);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [navigating, setNavigating] = useState(preview&&previewNavigation);
  const [stepIndex, setStepIndex] = useState(0);
  useEffect(()=>{if(!visible)return;document.documentElement.dataset.autocareNavigationActive=String(navigating);if(navigating){setSearchOpen(false);setDetails(false);}return()=>{delete document.documentElement.dataset.autocareNavigationActive;};},[visible,navigating]);
  const routingRequest = useRef<AbortController | null>(null);
  const routeCard = useRef<HTMLElement>(null);
  const bottomPanel=useRef<HTMLElement>(null);
  const root=useRef<HTMLElement>(null);
  useLayoutEffect(()=>{
    if(!visible)return;
    const resize=()=>{const node=root.current;if(!node)return;const viewport=window.visualViewport;const bottom=(viewport?.height??window.innerHeight)+(viewport?.offsetTop??0);const dock=document.querySelector('.rg-mobile-dock');const rect=dock?.getBoundingClientRect();const reserve=rect&&rect.height>0&&rect.top<bottom?bottom-rect.top:0;const mobile=window.matchMedia('(max-width:900px)').matches;node.style.height=mobile&&navigating?bottom+'px':Math.max(260,bottom-Math.max(0,node.getBoundingClientRect().top)-reserve-(mobile?0:12))+'px'};
    resize();window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);return()=>{window.removeEventListener('resize',resize);window.visualViewport?.removeEventListener('resize',resize)};
  },[visible,navigating]);
  useEffect(()=>{const panel=bottomPanel.current;if(!panel)return;const resize=new ResizeObserver(()=>root.current?.style.setProperty('--nav-bottom-height',panel.getBoundingClientRect().height+'px'));resize.observe(panel);return()=>resize.disconnect()},[]);
  const destinationRevision = useRef(0);
  const locationRevision = useRef(0);
  const lastReroute = useRef(0);
  const observations = useRef(initialGuidanceObservation);
  const guidanceAnchor = useRef<GPSFix | null>(null);
  const [arrived, setArrived] = useState(false);
  const [offRoute, setOffRoute] = useState(false);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);
  const distance = (meters: number) => meters >= 1000 ? `${(meters / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km` : `${Math.round(meters)} m`;

  useEffect(() => () => {
    wantsNavigation.current = false;
    ++locationRevision.current;
    routingRequest.current?.abort();
    if (nativeNavigation.available()) void nativeNavigation.stop(ownerId).catch(() => {});
  }, [ownerId]);

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
    requestLocate();
    getDevicePosition(value => {
      if (revision !== locationRevision.current) return;
      setFindingLocation(false);
      const next = browserGPSFix(value);
      if (!next) { setLocationError(mapLocationError(0, english)); return; }
      setOneShotPosition(next);
      setLocationError('');
      requestLocate();
      after(next);
    }, failure => {
      if (revision !== locationRevision.current) return;
      setFindingLocation(false);
      setLocationError(mapLocationError(failure.code, english));
    });
  }

  async function plan(start: GPSFix, end: Coordinate, startGuidance = false) {
    if (start.accuracy <= 0 || start.accuracy > 500 || Date.now() - start.timestamp > 20000) {
      setRouteError(t('Așteaptă o poziție GPS recentă și mai precisă.', 'Wait for a recent, more accurate GPS position.'));
      return;
    }
    routingRequest.current?.abort();
    const controller = new AbortController();
    routingRequest.current = controller;
    setRouting(true);
    setRouteError('');
    try {
      const value=await driveRouting.directions(start,end,Math.round(start.accuracy),controller.signal);
      if (controller.signal.aborted) return;
      setRoutes(value);
      spoken.current = '';
      setAlternative(0);
      setStepIndex(0);
      observations.current = initialGuidanceObservation;
      setOffRoute(false);
      if (startGuidance) {
        setNavigating(true);
        lastReroute.current = 0;
        requestLocate();
      }
    } catch (failure) {
      if (!controller.signal.aborted) setRouteError(nativeMethodMissing(failure)?t('Actualizează aplicația Android pentru SmartDrive GPS 4.0.','Update the Android app for SmartDrive GPS 4.0.'):t('Traseul nu este disponibil momentan. Reîncearcă.','The route is temporarily unavailable. Please retry.'));
    } finally {
      if (!controller.signal.aborted) setRouting(false);
    }
  }

  const lastDestination=useRef<Coordinate & {name?:string;details?:string} | null>(null);
  function stopGuidance(change=false) {
    if(destination)lastDestination.current=destination;
    wantsNavigation.current=false;
    ++destinationRevision.current;
    ++locationRevision.current;
    routingRequest.current?.abort();
    observations.current = initialGuidanceObservation;
    setArrived(false);
    guidanceAnchor.current = null;
    setOffRoute(false);
    spoken.current='';
    setStepIndex(0);
    setNavigating(false);
    setDestination(null);
    setRoutes([]);
    setRouting(false);
    setFindingLocation(false);
    setRouteError('');
    setLocationError('');
    setDetails(false);
    setSelecting(false);
    setSearchOpen(change);
    if('speechSynthesis' in window)window.speechSynthesis.cancel();
  }

  function choose(point: Coordinate & { name?: string; details?: string }, startGuidance = false) {
    const revision = ++destinationRevision.current;
    routingRequest.current?.abort();
    setRouting(false);
    setSelecting(false);
    setSearchOpen(false);setDetails(false);
    setNavigating(false);
    setArrived(false);
    guidanceAnchor.current = null;
    setOffRoute(false);
    observations.current = initialGuidanceObservation;
    setDestination(point);
    const entry={...point,name:point.name||t('Punct ales pe hartă','Point selected on map')};
    replaceRecent(rememberDestination(recent, entry));
    setRoutes([]);
    setRouteError('');
    setLocationError('');
    setFindingLocation(false);
    ++locationRevision.current;
    if (position && position.accuracy <= 500 && Date.now() - position.timestamp < 10000) void plan(position, point, startGuidance);
    else locate(fix => { if (revision === destinationRevision.current) void plan(fix, point, startGuidance); });

  }

  const route = routes[alternative];
  const alternatives = useMemo<RouteVariant[]>(() => navigating ? [] : routes.flatMap(
    (option, index) => index === alternative ? [] : [{ index, coordinates: option.geometry.coordinates }],
  ), [routes, alternative, navigating]);
  function selectRoute(index: number) {
    if (navigating || !routes[index] || index === alternative) return;
    setAlternative(index);
    setStepIndex(0);
    observations.current = initialGuidanceObservation;
    lastReroute.current = Date.now();
  }
  function clearDestination() {
    ++destinationRevision.current;
    ++locationRevision.current;
    routingRequest.current?.abort();
    setFindingLocation(false);
    setRouting(false);
    setRoutes([]);
    setDestination(null);
    setRouteError('');
    setLocationError('');
  }
  const routeStart = route?.geometry.coordinates[0];
  const destinationName = destination?.name;
  wantsNavigation.current = navigating && !arrived;
  useEffect(() => {
    if (!nativeNavigation.available() || preview) return;
    if (!navigating || arrived || !route) {
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
    void nativeNavigation.start(ownerId, destinationName || t('Navigație AutoCare', 'AutoCare navigation'), english, steps, currentMute.current)
      .then(() => {
        if (!wantsNavigation.current) { void nativeNavigation.stop(ownerId).catch(() => {}); return; }
        if (live) { subscribed = true; setBackground('active'); }
      }).catch(failure => {
        if (live) setBackground(nativeMethodMissing(failure) ? 'upgrade' : 'blocked');
      });
    let snapshotBusy = false;
    const refresh = async () => {
      if (!live || !subscribed || snapshotBusy || document.visibilityState !== 'visible') return;
      snapshotBusy = true;
      try {
        const state = await nativeNavigation.snapshot(ownerId);
        if (!live) return;
        if (!state.active) { setNavigating(false); return; }
        const fix = state.position;
        if (fix) setNativePosition(previous => previous?.timestamp === fix.timestamp ? previous : fix);
      } catch { /* Browser GPS remains available in the foreground. */ } finally { snapshotBusy = false; }
    };
    const timer = window.setInterval(() => void refresh(), 1200);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [navigating, arrived, route, destinationName, english, ownerId, preview]);

  const searchPosition = position && position.accuracy <= 500 && Date.now() - position.timestamp < 20000 ? position : null;
  const anchor = guidanceAnchor.current;
  const delta = position && anchor ? position.timestamp - anchor.timestamp : null;
  const precisePosition = guidanceFix(position, Math.max(now, Date.now())) &&
    (delta === null || delta === 0 || (delta > 0 && anchor && segmentMeters(anchor, position) <= 70 * delta / 1000 + anchor.accuracy + position.accuracy))
    ? position : null;
  useEffect(() => { if (precisePosition && navigating) guidanceAnchor.current = precisePosition; }, [precisePosition, navigating]);
  const match = useMemo(() => navigating && !arrived && route && precisePosition
    ? navigationProgress(route, precisePosition, stepIndex, precisePosition) : null,
  [navigating, arrived, route, precisePosition, stepIndex]);
  useEffect(() => {
    if (!match || !precisePosition || !destination || preview) return;
    const previous = observations.current;
    const observed = observeGuidance(previous, precisePosition, match, destination);
    if (observed !== previous) {
      observations.current = observed;
      setOffRoute(observed.offRouteFixes >= 2);
      if (observed.arrivalFixes >= 2) { setArrived(true); return; }
      if (match.gap <= Math.min(22, precisePosition.accuracy + 6) && match.index > stepIndex && match.index <= stepIndex + 2)
        setStepIndex(match.index);
    }
    const now = Date.now();
    if (rerouteDue(observed, now, lastReroute.current, online, routing)) {
      lastReroute.current = now;
      void plan(precisePosition, destination);
    }
  }, [match, precisePosition, destination, stepIndex, online, routing, preview]);

  const progress = match && !offRoute && match.gap <= Math.max(35, (precisePosition?.accuracy ?? 0) * 2) ? match : null;
  const displayPosition = useMemo(() => {
    if (!navigating) return position;
    if (!precisePosition) return null;
    return progress ? routeDisplayFix(precisePosition, progress, stepIndex) : precisePosition;
  }, [navigating, progress, precisePosition, position, stepIndex]);
  const lanes = progress?.next?.intersections?.find(intersection => intersection.lanes?.some(lane => lane.valid))?.lanes;
  const positionSegment = displayPosition !== precisePosition ? progress?.segmentKey : undefined;
  const chooseNearby = (point: AutoPoint) => choose({
    latitude: point.latitude, longitude: point.longitude,
    name: point.name || (english ? autoPointCategories[point.category].english : autoPointCategories[point.category].label),
    details: point.address,
  });
  const telemetry=gpsTelemetry(position,now);
  const nativeTelemetry=gpsTelemetry(latestGPSFix(nativePosition,session?.position??null),now);
  const speed=nativeTelemetry.speed??telemetry.speed??(telemetry.fresh&&telemetry.accuracy!==null&&telemetry.accuracy<=50?session?.speed??null:null);
  const roadSpeed=useRoadSpeed(telemetry.fresh && position && now-position.timestamp<8000 ? position : null,speed,androidApk&&visible&&!preview&&(navigating||session?.state==='active'));
  const speak = (message: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = english ? 'en-GB' : 'ro-RO';
    window.speechSynthesis.speak(utterance);
  };
  const voiceText=progress?.next?[turnText(progress.next.maneuver,english),progress.next.name].filter(Boolean).join(' · '):'';
  useEffect(()=>{
    if(nativeVoice||muted||!navigating||!progress||progress.untilTurn>300||progress.gap>45||!voiceText||!('speechSynthesis' in window))return;
    const key=progress.index+':'+voiceText;if(spoken.current===key)return;
    spoken.current=key;speak(voiceText);

  },[nativeVoice,muted,navigating,progress?.index,progress?.untilTurn,progress?.gap,voiceText,english]);
  useEffect(()=>{if((muted||!navigating)&&'speechSynthesis' in window)window.speechSynthesis.cancel();return()=>{if('speechSynthesis' in window)window.speechSynthesis.cancel()}},[muted,navigating]);
  useEffect(()=>{
    if(background!=='active'||!navigating){setNativeVoice(false);return;}
    let live=true;
    const timer=window.setTimeout(()=>{
      void nativeNavigation.audio(ownerId,muted).then(()=>{
        if(live){setNativeVoice(true);window.speechSynthesis?.cancel();}
      }).catch(error=>{if(live&&!nativeMethodMissing(error)&&!muted)setVoiceError(english?'Android voice is still initializing.':'Vocea Android este în curs de inițializare.');});
    },350);
    return()=>{live=false;window.clearTimeout(timer);};
  },[background,navigating,muted,ownerId,english]);
  useEffect(() => {
    if (!navigating || audioMode === 'off' || preview || (audioMode === 'full' && nativeVoice)) return;
    if (arrived) speak(t('Ai ajuns la destinație.', 'You have arrived.'));
    else if (routing && offRoute) speak(t('Se recalculează traseul.', 'Rerouting.'));
  }, [arrived, routing, offRoute, navigating, audioMode, preview]);
  const minutes=progress?Math.ceil(progress.seconds/60):!navigating&&route?Math.ceil(route.duration/60):null;
  const remaining=navigating?progress?.distance:route?.distance;
  const eta=progress&&navigating?new Date(Date.now()+progress.seconds*1000).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}):null;
  const nextTurn=arrived||routing?undefined:progress?.next;
  const exit=driveManeuver(nextTurn?.maneuver).exit;
  const sign=nextTurn&&(nextTurn.exits||nextTurn.destinations)
    ? [nextTurn.exits&&t('Ieșire ','Exit ')+nextTurn.exits,nextTurn.ref,nextTurn.destinations].filter(Boolean).join(' · ')
    : '';

  return <section ref={root} className="rg-smartdrive-map sd-live-cockpit" data-native-fullscreen={nativeScreen} data-android-apk={androidApk} data-guiding={navigating} data-gps-fresh={!!precisePosition} data-search-open={searchOpen} data-typing={searchFocused} aria-label="SmartDrive GPS">
    <div className="rg-navigation-layout" data-sidebar-open={searchOpen||details}>
      <div className="rg-navigation-canvas">
        <RoadMap visible={visible} points={session?.points||noRoute} position={displayPosition} active={navigating||(!destination&&session?.state==='active')} english={english}
          initialArea={defaultAutoPointsArea} onAreaChange={setArea} onLocate={preview?undefined:requestLocate}
          locating={findingLocation||location.waiting} locationError={locationError||location.error}
          autoPoints={navigating || !searchOpen ? undefined : nearby} onAutoPoint={id => { const point = nearby.find(result => result.id === id); if (point) chooseNearby(point); }}
          positionSegment={positionSegment} mappedRoads={roadSpeed.roads} untilTurn={progress?.untilTurn} plannedRoute={route?.geometry.coordinates} alternateRoutes={alternatives} onSelectRoute={selectRoute} destination={destination} routeStart={routeStart} onDestination={selecting?choose:undefined}/>
        {nativeScreen&&<>{!navigating&&<button type="button" className="rg-navigation-back" aria-label={t('Înapoi în AutoCare','Back to AutoCare')} onClick={onExit}><ArrowLeft size={20}/></button>}<details className="rg-navigation-tools"><summary aria-label={t('Meniu SmartDrive','SmartDrive menu')}><MoreHorizontal size={20}/></summary><div><button type="button" onClick={()=>onView?.('history')}><History size={17}/>{t('Istoric trasee','Trip history')}</button><button type="button" onClick={()=>onView?.('bluetooth')}><Bluetooth size={17}/>Bluetooth</button><label className="sd-speed-preference">{t('Avertizare limită de viteză','Speed limit warning')}
          <select value={roadSpeed.mode} onChange={event=>void roadSpeed.changeMode(event.target.value as typeof roadSpeed.mode)}>
            <option value="off">{t('Dezactivată','Off')}</option><option value="visual">{t('Vizuală','Visual')}</option><option value="sound">{t('Vizuală și sonoră','Visual and sound')}</option>
          </select></label></div></details></>}
        {!navigating&&nativeScreen&&<div className="sd-android-title"><MapPin size={17}/>SmartDrive GPS</div>}
        {!navigating&&<div className="sd-destination-toolbar"><DriveDestinationSearch area={searchPosition??area} nearPosition={!!searchPosition} disabled={preview} english={english} recent={recent} favorites={favorites}
          onRemoveRecent={p=>replaceRecent(recent.filter(entry=>destinationIdentity(entry)!==destinationIdentity(p)))}
          onClearRecent={()=>replaceRecent([])} onFocusChange={focused=>{setSearchFocused(focused);if(focused)setSearchOpen(false);}} onChoose={point=>choose(point)}/><button type="button" className="sd-destination-settings" hidden={searchFocused} aria-label={t('Destinații și vehicul','Destinations and vehicle')} aria-expanded={searchOpen} onClick={()=>setSearchOpen(v=>!v)}><SlidersHorizontal size={23}/></button></div>}
        {navigating && <div className="rg-guidance-turn" aria-label={t('Următoarea manevră','Next maneuver')}>
          <span className="sd-maneuver-symbol" aria-hidden="true">
            <DriveManeuverIcon turn={arrived ? {type:'arrive'} : nextTurn?.maneuver} size={43}/>
            {exit&&<b>{exit}</b>}
          </span>
          <div className="sd-maneuver-copy">
            <strong>{arrived ? t('Ai ajuns', 'You arrived') : progress && !routing ? distance(progress.untilTurn) :
              routing ? t('Se recalculează', 'Rerouting') : offRoute ? t('În afara traseului', 'Off route') :
              precisePosition?t('Urmează traseul', 'Follow the route'):t('GPS indisponibil', 'GPS unavailable')}</strong>
            {!precisePosition && !arrived && <small>{t('Se așteaptă o poziție confirmată', 'Waiting for a confirmed fix')}</small>}
            {nextTurn&&<span className="sd-maneuver-instruction" aria-live="polite">{turnText(nextTurn.maneuver, english)}</span>}
            {nextTurn?.name&&<small className="sd-maneuver-street" data-user-content>{nextTurn.name}</small>}
            {sign&&<small className="sd-road-sign" data-user-content>{sign}</small>}
            {nextTurn&&lanes&&progress&&progress.untilTurn<350&&<div className="sd-turn-lanes" aria-label={t('Benzi recomandate', 'Recommended lanes')}>
              {lanes.map((lane,index)=>{
                const directions=[...new Set(lane.indications)].flatMap(indication=>{
                  const turn={type:'turn',modifier:indication,location:nextTurn.maneuver.location};
                  return driveManeuver(turn).kind==='unknown'?[]:[turn];
                });
                return <span key={index} data-valid={lane.valid} aria-label={[
                  lane.valid?t('Bandă recomandată','Recommended lane'):t('Altă bandă','Other lane'),
                  ...directions.map(turn=>turnText(turn,english)),
                ].join(' · ')}>
                  {directions.length?directions.map(turn=><DriveManeuverIcon key={turn.modifier} turn={turn} size={15}/>):<DriveManeuverIcon size={15}/>}
                </span>;
              })}
            </div>}
            {nextTurn&&progress?.following&&progress.untilTurn<250&&nextTurn.distance<180&&
              <small className="sd-maneuver-following"><DriveManeuverIcon turn={progress.following.maneuver} size={17}/>{t('Apoi', 'Then')} · {turnText(progress.following.maneuver, english)}</small>}
          </div>
        </div>}
        {androidApk && <div className="rg-navigation-speed" data-over-limit={roadSpeed.over} aria-label={t('Viteza GPS','GPS speed')}>
          <strong>{speed ?? '—'}</strong><span>km/h</span>
          <div className="sd-speed-sign" data-unknown={roadSpeed.limit===null} aria-label={roadSpeed.limit===null?t('Limită de viteză necunoscută','Unknown speed limit'):t(`Limită informativă: ${roadSpeed.limit} km/h. Respectă indicatoarele rutiere.`,`Advisory limit: ${roadSpeed.limit} km/h. Follow road signs.`)}>{roadSpeed.limit??'—'}</div>
        </div>}
        <button className="rg-navigation-audio" type="button" aria-label={audioMode === 'off' ? t('Mod audio: silențios', 'Audio mode: muted') : audioMode === 'alerts' ? t('Mod audio: doar alerte', 'Audio mode: alerts only') : t('Mod audio: ghidare vocală', 'Audio mode: voice guidance')}
          title={audioMode === 'off' ? t('Silențios', 'Muted') : audioMode === 'alerts' ? t('Doar alerte', 'Alerts only') : t('Ghidare vocală', 'Voice guidance')}
          onClick={() => {
            const next = audioMode === 'off' ? 'full' : audioMode === 'full' ? 'alerts' : 'off';
            currentMute.current = next !== 'full'; setAudioMode(next); setVoiceError(''); spoken.current = '';
          }}>
          {audioMode === 'off' ? <VolumeX size={22}/> : <Volume2 size={22}/>}
          {audioMode === 'alerts' && <span aria-hidden="true">!</span>}
        </button>
      </div>
      <section ref={bottomPanel} className="sd-permanent-bottom" hidden={searchFocused}>
        {!navigating && destination && <DriveRoutePreview destination={destination} routes={routes} selected={alternative} english={english}
          pending={routing||findingLocation} error={routeError||locationError}
          disabled={preview} onSelect={selectRoute} onClose={clearDestination}
          onStart={()=>{setNavigating(true);requestLocate();lastReroute.current=0}}/>}
        {navigating && <div className="sd-route-strip">
          <div className="sd-route-arrival">
            <strong aria-label={t('Ora estimată a sosirii', 'Estimated arrival')}>{eta ?? '—'}</strong>
            <span>{progress ? `${minutes} min · ${remaining != null ? distance(remaining) : '—'}` :
              !online ? t('Fără internet', 'Offline') : arrived ? t('Destinație atinsă', 'Destination reached') : t('Estimare indisponibilă', 'Estimate unavailable')}</span>
          </div>
          <button type="button" aria-label={t('Detalii traseu', 'Route details')} aria-expanded={details} onClick={() => setDetails(value => !value)}><ChevronDown size={20}/></button>
          <button type="button" className="sd-stop-guidance" onClick={() => stopGuidance()}><X size={16}/>{arrived ? t('Închide', 'Close') : t('Oprește', 'Stop')}</button>
        </div>}
        {session && !navigating && !destination && <DriveSessionPanel session={session} english={english} compact={androidApk} suspendDetails={searchFocused} vehicleSelector={androidApk ? session.vehicle : undefined}/>}
        {(!destination||navigating)&&(routeError||locationError)&&<p role="alert">{routeError||locationError}</p>}
      </section>
      <aside className="rg-navigation-sidebar" data-open={searchOpen||details} ref={routeCard}>
        <header><span>SMARTDRIVE</span><h2>{navigating ? t('Detalii traseu', 'Route details') : t('Unde mergem?','Where to?')}</h2><button type="button" aria-label={t('Închide panoul','Close panel')} onClick={()=>{setSearchOpen(false);setDetails(false);}}><X size={20}/></button></header>
        {navigating&&audioMode==='full'&&background==='active'&&<button type="button" onClick={()=>void nativeNavigation.audio(ownerId,muted,true).then(()=>setVoiceError('')).catch(()=>setVoiceError(t('Vocea nu este disponibilă. Verifică motorul vocal și limba din setările Android.','Voice is unavailable. Check the speech engine and language in Android settings.')))}>{t('Testează vocea','Test voice')}</button>}
        {navigating&&voiceError&&<p role="status">{voiceError}</p>}
        {navigating && speed != null && speed < 5 &&<button type="button" onClick={()=>stopGuidance(true)}>{t('Schimbă destinația','Change destination')}</button>}
        {!navigating&&!destination&&lastDestination.current&&<button type="button" onClick={()=>{const point=lastDestination.current;if(point)choose(point,true);}}>{t('Reia navigația','Resume navigation')}</button>}
        {navigating && details && session && <DriveSessionPanel session={session} english={english} compact={androidApk} vehicleSelector={session.vehicle}/>}
        {!androidApk && !navigating && session?.vehicle}
        {!navigating&&favorites.length>0&&<div className="rg-saved-places"><small>{t('Favorite · pe acest dispozitiv','Favorites · on this device')}</small>{favorites.map(point=><div key={point.kind+':'+destinationIdentity(point)}><button type="button" onClick={()=>choose(point)}>{point.kind==='home'?t('Acasă','Home'):point.kind==='work'?t('Serviciu','Work'):point.name}</button><button type="button" aria-label={t('Elimină favorita','Remove favorite')} onClick={()=>setFavorites(previous=>{const next=previous.filter(p=>p!==point);persistPlaces(recent,next);return next})}>×</button></div>)}</div>}
        {!navigating && searchOpen && !preview && <NearbyDrivePlaces area={area} position={searchPosition} english={english} onResults={setNearby} onChoose={chooseNearby}/>}
        {!navigating && <button type="button" disabled={preview} aria-pressed={selecting} onClick={()=>setSelecting(v=>!v)}><MapPin size={16}/>{t('Alege pe hartă','Pick on map')}</button>}
        {selecting&&<p role="status">{t('Atinge harta pentru destinație.','Tap the map for your destination.')}</p>}
        {destination&&<div className="rg-navigation-destination"><small>{t('DESTINAȚIE','DESTINATION')}</small><strong data-user-content>{destination.name||t('Punct ales pe hartă','Point selected on map')}</strong><p data-user-content>{destination.details}</p>
          {!route&&!routing&&<button type="button" onClick={()=>choose(destination)}>{t('Calculează traseul','Calculate route')}</button>}
          {!navigating&&<><div className="rg-place-save">{(['home','work','favorite'] as const).map(kind=><button type="button" key={kind} onClick={()=>setFavorites(previous=>{const entry={...destination,name:destination.name||t('Destinație','Destination'),kind};const next=[entry,...previous.filter(p=>kind==='favorite'?destinationIdentity(p)!==destinationIdentity(entry):p.kind!==kind)].slice(0,8);persistPlaces(recent,next);return next})}>{kind==='home'?t('Salvează Acasă','Set Home'):kind==='work'?t('Salvează Serviciu','Set Work'):t('Adaugă la favorite','Add favorite')}</button>)}</div><a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`}>Google Maps</a><a target="_blank" rel="noopener noreferrer" href={`https://waze.com/ul?ll=${destination.latitude},${destination.longitude}&navigate=yes`}>Waze</a><button type="button" onClick={clearDestination}>{t('Șterge destinația','Clear destination')}</button></>}
        </div>}
        <p className="rg-navigation-limit" role="status">{background==='upgrade'?t('Actualizează aplicația Android pentru ghidare nativă în fundal.','Update the Android app for native background guidance.'):background==='active'?t('Ghidare nativă activă în fundal.','Native background guidance active.'):t('În browser, păstrează pagina deschisă. Localizarea în fundal poate fi suspendată.','Keep the page open in a browser. Background location may be suspended.')}</p>
      </aside>
    </div>
  </section>;
}
