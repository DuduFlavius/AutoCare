'use client';
import { Capacitor } from '@capacitor/core';
import {DriveSessionPanel,type DrivePanelData} from './drive-session-panel';
import {FilterSelect} from './filter-select';

import dynamic from 'next/dynamic';
import { ArrowUp, MapPin, Navigation,Volume2,VolumeX,ChevronDown,RotateCw,X,SlidersHorizontal,ArrowLeft,MoreHorizontal,History,Bluetooth,Flag } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState,type ReactNode } from 'react';
import { defaultAutoPointsArea, type MapArea } from '@/lib/auto-points';
import { browserGPSFix, latestGPSFix, type GPSFix } from '@/lib/gps-tracking';
import { navigationProgress, routeDisplayFix, type Coordinate, type DrivingRoute, type Turn } from '@/lib/road-navigation';
import {parseSavedDestinations,rememberDestination,destinationIdentity,type SavedDestination} from '@/lib/drive-destinations';
import {gpsTelemetry} from '@/lib/gps-status';
import './smartdrive-navigation.css';
import './smartdrive-session.css';
import {driveRouting} from '@/lib/drive-routing';
import { nativeMethodMissing, nativeNavigation } from '@/lib/native-tracking';
import DriveDestinationSearch from './drive-destination-search';
import { getDevicePosition } from '@/lib/device-location';
import { mapLocationError, useMapLocation } from './use-map-location';
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

export type NavigationSession=DrivePanelData & {position:GPSFix|null;points:GPSFix[];meters:number;active:boolean;controls:ReactNode;vehicle:ReactNode;messages?:ReactNode;start:()=>void;stop:()=>void;locate:()=>void};
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
  const [area, setArea] = useState<MapArea>(defaultAutoPointsArea);
  const location = useMapLocation(visible && !preview && !session, english);
  const [oneShotPosition, setOneShotPosition] = useState<GPSFix | null>(null);
  const [nativePosition, setNativePosition] = useState<GPSFix | null>(null);
  const position = latestGPSFix(latestGPSFix(latestGPSFix(location.position, oneShotPosition), nativePosition),session?.position??null);
  const requestLocate=session?.locate||location.locate;
  const [muted,setMuted]=useState(true);
  const [details,setDetails]=useState(false);
  const [searchOpen,setSearchOpen]=useState(false);
  const [searchFocused,setSearchFocused]=useState(false);
  const [now,setNow]=useState(()=>Date.now());
  const spoken=useRef('');
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),4000);return()=>clearInterval(timer)},[]);
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
  const deviation = useRef(0);
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
      const value=await driveRouting.directions(start,end,Math.round(start.accuracy),controller.signal);
      if (controller.signal.aborted) return;
      setRoutes(value);
      setAlternative(0);
      setStepIndex(0);
      deviation.current = 0;
      if (startGuidance) {
        setNavigating(true);
        lastReroute.current = Date.now();
        requestLocate();
      }
    } catch (failure) {
      if (!controller.signal.aborted) setRouteError(nativeMethodMissing(failure)?t('Actualizează aplicația Android pentru SmartDrive GPS 4.0.','Update the Android app for SmartDrive GPS 4.0.'):t('Traseul nu este disponibil momentan. Reîncearcă.','The route is temporarily unavailable. Please retry.'));
    } finally {
      if (!controller.signal.aborted) setRouting(false);
    }
  }

  function choose(point: Coordinate & { name?: string; details?: string }, startGuidance = false) {
    const revision = ++destinationRevision.current;
    routingRequest.current?.abort();
    setRouting(false);
    setSelecting(false);
    setSearchOpen(false);setDetails(false);
    setNavigating(false);
    setDestination(point);
    const entry={...point,name:point.name||t('Punct ales pe hartă','Point selected on map')};
    setRecent(previous=>{const next=rememberDestination(previous,entry);persistPlaces(next,favorites);return next});
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
  const precisePosition = position && position.accuracy <= 50 && now - position.timestamp <= 15000 ? position : null;
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

  const displayPosition=useMemo(()=>progress&&precisePosition?routeDisplayFix(precisePosition,progress,stepIndex):position,[progress,precisePosition,position,stepIndex]);
  const ManeuverIcon=progress?.next?.maneuver.exit?RotateCw:ArrowUp;
  const arrived = !!progress && progress.distance < 35 && progress.gap < 30;
  const telemetry=gpsTelemetry(position,now);
  const voiceText=progress?.next?[turnText(progress.next.maneuver,english),progress.next.name].filter(Boolean).join(' · '):'';
  useEffect(()=>{
    if(muted||!navigating||!progress||progress.untilTurn>300||!voiceText||!('speechSynthesis' in window))return;
    const key=progress.index+':'+voiceText;if(spoken.current===key)return;
    spoken.current=key;const utterance=new SpeechSynthesisUtterance(voiceText);utterance.lang=english?'en-GB':'ro-RO';window.speechSynthesis.speak(utterance);

  },[muted,navigating,progress?.index,progress?.untilTurn,voiceText,english]);
  useEffect(()=>{if((muted||!navigating)&&'speechSynthesis' in window)window.speechSynthesis.cancel();return()=>{if('speechSynthesis' in window)window.speechSynthesis.cancel()}},[muted,navigating]);
  const minutes=progress?Math.ceil(progress.seconds/60):!navigating&&route?Math.ceil(route.duration/60):null;
  const remaining=navigating?progress?.distance:route?.distance;
  const eta=progress&&navigating?new Date(Date.now()+progress.seconds*1000).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'}):null;
  return <section ref={root} className="rg-smartdrive-map sd-live-cockpit" data-native-fullscreen={nativeScreen} data-android-apk={androidApk} data-guiding={navigating} data-search-open={searchOpen} aria-label="SmartDrive GPS">
    <div className="rg-navigation-layout" data-sidebar-open={searchOpen||details}>
      <div className="rg-navigation-canvas">
        <RoadMap points={session?.points||noRoute} position={displayPosition} active={navigating||session?.state==='active'} english={english}
          initialArea={defaultAutoPointsArea} onAreaChange={setArea} onLocate={preview?undefined:requestLocate}
          locating={findingLocation||location.waiting} locationError={locationError||location.error}
          untilTurn={progress?.untilTurn} plannedRoute={route?.geometry.coordinates} destination={destination} routeStart={routeStart} onDestination={selecting?choose:undefined}/>
        {!navigating&&nativeScreen&&<><button type="button" className="rg-navigation-back" aria-label={t('Înapoi în AutoCare','Back to AutoCare')} onClick={onExit}><ArrowLeft size={20}/></button><details className="rg-navigation-tools"><summary aria-label={t('Meniu SmartDrive','SmartDrive menu')}><MoreHorizontal size={20}/></summary><div><button type="button" onClick={()=>onView?.('history')}><History size={17}/>{t('Istoric trasee','Trip history')}</button><button type="button" onClick={()=>onView?.('bluetooth')}><Bluetooth size={17}/>Bluetooth</button></div></details></>}
        {!navigating&&nativeScreen&&<div className="sd-android-title"><MapPin size={17}/>SmartDrive GPS</div>}
        {!navigating&&<div className="sd-destination-toolbar"><DriveDestinationSearch area={searchPosition??area} nearPosition={!!searchPosition} disabled={preview} english={english} recent={recent} onFocusChange={setSearchFocused} onChoose={point=>choose(point)}/><button type="button" className="sd-destination-settings" aria-label={t('Destinații și vehicul','Destinations and vehicle')} aria-expanded={searchOpen} onClick={()=>setSearchOpen(v=>!v)}><SlidersHorizontal size={23}/></button></div>}
        {navigating&&<button type="button" className="rg-navigation-exit" aria-label={t('Încheie navigația, păstrează înregistrarea','End navigation, keep recording')} onClick={()=>{setNavigating(false);setStepIndex(0);}}><X size={21}/></button>}
        {navigating&&<div className="rg-guidance-turn" role="status"><ManeuverIcon size={30} style={{rotate:progress?.next?.maneuver.modifier?.includes('left')?'-90deg':progress?.next?.maneuver.modifier?.includes('right')?'90deg':undefined}}/><div><strong>{arrived?t('Ai ajuns','You arrived'):progress?distance(progress.untilTurn):t('Se caută semnal GPS precis…','Waiting for accurate GPS…')}</strong><span>{progress?.next?turnText(progress.next.maneuver,english):t('Urmează traseul','Follow the route')}</span><small>{progress?.next?.name}</small></div><button type="button" aria-expanded={details} onClick={()=>setDetails(v=>!v)}><ChevronDown size={20}/></button></div>}
        {androidApk && <div className="rg-navigation-speed" aria-label={t('Viteza GPS','GPS speed')}>
          <strong>{session ? session.speed ?? '—' : telemetry.speed ?? '—'}</strong><span>km/h</span>
        </div>}
        <button className="rg-navigation-audio" type="button" aria-label={t('Indicații vocale','Voice guidance')} aria-pressed={!muted} title={muted?t('Sunet oprit','Sound off'):t('Sunet pornit','Sound on')} onClick={()=>{setMuted(v=>!v);spoken.current=''}}>{muted?<VolumeX size={24}/>:<Volume2 size={24}/>}</button>
      </div>
      <section ref={bottomPanel} className="sd-permanent-bottom">
        {session&&<DriveSessionPanel session={session} english={english} compact={androidApk} suspendDetails={searchFocused&&!navigating} vehicleSelector={androidApk?session.vehicle:undefined}>{navigating && progress && <span className="sd-route-remaining">
          <Flag size={15} aria-hidden="true"/> {t('Rămas pe traseu', 'Route remaining')} · {remaining != null ? distance(remaining) : '—'} · {minutes} min
          {eta && (' · ' + t('Sos. ', 'ETA ') + eta)}
        </span>}</DriveSessionPanel>}
        {(!session||route)&&<div className="sd-route-actions">{!navigating&&route&&<button className="primary" type="button" disabled={preview||routing} onClick={()=>{setNavigating(true);requestLocate();lastReroute.current=Date.now()}}><Navigation size={22}/>{t('Pornește navigația','Start navigation')}</button>}{navigating&&!androidApk&&<button type="button" className="sd-end-guidance" onClick={()=>{setNavigating(false);setStepIndex(0);}}><Flag size={19} aria-hidden="true"/>{t('Încheie navigația','End navigation')}</button>}</div>}
        {(routeError||locationError)&&<p role="alert">{routeError||locationError}</p>}{routing&&<p role="status">{t('Se calculează traseul…','Calculating route…')}</p>}
      </section>
      <aside className="rg-navigation-sidebar" data-open={searchOpen||details} ref={routeCard}>
        <header><span>SMARTDRIVE</span><h2>{t('Unde mergem?','Where to?')}</h2><button type="button" aria-label={t('Închide căutarea','Close search')} onClick={()=>{setSearchOpen(false);setDetails(false);}}><X size={20}/></button></header>
        {!androidApk&&session?.vehicle}
        {!navigating&&favorites.length>0&&<div className="rg-saved-places"><small>{t('Favorite · pe acest dispozitiv','Favorites · on this device')}</small>{favorites.map(point=><div key={point.kind||destinationIdentity(point)}><button type="button" onClick={()=>choose(point)}>{point.kind==='home'?t('Acasă','Home'):point.kind==='work'?t('Serviciu','Work'):point.name}</button><button type="button" aria-label={t('Elimină favorita','Remove favorite')} onClick={()=>setFavorites(previous=>{const next=previous.filter(p=>p!==point);persistPlaces(recent,next);return next})}>×</button></div>)}</div>}
        {!navigating&&recent.length>0&&<details className="rg-recent-places"><summary>{t('Destinații recente','Recent destinations')}</summary>{recent.map(point=><button type="button" key={destinationIdentity(point)} onClick={()=>choose(point)}>{point.name}</button>)}</details>}
        <button type="button" disabled={preview||navigating} aria-pressed={selecting} onClick={()=>setSelecting(v=>!v)}><MapPin size={16}/>{t('Alege pe hartă','Pick on map')}</button>
        {selecting&&<p role="status">{t('Atinge harta pentru destinație.','Tap the map for your destination.')}</p>}
        {destination&&<div className="rg-navigation-destination"><small>{t('DESTINAȚIE','DESTINATION')}</small><strong data-user-content>{destination.name||t('Punct ales pe hartă','Point selected on map')}</strong><p data-user-content>{destination.details}</p>
          {route&&<label>{t('Traseu','Route')}<FilterSelect value={alternative} disabled={navigating} onChange={event=>{setAlternative(Number(event.target.value));setStepIndex(0);deviation.current=0;lastReroute.current=Date.now()}}>{routes.map((option,index)=><option key={index} value={index}>{index+1} · {distance(option.distance)} · {Math.ceil(option.duration/60)} min</option>)}</FilterSelect></label>}
          {!route&&!routing&&<button type="button" onClick={()=>choose(destination)}>{t('Calculează traseul','Calculate route')}</button>}
          {!navigating&&<><div className="rg-place-save">{(['home','work','favorite'] as const).map(kind=><button type="button" key={kind} onClick={()=>setFavorites(previous=>{const entry={...destination,name:destination.name||t('Destinație','Destination'),kind};const next=[entry,...previous.filter(p=>kind==='favorite'?destinationIdentity(p)!==destinationIdentity(entry):p.kind!==kind)].slice(0,8);persistPlaces(recent,next);return next})}>{kind==='home'?t('Salvează Acasă','Set Home'):kind==='work'?t('Salvează Serviciu','Set Work'):t('Adaugă la favorite','Add favorite')}</button>)}</div><a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${destination.latitude},${destination.longitude}&travelmode=driving`}>Google Maps</a><a target="_blank" rel="noopener noreferrer" href={`https://waze.com/ul?ll=${destination.latitude},${destination.longitude}&navigate=yes`}>Waze</a><button type="button" onClick={()=>{++destinationRevision.current;++locationRevision.current;routingRequest.current?.abort();setFindingLocation(false);setRouting(false);setRoutes([]);setDestination(null);setRouteError('');setLocationError('')}}>{t('Șterge destinația','Clear destination')}</button></>}
        </div>}
        <p className="rg-navigation-limit" role="status">{background==='active'?t('Ghidare nativă activă în fundal.','Native background guidance active.'):t('În browser, păstrează pagina deschisă. Localizarea în fundal poate fi suspendată.','Keep the page open in a browser. Background location may be suspended.')}</p>
      </aside>
    </div>
  </section>;
}
