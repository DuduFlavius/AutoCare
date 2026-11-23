'use client';
import {Capacitor} from '@capacitor/core';
import {requestConfirmation} from '@/components/premium-dialogs';

import {FilterSelect} from './filter-select';
import {useApplicationLocale} from './application-locale';
import { useEffect, useRef, useState } from 'react';
import AutoDrivePanel from './auto-drive-panel';
import {driveElapsedMs,startDriveClock,pauseDriveClock,resumeDriveClock,finishDriveClock,measuredSpeed,driveStats,type DriveClock} from '@/lib/drive-session';
import AutoPointsMap from './auto-points-map';
import { MapPin, Play, Square, Pause, CheckCheck, LoaderCircle } from 'lucide-react';

import {hasNativeTracking,nativeAutomation,nativeTracking,type NativeTrip} from '@/lib/native-tracking';

import { watchBrowserLocation } from '@/lib/browser-location';
import { gpsSignal, gpsTelemetry } from '@/lib/gps-status';
import './smartdrive-premium.css';
import {queuePendingDrive,readPendingDrives,removePendingDrive,rememberDriveConfirmation,wasDriveConfirmed,type PendingDriveTrip} from '@/lib/pending-drive-trips';
import { storeTripRoutes } from '@/lib/local-trip-routes';
import { useMapLocation } from './use-map-location';
import { acceptGPSFix, browserGPSFix, latestGPSFix, type GPSFix as Sample } from '@/lib/gps-tracking';

export default function SmartDriveTrip({ preview, vehicles, onSaved, ownerId, bluetoothOnly, bluetoothVisible, liveVisible,onExit,onView }: { preview: boolean; bluetoothOnly: boolean; bluetoothVisible: boolean; liveVisible: boolean; ownerId:string; vehicles: { id: string; brand: string; model: string; plate?: string; odometer:number }[]; onSaved:()=>Promise<unknown>;onExit?:()=>void;onView?:(view:'live'|'history'|'points'|'bluetooth')=>void }) {

  const locale=useApplicationLocale();
  const [pendingDrives,setPendingDrives]=useState<PendingDriveTrip[]>([]);
  const [queuedSummary,setQueuedSummary]=useState<string|null>(null);
  const [queueBusy,setQueueBusy]=useState(false);
  const queueFlight=useRef(false);
  useEffect(()=>{
    try{setPendingDrives(readPendingDrives(ownerId));}
    catch{setError('Sesiunile locale nu pot fi citite acum.');}
  },[ownerId]);

  const [waitingCar,setWaitingCar]=useState(false);
  const [awaitingMotion,setAwaitingMotion]=useState(false);
  const [mapPosition,setMapPosition]=useState<Sample|null>(null);
  const [automatic,setAutomatic]=useState(false);
  const [native,setNative]=useState(false);
  const nativeMode=useRef(false);
  const nativeStarting=useRef(false);
  const [active, setActive] = useState(false);
  const [paused,setPaused]=useState(false),[maxSpeed,setMaxSpeed]=useState<number|null>(null),[measuredKmh,setMeasuredKmh]=useState<number|null>(null),[controlBusy,setControlBusy]=useState(false);
  const timing=useRef<DriveClock|null>(null),maxSpeedRef=useRef<number|null>(null),lastLiveFix=useRef<Sample|null>(null),draftSnapshot=useRef('');
  const english = locale.startsWith('en');
  const t = (ro: string, en: string) => english ? en : ro;
  const [clock, setTelemetryClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setTelemetryClock(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const idleLocation = useMapLocation(liveVisible && !active && !preview, english);
  useEffect(() => {
    document.documentElement.dataset.autocareGpsActive = active ? 'true' : 'false';
    return () => { delete document.documentElement.dataset.autocareGpsActive; };
  }, [active]);
  const [vehicleId, setVehicleId] = useState('');
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [notice, setNotice] = useState('');
  const [distance, setDistance] = useState(0);
  const [error, setError] = useState('');
  const [syncMileage,setSyncMileage]=useState(true);
  const [saved,setSaved]=useState(false);
  const tripId=useRef('');
  const baseline=useRef(0);
  const confirmedMileage=useRef(new Map<string, { previous: number; current: number }>());
  const snapshotGeneration=useRef(0);
  function startMileage(car: {id: string; odometer: number}) {
    const confirmed=confirmedMileage.current.get(car.id);
    return confirmed && car.odometer===confirmed.previous ? confirmed.current : car.odometer;
  }
  const endedAt=useRef<number|null>(null);
  const nativeElapsed=useRef<{seconds:number;at:number;running:boolean}|null>(null);
  const [signal, setSignal] = useState<'requesting'|'waiting'|'ok'|'lost'>('waiting');
  const lastFix = useRef<number>(0);
  const [routePoints, setRoutePoints] = useState<Sample[]>([]);
  const [trackingSeconds, setTrackingSeconds] = useState(0);
  const [, setClock] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const watcher = useRef<(() => void) | null>(null);
  const previous = useRef<Sample | null>(null);
  const started = useRef<number | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const distanceRef = useRef(0);
  function applyNative(value:NativeTrip){
    if(tripId.current!==value.id){
      let confirmed=false;
      try{confirmed=!value.active&&wasDriveConfirmed(ownerId,value.id);}catch{/* Native state remains recoverable. */}
      setSaved(confirmed);setSaveAttempted(false);
    }
    setAutomatic(!!value.automatic&&(value.active||value.distance>0));setWaitingCar(!!value.stopAt);setAwaitingMotion(!!value.awaitingMotion);
    if(!value.active&&value.endedAt&&value.distance===0)setSaved(true);
    setPaused(!!value.paused);
    maxSpeedRef.current=value.maxSpeedKmh??null;setMaxSpeed(maxSpeedRef.current);
    const nativeEnd=value.disconnectedAt??value.endedAt??Date.now();
    const nativePaused=(value.pausedMillis??0)+(value.pausedAt?Math.max(0,nativeEnd-value.pausedAt):0);
    timing.current={startedAt:value.startedAt,elapsedMs:Math.max(0,nativeEnd-value.startedAt-nativePaused),runningSince:value.active&&!value.paused&&!value.awaitingMotion&&!value.disconnectedAt?Date.now():null,endedAt:value.endedAt??null};
    nativeElapsed.current={seconds:value.awaitingMotion?0:Math.max(0,(nativeEnd-value.startedAt-nativePaused)/1000),at:Date.now(),running:value.active&&!value.paused&&!value.awaitingMotion&&!value.disconnectedAt&&!value.endedAt};
    const shownDistance=value.stopAt?(value.disconnectDistance??value.distance):value.distance;
    const shownPoints=value.disconnectedAt?value.points.filter(p=>p.timestamp<=value.disconnectedAt!):value.points;
    tripId.current=value.id;baseline.current=value.baseline;started.current=value.startedAt;endedAt.current=value.endedAt??null;
    distanceRef.current=shownDistance;setDistance(shownDistance);setVehicleId(value.vehicleId);setStartedAt(value.startedAt);setActive(value.active);
    setRoutePoints(previousPoints=>previousPoints.length===shownPoints.length&&
      previousPoints[0]?.timestamp===shownPoints[0]?.timestamp&&previousPoints.at(-1)?.timestamp===shownPoints.at(-1)?.timestamp
        ? previousPoints : shownPoints);
    setClock(new Date().toLocaleTimeString(locale));setTrackingSeconds(value.awaitingMotion?0:Math.max(0,Math.floor((nativeEnd-value.startedAt-nativePaused)/1000)));
    const position=value.lastPosition??shownPoints.at(-1);
    if(position){if(position.timestamp!==lastLiveFix.current?.timestamp){setMeasuredKmh(measuredSpeed(position,lastLiveFix.current));lastLiveFix.current=position;}setMapPosition(current=>!current||position.timestamp>current.timestamp?position:current);}
    const last=position;if(last){lastFix.current=value.lastFixAt||last.timestamp;setSignal(value.active&&Date.now()-lastFix.current>25000?'lost':'ok');}
  }
  useEffect(()=>{
    if(preview||!hasNativeTracking())return;
    nativeMode.current=true;setNative(true);let disposed=false,busy=false;
    const refresh=async()=>{if(busy||disposed||document.visibilityState!=='visible')return;busy=true;const generation=snapshotGeneration.current;try{const value=await nativeTracking.snapshot(ownerId);if(!disposed&&generation===snapshotGeneration.current&&!saveInFlight.current&&!nativeStarting.current&&value&&vehicles.some(v=>v.id===value.vehicleId))applyNative(value);}catch{if(!disposed)setError('Nu se poate citi starea GPS. Redeschide aplicația.');}finally{busy=false;}};
    void refresh();const timer=setInterval(()=>void refresh(),1000);document.addEventListener('visibilitychange',refresh);
    // Navigating away must detach UI polling, never stop the native location service.
    return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[ownerId,preview]);
  useEffect(()=>{if(!native&&timing.current){setTrackingSeconds(Math.floor(driveElapsedMs(timing.current,clock)/1000));return;}const elapsed=nativeElapsed.current;if(native&&elapsed)setTrackingSeconds(Math.floor(elapsed.seconds+(elapsed.running?Math.max(0,(clock-elapsed.at)/1000):0)));},[clock,native]);
  useEffect(()=>{const synced=(event:Event)=>{if((event as CustomEvent<{ids:string[]}>).detail?.ids.includes(tripId.current)){setSaved(true);setNotice(locale.startsWith('en')?'Automatic trip saved and mileage updated.':'Traseul automat a fost salvat și kilometrajul actualizat.');}};window.addEventListener('autocare-native-synced',synced);return()=>window.removeEventListener('autocare-native-synced',synced);},[locale]);
  useEffect(() => { if (!active) return; const check = setInterval(() => { if (lastFix.current && Date.now() - lastFix.current > 25000) setSignal('lost'); }, 4000); return () => clearInterval(check); }, [active]);
  useEffect(()=>{
    if(!active || !('wakeLock' in navigator)) return;
    let lock:WakeLockSentinel|null=null,disposed=false;
    const acquire=async()=>{if(document.visibilityState!=='visible')return;try{const next=await navigator.wakeLock.request('screen');if(disposed)await next.release();else lock=next;}catch{/* Browser may deny screen wake lock. */}};
    void acquire(); document.addEventListener('visibilitychange',acquire);
    return()=>{disposed=true;document.removeEventListener('visibilitychange',acquire);void lock?.release();};
  },[active]);
  const draftKey='autocare-gps-draft-v1:'+ownerId;
  useEffect(()=>{
    if(preview||hasNativeTracking())return;
    try{
      const draft=JSON.parse(localStorage.getItem(draftKey)||'null');
      if(!draft || Date.now()-draft.updatedAt>86400000 || !vehicles.some(v=>v.id===draft.vehicleId) || !Number.isFinite(draft.distance) || draft.distance<0 || !Number.isFinite(draft.startedAt) || !Number.isFinite(draft.baseline) || !Array.isArray(draft.points) || typeof draft.id!=='string')return;
      tripId.current=draft.id;baseline.current=draft.baseline;started.current=draft.startedAt;endedAt.current=null;
      const restored=draft.timing;timing.current=restored&&Number.isFinite(restored.elapsedMs)&&Number.isFinite(restored.startedAt)&&(restored.runningSince===null||Number.isFinite(restored.runningSince))&&restored.elapsedMs>=0?pauseDriveClock(restored,draft.updatedAt):{startedAt:draft.startedAt,elapsedMs:Math.max(0,draft.updatedAt-draft.startedAt),runningSince:null,endedAt:null};endedAt.current=timing.current.endedAt;setPaused(!endedAt.current);
      maxSpeedRef.current=Number.isFinite(draft.maxSpeed)&&draft.maxSpeed>=0&&draft.maxSpeed<=198?draft.maxSpeed:null;setMaxSpeed(maxSpeedRef.current);
      distanceRef.current=draft.distance;setDistance(draft.distance);setStartedAt(draft.startedAt);setVehicleId(draft.vehicleId);
      const points=draft.points.filter((p:Sample)=>[p.latitude,p.longitude,p.accuracy,p.timestamp].every(Number.isFinite)).slice(-1500);
      setRoutePoints(points);
      setTrackingSeconds(Math.floor(driveElapsedMs(timing.current,Date.now())/1000));
      setNotice(t("Traseu recuperat pe acest dispozitiv. Reia GPS-ul sau salvează distanța deja înregistrată.", "Trip recovered on this device. Resume GPS or save the recorded distance."));
    }catch{/* Storage can be disabled. */}
  // Restore once for this signed-in account, never when the odometer refreshes.
  },[draftKey,preview]);
  useEffect(()=>{
    if(preview || nativeMode.current || !started.current || !timing.current)return;
    try{if(saved){localStorage.removeItem(draftKey);return;}draftSnapshot.current=JSON.stringify({id:tripId.current,vehicleId:vehicleId||vehicles[0]?.id,baseline:baseline.current,startedAt:started.current,updatedAt:endedAt.current??Date.now(),distance,points:routePoints,timing:timing.current,maxSpeed:maxSpeedRef.current});localStorage.setItem(draftKey,draftSnapshot.current);}catch{/* Preserve the live trip if storage is full. */}
  },[distance,routePoints,saved,draftKey,preview,vehicleId,vehicles,active,paused,startedAt]);
  const pause = async () => {
    if(controlBusy||saving||automatic)return;
    setControlBusy(true);
    try{if(nativeMode.current){applyNative(await nativeTracking.pause(ownerId));return;}
      watcher.current?.();watcher.current=null;previous.current=null;
      if(timing.current)timing.current=pauseDriveClock(timing.current,Date.now());
      setActive(false);setPaused(true);setMeasuredKmh(null);
    }catch(e){setError(e instanceof Error?e.message:t('Nu s-a putut pune pauză.','Could not pause.'));}finally{setControlBusy(false);}
  };
  useEffect(()=>()=>{if(nativeMode.current||!draftSnapshot.current)return;try{const value=JSON.parse(draftSnapshot.current);if(timing.current&&!timing.current.endedAt){value.timing=pauseDriveClock(timing.current,Date.now());value.updatedAt=Date.now();localStorage.setItem(draftKey,JSON.stringify(value));}}catch{/* Device storage may be unavailable. */}},[draftKey]);
  const stop = async () => {
    if(nativeMode.current){const value=await nativeTracking.stop(ownerId);if(!value)throw Error(t('Sesiunea GPS nu a putut fi închisă.','The GPS session could not be stopped.'));applyNative(value);return;}


    if (watcher.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) watcher.current();
    watcher.current = null;
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    previous.current = null;
    endedAt.current=Date.now();
    if(timing.current)timing.current=finishDriveClock(timing.current,endedAt.current);
    setPaused(false);setTrackingSeconds(timing.current?Math.floor(driveElapsedMs(timing.current,endedAt.current)/1000):0);
    if (distanceRef.current <= 0) setNotice(t('Călătorie oprită. Nu a fost înregistrată o deplasare GPS validă; kilometrajul nu a fost modificat.', 'Drive stopped. No valid GPS movement was recorded; vehicle mileage has not changed.'));
    setActive(false);
  };
  useEffect(() => {
    if (!active || native) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active, native]);
  useEffect(() => () => { if (watcher.current !== null) watcher.current(); if (tick.current) clearInterval(tick.current); }, []);
  const start = () => {
    if(controlBusy||saving||saveInFlight.current||queueFlight.current||(active&&!paused))return;
    if(paused&&nativeMode.current){setControlBusy(true);void nativeTracking.resume(ownerId).then(applyNative).catch(e=>setError(e instanceof Error?e.message:'Nu s-a putut relua GPS-ul.')).finally(()=>setControlBusy(false));return;}
    if(Capacitor.getPlatform()==='android'&&!hasNativeTracking()){setError(t('Actualizează aplicația AutoCare pentru a folosi GPS în fundal.','Update the AutoCare app to use background GPS.'));return;}
    if(hasNativeTracking()&&!preview){
      if(nativeStarting.current || saveInFlight.current)return;
      const car=vehicles.find(v=>v.id===vehicleId)||vehicles[0];if(!car){setError(t("Selectează o mașină înainte de pornire.", "Select a vehicle before starting."));return;}
      nativeStarting.current=true;setControlBusy(true);setError('');
      void (async()=>{try{
        ++snapshotGeneration.current;
        const previousTrip=await nativeTracking.snapshot(ownerId);
        if(previousTrip?.active){
          applyNative(previousTrip);
          return;
        }
        if(previousTrip?.id){
          let previousSaved=saved&&previousTrip.id===tripId.current;
          try{previousSaved ||= wasDriveConfirmed(ownerId,previousTrip.id);}catch{/* Queue persistence is checked before releasing a trip. */}
          if(previousTrip.automatic&&previousTrip.distance>0&&!previousSaved){
            const pending=await nativeAutomation.pending(ownerId);
            if(!pending.some(row=>row.id===previousTrip.id)){
              const latest=await nativeTracking.snapshot(ownerId);
              if(latest?.id===previousTrip.id)throw Error(t('Traseul automat nu este încă disponibil în coada AutoDrive.','The automatic trip is not available in the AutoDrive queue yet.'));
              if(latest){applyNative(latest);return;}
            }
          }
          if(!previousTrip.automatic&&!previousSaved&&previousTrip.distance>0){
            const ending=previousTrip.endedAt??previousTrip.updatedAt;
            const total=Math.floor((ending-previousTrip.startedAt)/1000);
            const elapsed=Math.max(1,Math.floor((ending-previousTrip.startedAt-(previousTrip.pausedMillis??0))/1000));
            setPendingDrives(queuePendingDrive(ownerId,{
              id:previousTrip.id,vehicleId:previousTrip.vehicleId,expectedOdometer:previousTrip.baseline,
              startedAt:new Date(previousTrip.startedAt).toISOString(),endedAt:new Date(ending).toISOString(),
              distanceMeters:Math.round(previousTrip.distance),durationSeconds:elapsed,pausedSeconds:Math.max(0,total-elapsed),
              points:previousTrip.points,syncMileage,
            }));
          }
          await nativeTracking.clear(ownerId);
          endedAt.current=null; started.current=null; timing.current=null;
          setStartedAt(null);setDistance(0);distanceRef.current=0;setRoutePoints([]);setTrackingSeconds(0);setSaved(false);
        }
        const value=await nativeTracking.start({id:crypto.randomUUID(),ownerId,vehicleId:car.id,baseline:startMileage(car)});
        setSaved(false);setNotice('');applyNative(value);
      }catch(e){setError(e instanceof Error?e.message:t("Nu s-a putut porni urmărirea GPS.", "GPS tracking could not start."));}finally{nativeStarting.current=false;setControlBusy(false);}})();return;
    }

    if(endedAt.current&&!saved){setError(t('Salvează sau elimină sesiunea finalizată înainte de una nouă.','Save or discard the finished session before starting a new one.'));return;}
    const resume=started.current!==null && !saved;
    if (preview) { setError(t("GPS-ul nu este activ în modul demonstrativ.", "GPS is disabled in the design preview.")); return; }
    if (!window.isSecureContext || !('geolocation' in navigator)) { setError(t("GPS-ul necesită HTTPS și un browser cu localizare.", "GPS requires HTTPS and a browser with location support.")); return; }
    if (watcher.current !== null) return;
    const car=vehicles.find(v=>v.id===vehicleId)||vehicles[0];
    if(!car){setError(t("Selectează o mașină înainte de pornire.", "Select a vehicle before starting."));return;}
    if(!resume){setVehicleId(car.id);baseline.current=startMileage(car);tripId.current=crypto.randomUUID();} endedAt.current=null; setSaved(false);
    setClock(new Date().toLocaleTimeString(locale));
    if(!resume){const now=Date.now();timing.current=startDriveClock(now);started.current=now;setStartedAt(now);setDistance(0);distanceRef.current=0;setRoutePoints([]);setTrackingSeconds(0);maxSpeedRef.current=null;setMaxSpeed(null);lastLiveFix.current=null;}else if(timing.current){timing.current=resumeDriveClock(timing.current,Date.now());}setPaused(false);
    setSaveAttempted(false);
    setSignal('requesting');lastFix.current=0;setError('');setNotice('');previous.current=null;
    // The independent one-second UI clock advances the session even without new GPS fixes.

    watcher.current = watchBrowserLocation(
      value => {
        const next = browserGPSFix(value);
        if (!next || next.timestamp > Date.now() + 5000 || Date.now() - next.timestamp > 15000) return;
        setError('');
        const kmh=measuredSpeed(next,lastLiveFix.current);lastLiveFix.current=next;setMeasuredKmh(kmh);
        if(kmh!==null){maxSpeedRef.current=Math.max(maxSpeedRef.current??0,kmh);setMaxSpeed(maxSpeedRef.current);}
        setMapPosition(previous => latestGPSFix(previous, next));
        if (next.accuracy > 50) { setSignal('waiting'); return; }
        lastFix.current=Date.now(); setSignal('ok');
        const accepted=acceptGPSFix(previous.current,next);
        if(!accepted) return;
        if (!started.current) { started.current = next.timestamp; setStartedAt(next.timestamp); }
        distanceRef.current+=accepted.meters; setDistance(distanceRef.current);
        previous.current=accepted.point;
        setRoutePoints(points=>[...points.slice(-1499),accepted.point]);

      },
      e => { setSignal('lost'); setError(e.code === 1 ? t("Permisiune refuzată. Permite locația din setările site-ului și reîncarcă pagina.", "Location permission denied. Allow location in your browser or device settings, then try again.") : t("Semnal GPS temporar indisponibil. Urmărirea rămâne pornită și încearcă din nou.", "GPS is temporarily unavailable. Tracking will retry automatically.")); if (e.code === 1) void pause(); },
    );
    setActive(true);
  };
  const saveTrip = async () => {
    if(saved || saveInFlight.current || queueFlight.current)return;
    const id = vehicles.some(v => v.id === vehicleId) ? vehicleId : undefined;
    if (active || paused || !endedAt.current) { setError(t("Oprește urmărirea înainte de salvare.", "Stop tracking before saving.")); return; }
    if (!id || !started.current || distanceRef.current <= 0 || preview) { setError(t("Selectează o mașină și înregistrează o distanță validă.", "Select a vehicle and record a valid distance.")); return; }
    const ended = endedAt.current ?? Date.now();
    let activeSeconds=timing.current?Math.floor(driveElapsedMs(timing.current,ended)/1000):trackingSeconds;
    saveInFlight.current=true;
    setSaveAttempted(true);
    ++snapshotGeneration.current;
    setSaving(true);
    try {
      let finalPoints = routePoints;
      // Read the durable final snapshot, not a potentially stale two-second UI poll.
      if(nativeMode.current){
        const finalTrip=await nativeTracking.snapshot(ownerId);
        if(!finalTrip || finalTrip.active || finalTrip.id!==tripId.current || finalTrip.vehicleId!==id)throw Error('Traseul GPS nu este încă finalizat. Reîncearcă salvarea.');
        finalPoints = finalTrip.points;
        distanceRef.current=finalTrip.distance;
        endedAt.current=finalTrip.endedAt??finalTrip.updatedAt;
        activeSeconds=Math.max(0,Math.floor((endedAt.current-finalTrip.startedAt-(finalTrip.pausedMillis??0))/1000));
      }
      const finalEnd=endedAt.current??ended;
      const res = await fetch('/api/v1/smartdrive/vehicles/' + id + '/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id:tripId.current, syncMileage, expectedOdometer:baseline.current, distanceMeters: Math.round(distanceRef.current), durationSeconds: Math.max(1,activeSeconds), pausedSeconds:Math.max(0,Math.floor((finalEnd-started.current)/1000)-activeSeconds), startedAt: new Date(started.current).toISOString(), endedAt: new Date(finalEnd).toISOString() }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Salvarea călătoriei a eșuat.');
      if(body.id!==tripId.current||body.vehicleId!==id)throw Error(t('Serverul nu a confirmat cursa corectă. Reîncearcă salvarea.','The server did not confirm this trip. Retry saving.'));
      if(syncMileage){
        if(body.source!=='browser-gps-synced')throw Error(t('Cursa există fără sincronizare. Verifică kilometrajul înainte de o nouă salvare.','The trip exists without mileage sync. Check the odometer before saving again.'));
        if (!Number.isInteger(body.odometer) || body.odometer < 0) throw Error(t('Serverul nu a confirmat kilometrajul. Reîncearcă salvarea.', 'The server did not confirm mileage. Retry saving.'));
        const previous = confirmedMileage.current.get(id);
        confirmedMileage.current.set(id, {previous: previous?.current === baseline.current ? previous.previous : baseline.current, current: body.odometer});
      }
      try { await storeTripRoutes(ownerId, [{ id: body.id, points: finalPoints }]); }
      catch { /* The route cache is optional; the backend has already committed the trip. */ }
      if(pendingDrives.some(row=>row.id===body.id)){
        try{setPendingDrives(removePendingDrive(ownerId,body.id,syncMileage?body.odometer:undefined));}
        catch{/* Backend idempotency still protects a locally retained retry. */}
      }
      try{rememberDriveConfirmation(ownerId,body.id);}catch{/* Server retries remain idempotent. */}
      if(nativeMode.current) await nativeTracking.clear(ownerId).catch(() => {});
      setSaved(true); setNotice(syncMileage ? 'Călătorie salvată. Distanța GPS a fost adăugată kilometrajului și planului de întreținere. Verifică periodic valoarea cu bordul mașinii.' : 'Călătoria GPS a fost salvată separat.'); setError('');
      window.dispatchEvent(new Event('autocare-trips-updated'));
      try{await onSaved();}catch{setNotice('Călătoria a fost salvată. Reîncarcă pagina pentru kilometrajul actualizat.');}
    } catch(e) { setError(e instanceof Error ? e.message : 'Salvarea a eșuat.'); }
    finally { saveInFlight.current=false;setSaving(false); }
  };
  async function sendQueuedTrip(trip:PendingDriveTrip,separately=false){
    if(queueFlight.current||saveInFlight.current||nativeStarting.current||preview)return;
    queueFlight.current=true;setQueueBusy(true);setError('');
    try{
      const {vehicleId:queuedVehicle,points,...payload}=trip;
      const sync=payload.syncMileage&&!separately;
      const response=await fetch('/api/v1/smartdrive/vehicles/'+encodeURIComponent(queuedVehicle)+'/trips',{
        method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,syncMileage:sync}),
      });
      const receipt=await response.json();
      if(!response.ok)throw Error(receipt.error||t('Salvarea călătoriei a eșuat.','The trip could not be saved.'));
      if(receipt.id!==trip.id||receipt.vehicleId!==queuedVehicle||
        (sync&&(receipt.source!=='browser-gps-synced'||!Number.isInteger(receipt.odometer))))
        throw Error(t('Serverul nu a confirmat salvarea.','The server did not confirm the save.'));
      await storeTripRoutes(ownerId,[{id:trip.id,points}]).catch(()=>{});
      const odometer=sync?receipt.odometer as number:undefined;
      if(odometer!==undefined)confirmedMileage.current.set(queuedVehicle,{previous:trip.expectedOdometer,current:odometer});
      try{rememberDriveConfirmation(ownerId,trip.id);}catch{/* Server retries remain idempotent. */}
      setPendingDrives(removePendingDrive(ownerId,trip.id,odometer));
      setQueuedSummary(null);
      setNotice(t('Sesiunea a fost salvată în istoric.','The session was saved to history.'));
      window.dispatchEvent(new Event('autocare-trips-updated'));
      try{await onSaved();}catch{/* The backend has already confirmed the trip. */}
    }catch(reason){setError(reason instanceof Error?reason.message:t('Sesiunea rămâne pe dispozitiv.','The session stays on this device.'));}
    finally{queueFlight.current=false;setQueueBusy(false);}
  }
  async function discardQueuedTrip(id:string){
    if(queueFlight.current||!await requestConfirmation(t('Renunți la sesiune? Traseul local și kilometrii nesalvați se vor pierde.','Discard the session? The local route and unsaved mileage will be lost.')))return;
    if(queueFlight.current)return;
    try{setPendingDrives(removePendingDrive(ownerId,id));setQueuedSummary(null);}
    catch(reason){setError(reason instanceof Error?reason.message:'Sesiunea nu a putut fi eliminată.');}
  }
  const queues=pendingDrives.filter(row=>row.id!==tripId.current||!endedAt.current);
  const queuePanel=queues.length>0&&<details className="sd-pending-trips"><summary>{t('Sesiuni nesalvate','Unsaved sessions')} · {queues.length}</summary>
    {queues.map(trip=><div key={trip.id}>
      <span>{new Date(trip.startedAt).toLocaleString(locale)} · {(trip.distanceMeters/1000).toLocaleString(locale)} km</span>
      <button type="button" onClick={()=>setQueuedSummary(queuedSummary===trip.id?null:trip.id)}>{t('Vezi rezumatul','View summary')}</button>
      {queuedSummary===trip.id&&<p>{vehicles.find(car=>car.id===trip.vehicleId)?.plate??trip.vehicleId} · {Math.floor(trip.durationSeconds/60)} min · {Math.round(trip.distanceMeters*3.6/trip.durationSeconds)} km/h</p>}
      <button type="button" disabled={queueBusy} onClick={()=>void sendQueuedTrip(trip)}>{t('Reîncearcă salvarea','Retry saving')}</button>
      {trip.syncMileage&&<button type="button" disabled={queueBusy} onClick={()=>void sendQueuedTrip(trip,true)}>{t('Salvează fără kilometraj','Save without mileage')}</button>}
      <button type="button" disabled={queueBusy} onClick={()=>void discardQueuedTrip(trip.id)}>{t('Renunță la sesiune','Discard session')}</button>
    </div>)}
  </details>;
  const currentCar = vehicles.find(vehicle => vehicle.id === vehicleId) ?? vehicles[0];
  const currentPosition = latestGPSFix(mapPosition, idleLocation.position);
  const telemetry = gpsTelemetry(currentPosition, clock);
  const status = active && signal === 'requesting' && !currentPosition ? 'requesting' : gpsSignal({ position: currentPosition, now: clock, requested: active || idleLocation.waiting, failed: signal === 'lost' && active || !!idleLocation.error, denied: !!error && !active && !telemetry.fresh });
  const speed = active&&!paused&&telemetry.fresh&&telemetry.accuracy!==null&&telemetry.accuracy<=50
    ? telemetry.speed??(measuredKmh===null?null:Math.round(measuredKmh)) : null;
  const [dial,setDial]=useState<number|null>(null);
  useEffect(()=>{
    setDial(previous=>speed===null||previous===null||speed===0||Math.abs(speed-previous)>12?speed:Math.round((previous+speed*2)/3));
  },[speed]);
  const stats=driveStats(distance,trackingSeconds,maxSpeed);

  const driveButton = <button type="button" className="sd-start primary" disabled={saving||controlBusy||preview||!currentCar||queueBusy} onClick={start}><Play size={23}/>{paused?t('Continuă','Continue'):saved?t('Pornește sesiune nouă','Start a new session'):t('Pornește sesiunea','Start session')}</button>;
  const finish=async()=>{
    if(controlBusy||saving||preview)return;
    setControlBusy(true);
    try {
      await requestConfirmation(t('Finalizezi sesiunea și deschizi rezumatul?','Finish the session and open the summary?'),async()=>{
        await stop();
        if(distanceRef.current<=0){
          setSaved(true);
          setNotice(t('Sesiune finalizată fără deplasare GPS validă. Kilometrajul nu a fost modificat.','Session finished without valid GPS movement. Mileage was unchanged.'));
          try{localStorage.removeItem(draftKey);}catch{/* Device storage may be unavailable. */}
        }
      });
    } catch(reason) { setError(reason instanceof Error?reason.message:t('Sesiunea nu a putut fi finalizată.','The session could not be finished.')); }
    finally { setControlBusy(false); }
  };
  const finishControl=<> {(active||paused||!!startedAt&&!saved&&!endedAt.current)&&<button type="button" className="sd-finish" disabled={controlBusy||saving||preview} onClick={()=>void finish()}>{saving?<LoaderCircle size={23}/>:<Square size={22}/>} {t('Finalizează','Finish')}</button>} </>;
  const sessionControls=<>{(!active&&!paused&&(!endedAt.current||native))||paused||saved?driveButton:active?<button type="button" className="sd-pause" disabled={controlBusy||saving||preview||automatic} onClick={()=>void pause()}><Pause size={23}/>{t('Pauză','Pause')}</button>:null}{saved&&distance>0&&<span className="sd-saved"><CheckCheck size={22}/>{t('Sesiune salvată','Session saved')}</span>}{!active&&!paused&&!!endedAt.current&&distance>0&&!saved&&!automatic&&<button className="sd-start primary" type="button" disabled={saving||preview||queueBusy} onClick={()=>void saveTrip()}>{saving?<LoaderCircle size={18}/>:<CheckCheck size={20}/>} {saving?t('Se salvează…','Saving…'):saveAttempted?t('Reîncearcă salvarea','Retry saving'):t('Salvează sesiunea','Save session')}</button>}</>;
  const discardOption=!active && !paused && !!endedAt.current && !automatic && (distance>0 || (native&&startedAt!==null)) && !saved && <button type="button" disabled={saving||preview||controlBusy} onClick={async ()=>{if(!await requestConfirmation(t("Renunți la sesiune? Traseul local și kilometrii nesalvați se vor pierde.", "Discard this session? The local route and unsaved mileage will be lost.")))return;if(nativeMode.current){const discardedId=tripId.current;void nativeTracking.clear(ownerId).then(()=>{
      if(pendingDrives.some(trip=>trip.id===discardedId))setPendingDrives(removePendingDrive(ownerId,discardedId));
      distanceRef.current=0;started.current=null;timing.current=null;nativeElapsed.current=null;endedAt.current=null;draftSnapshot.current='';setPaused(false);maxSpeedRef.current=null;setMaxSpeed(null);setDistance(0);setRoutePoints([]);setStartedAt(null);setTrackingSeconds(0);setNotice('');setError('');}).catch(e=>setError(e instanceof Error?e.message:'GPS indisponibil.'));return;}distanceRef.current=0;started.current=null;previous.current=null;timing.current=null;nativeElapsed.current=null;endedAt.current=null;draftSnapshot.current='';setPaused(false);maxSpeedRef.current=null;setMaxSpeed(null);setDistance(0);setRoutePoints([]);setStartedAt(null);setTrackingSeconds(0);setNotice('');setError('');try{localStorage.removeItem(draftKey);}catch{/* Storage unavailable. */}}}>{t('Renunță la traseu', 'Discard trip')}</button>;
  const syncOption=!automatic&&<label className="ac-smartdrive-sync"><input type="checkbox" checked={syncMileage} disabled={saving||saved||saveAttempted} onChange={e=>setSyncMileage(e.target.checked)}/> {t('Adaugă distanța validă la kilometraj și actualizează planul de întreținere la salvare.', 'Sync recorded distance with vehicle mileage and maintenance when saving.')}</label>;
  return <section className="ac-smartdrive-trip" aria-label="SmartDrive GPS">
    <div className="ac-drive-live-content" hidden={bluetoothOnly}>
    <AutoPointsMap onExit={onExit} onView={onView} preview={preview} visible={liveVisible} ownerId={ownerId} session={{position:currentPosition,points:routePoints,meters:distance,seconds:trackingSeconds,speed:speed===null?null:dial??speed,average:stats.averageKmh,maximum:stats.maximumKmh,signal:status,accuracy:telemetry.accuracy,startedAt,vehicleLabel:currentCar?[currentCar.brand,currentCar.model,currentCar.plate].filter(Boolean).join(' · '):undefined,state:saving?'saving':saved?'finished':endedAt.current?'unsaved':paused?'paused':active?'active':'idle',active,locate:idleLocation.locate,start,stop,
      vehicle:vehicles.length>0?<label>{t('Vehicul','Vehicle')}<FilterSelect value={currentCar?.id||''} disabled={active||!!startedAt&&!saved} onChange={e=>setVehicleId(e.target.value)}>{vehicles.map(v=><option key={v.id} value={v.id}>{v.brand} {v.model}{v.plate?' · '+v.plate:''}</option>)}</FilterSelect></label>:null,
      messages:<>{awaitingMotion&&<p role="status">{t('Așteaptă deplasarea mașinii.','Waiting for the vehicle to move.')}</p>}{notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}</>,
      controls:sessionControls, finishControl,options:<>{syncOption}{discardOption}{queuePanel}</>,pendingCount:queues.length
    }}/>
    <details className="rg-drive-details"><summary>{t('Sesiune, sincronizare și permisiuni','Session, sync and permissions')}</summary>
    <div className="ac-drive-console">
    {vehicles.length > 0 && <label className="ac-drive-vehicle">{t('Mașina pentru călătorie', 'Your vehicle')} <FilterSelect value={vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0].id} disabled={active || (!!startedAt && !saved)} onChange={e => setVehicleId(e.target.value)}>{vehicles.map(v => <option data-user-content key={v.id} value={v.id}>{v.brand} {v.model}{v.plate ? ' · ' + v.plate : ''}</option>)}</FilterSelect></label>}
    <div className="ac-smartdrive-trip-controls">

      {discardOption}
      <span><MapPin size={15}/> {active ? t('Înregistrare pornită', 'Recording enabled') : t('Înregistrare oprită', 'Recording off')}</span>
    </div>
    {syncOption}
    </div>
    {currentCar && <div className="service-reminder-box" data-workspace-ui>
      <strong>{english ? 'Vehicle mileage: ' : 'Kilometrajul mașinii: '}{currentCar.odometer.toLocaleString(locale)} km</strong>
      <p>{english ? 'A saved trip updates maintenance mileage if mileage sync is enabled.' : 'O călătorie salvată actualizează kilometrajul de întreținere când sincronizarea este bifată.'}</p>
      {!active && <a href="?tab=%C3%8Entre%C8%9Binere">{english ? 'View service intervals' : 'Vezi termenele de întreținere'}</a>}
    </div>}
    {active && signal === 'lost' && <div role="alert" className="ac-drive-signal-warning">Semnal GPS pierdut sau întârziat peste 25 secunde. Verifică locația și permisiunile telefonului. Distanța nu crește fără puncte valide.</div>}
    {active && (signal === 'waiting' || signal === 'requesting') && <p role="status" style={{color:'var(--color-muted)'}}>Se caută semnal GPS de precizie…</p>}
    <p role="status"><strong>{native ? t("GPS Android/iOS nativ · disponibil în fundal", "Native GPS · background tracking supported") : t("GPS în browser · fără urmărire în fundal", "Browser GPS · background tracking is not guaranteed")}</strong></p>
    {native && <button type="button" onClick={() => void import('@/lib/native-tracking').then(({nativeAutomation}) => nativeAutomation.openSettings()).catch(() => setError('Deschide Setările telefonului → Aplicații → AutoCare.'))}>Deschide permisiunile telefonului</button>}
    {native && <p className="small muted">După Pornește GPS trebuie să apară notificarea permanentă „AutoCare · GPS activ”. Pe Android, verifică în Setări → Aplicații → AutoCare: locație precisă, notificări permise și Baterie → Fără restricții. Pentru pornirea automată prin Bluetooth, permite locația „Tot timpul”.</p>}
    <p>{native ? t("Urmărirea nativă continuă în fundal, cu permisiunea telefonului, până alegi Oprește GPS. Oprirea forțată a aplicației sau restricțiile telefonului pot întrerupe înregistrarea.", "Native tracking continues in the background with device permission until you stop the drive. Force-stop and device restrictions can interrupt recording.") : t("Menține aplicația deschisă pentru înregistrare. Browserul poate opri GPS-ul în fundal sau cu ecranul blocat. Segmentele fără semnal nu sunt adăugate la distanță.", "Keep the app open while recording in a browser. Background or screen-locked tracking may be suspended. Signal gaps never add distance.")}</p>

    {waitingCar&&active&&<p role="status">{locale.startsWith('en')?'Car connection interrupted. Distance is paused while reconnection is checked.':'Conexiunea mașinii este întreruptă. Kilometrii sunt opriți cât se verifică reconectarea.'}</p>}
    {automatic&&!active&&!saved&&distance>0&&<p role="status">{locale.startsWith('en')?'Automatic trip saved on this device; waiting for safe account sync.':'Traseu automat păstrat pe dispozitiv; în așteptarea sincronizării sigure în cont.'}</p>}
    </details>
    </div>
    <div hidden={!bluetoothOnly}><AutoDrivePanel ownerId={ownerId} vehicles={vehicles} english={locale.startsWith('en')} onUpdated={onSaved} preview={preview} visible={bluetoothVisible}/></div>
    {bluetoothOnly && notice && <p role="status">{notice}</p>}
    {bluetoothOnly && error && <p className="ac-smartdrive-trip-error" role="alert">{error}</p>}
  </section>;
}
