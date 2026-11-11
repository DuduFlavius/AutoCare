'use client';
import {useApplicationLocale} from './application-locale';
import { useEffect, useRef, useState } from 'react';
import AutoDrivePanel from './auto-drive-panel';
import DriveSessionSummary from './drive-session-summary';
import dynamic from 'next/dynamic';
import { MapPin, Play, Square, Route } from 'lucide-react';

import {hasNativeTracking,nativeTracking,type NativeTrip} from '@/lib/native-tracking';
import MapStage from './map-stage';
import { gpsSignal, gpsTelemetry } from '@/lib/gps-status';
import './smartdrive-premium.css';
import { storeTripRoutes } from '@/lib/local-trip-routes';
import { useMapLocation } from './use-map-location';
import { acceptGPSFix, browserGPSFix, latestGPSFix, type GPSFix as Sample } from '@/lib/gps-tracking';
const RoadMapView=dynamic(()=>import('./road-map'),{ssr:false});
export default function SmartDriveTrip({ preview, vehicles, onSaved, ownerId, bluetoothOnly, bluetoothVisible, liveVisible }: { preview: boolean; bluetoothOnly: boolean; bluetoothVisible: boolean; liveVisible: boolean; ownerId:string; vehicles: { id: string; brand: string; model: string; plate?: string; odometer:number }[]; onSaved:()=>Promise<unknown> }) {

  const locale=useApplicationLocale();
  const [waitingCar,setWaitingCar]=useState(false);
  const [awaitingMotion,setAwaitingMotion]=useState(false);
  const [mapPosition,setMapPosition]=useState<Sample|null>(null);
  const [automatic,setAutomatic]=useState(false);
  const [native,setNative]=useState(false);
  const nativeMode=useRef(false);
  const nativeStarting=useRef(false);
  const [active, setActive] = useState(false);
  const english = locale.startsWith('en');
  const t = (ro: string, en: string) => english ? en : ro;
  const [clock, setTelemetryClock] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setTelemetryClock(Date.now()), 4000); return () => clearInterval(timer); }, []);
  const idleLocation = useMapLocation(liveVisible && !active && !preview, english);
  useEffect(() => {
    document.documentElement.dataset.autocareGpsActive = active ? 'true' : 'false';
    return () => { delete document.documentElement.dataset.autocareGpsActive; };
  }, [active]);
  const [vehicleId, setVehicleId] = useState('');
  const [saving, setSaving] = useState(false);
  const saveInFlight = useRef(false);
  const [saveRetry, setSaveRetry] = useState(0);
  const [notice, setNotice] = useState('');
  const [distance, setDistance] = useState(0);
  const [error, setError] = useState('');
  const [syncMileage,setSyncMileage]=useState(true);
  const [finalizeOnStop,setFinalizeOnStop]=useState(false);
  const [saved,setSaved]=useState(false);
  const tripId=useRef('');
  const baseline=useRef(0);
  const endedAt=useRef<number|null>(null);
  const [signal, setSignal] = useState<'requesting'|'waiting'|'ok'|'lost'>('waiting');
  const lastFix = useRef<number>(0);
  const [routePoints, setRoutePoints] = useState<Sample[]>([]);
  const [trackingSeconds, setTrackingSeconds] = useState(0);
  const [, setClock] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const watcher = useRef<number | null>(null);
  const previous = useRef<Sample | null>(null);
  const started = useRef<number | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const distanceRef = useRef(0);
  function applyNative(value:NativeTrip){
    if(tripId.current!==value.id)setSaved(false);
    setAutomatic(!!value.automatic&&(value.active||value.distance>0));setWaitingCar(!!value.stopAt);setAwaitingMotion(!!value.awaitingMotion);
    if(value.automatic&&!value.active&&value.distance===0)setSaved(true);
    const shownDistance=value.stopAt?(value.disconnectDistance??value.distance):value.distance;
    const shownPoints=value.disconnectedAt?value.points.filter(p=>p.timestamp<=value.disconnectedAt!):value.points;
    tripId.current=value.id;baseline.current=value.baseline;started.current=value.startedAt;endedAt.current=value.endedAt??null;
    distanceRef.current=shownDistance;setDistance(shownDistance);setVehicleId(value.vehicleId);setStartedAt(value.startedAt);setActive(value.active);setRoutePoints(shownPoints);
    setClock(new Date().toLocaleTimeString(locale));setTrackingSeconds(value.awaitingMotion?0:Math.max(0,Math.floor(((value.disconnectedAt??value.endedAt??Date.now())-value.startedAt)/1000)));
    const position=value.lastPosition??shownPoints.at(-1);
    if(position)setMapPosition(current=>!current||position.timestamp>=current.timestamp?position:current);
    const last=position;if(last){lastFix.current=value.lastFixAt||last.timestamp;setSignal(value.active&&Date.now()-lastFix.current>25000?'lost':'ok');}
  }
  useEffect(()=>{
    if(preview||!hasNativeTracking())return;
    nativeMode.current=true;setNative(true);let disposed=false,busy=false;
    const refresh=async()=>{if(busy||disposed||document.visibilityState!=='visible')return;busy=true;try{const value=await nativeTracking.snapshot(ownerId);if(!disposed&&value&&vehicles.some(v=>v.id===value.vehicleId))applyNative(value);}catch{if(!disposed)setError('Nu se poate citi starea GPS. Redeschide aplicația.');}finally{busy=false;}};
    void refresh();const timer=setInterval(()=>void refresh(),2000);document.addEventListener('visibilitychange',refresh);
    // Navigating away must detach UI polling, never stop the native location service.
    return()=>{disposed=true;clearInterval(timer);document.removeEventListener('visibilitychange',refresh);};
  },[ownerId,preview]);
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
      if(!draft || Date.now()-draft.updatedAt>86400000 || !vehicles.some(v=>v.id===draft.vehicleId) || !Number.isFinite(draft.distance) || draft.distance<=0 || !Number.isFinite(draft.startedAt) || !Number.isFinite(draft.baseline) || !Array.isArray(draft.points) || typeof draft.id!=='string')return;
      tripId.current=draft.id;baseline.current=draft.baseline;started.current=draft.startedAt;endedAt.current=draft.updatedAt;
      distanceRef.current=draft.distance;setDistance(draft.distance);setStartedAt(draft.startedAt);setVehicleId(draft.vehicleId);
      const points=draft.points.filter((p:Sample)=>[p.latitude,p.longitude,p.accuracy,p.timestamp].every(Number.isFinite)).slice(-1500);
      setRoutePoints(points);
      setTrackingSeconds(Math.max(0,Math.floor((draft.updatedAt-draft.startedAt)/1000)));
      setNotice(t("Traseu recuperat pe acest dispozitiv. Reia GPS-ul sau salvează distanța deja înregistrată.", "Trip recovered on this device. Resume GPS or save the recorded distance."));
    }catch{/* Storage can be disabled. */}
  // Restore once for this signed-in account, never when the odometer refreshes.
  },[draftKey,preview]);
  useEffect(()=>{
    if(preview || nativeMode.current || !started.current || distance<=0)return;
    try{if(saved){localStorage.removeItem(draftKey);return;}localStorage.setItem(draftKey,JSON.stringify({id:tripId.current,vehicleId:vehicleId||vehicles[0]?.id,baseline:baseline.current,startedAt:started.current,updatedAt:endedAt.current??Date.now(),distance,points:routePoints}));}catch{/* Preserve the live trip if storage is full. */}
  },[distance,routePoints,saved,draftKey,preview,vehicleId,vehicles]);
  const stop = () => {
    if(nativeMode.current){void nativeTracking.stop(ownerId).then(value=>{if(value)applyNative(value);}).catch(e=>setError(e instanceof Error?e.message:'Nu s-a putut opri GPS-ul.'));return;}

    if (watcher.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) navigator.geolocation.clearWatch(watcher.current);
    watcher.current = null;
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    previous.current = null;
    endedAt.current=Date.now();
    setFinalizeOnStop(true);
    if (distanceRef.current <= 0) setNotice(t('Călătorie oprită. Nu a fost înregistrată o deplasare GPS validă; kilometrajul nu a fost modificat.', 'Drive stopped. No valid GPS movement was recorded; vehicle mileage has not changed.'));
    setActive(false);
  };
  useEffect(() => {
    if (!active || native) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active, native]);
  useEffect(() => () => { if (watcher.current !== null) navigator.geolocation.clearWatch(watcher.current); if (tick.current) clearInterval(tick.current); }, []);
  const start = () => {
    if(hasNativeTracking()&&!preview){
      if(nativeStarting.current || saveInFlight.current)return;
      const car=vehicles.find(v=>v.id===vehicleId)||vehicles[0];if(!car){setError(t("Selectează o mașină înainte de pornire.", "Select a vehicle before starting."));return;}
      nativeStarting.current=true;setError('');
      void (async()=>{try{
        if(saved)await nativeTracking.clear(ownerId);
        const value=await nativeTracking.start({id:tripId.current&&!saved?tripId.current:crypto.randomUUID(),ownerId,vehicleId:car.id,baseline:car.odometer});
        setSaved(false);setNotice('');applyNative(value);
      }catch(e){setError(e instanceof Error?e.message:t("Nu s-a putut porni urmărirea GPS.", "GPS tracking could not start."));}finally{nativeStarting.current=false;}})();return;
    }

    const resume=distanceRef.current>0 && !saved;
    if (preview) { setError(t("GPS-ul nu este activ în modul demonstrativ.", "GPS is disabled in the design preview.")); return; }
    if (!window.isSecureContext || !('geolocation' in navigator)) { setError(t("GPS-ul necesită HTTPS și un browser cu localizare.", "GPS requires HTTPS and a browser with location support.")); return; }
    if (watcher.current !== null) return;
    const car=vehicles.find(v=>v.id===vehicleId)||vehicles[0];
    if(!car){setError(t("Selectează o mașină înainte de pornire.", "Select a vehicle before starting."));return;}
    if(!resume){baseline.current=car.odometer; tripId.current=crypto.randomUUID();} endedAt.current=null; setSaved(false);
    setClock(new Date().toLocaleTimeString(locale));
    if(!resume){setStartedAt(null);setDistance(0);distanceRef.current=0;setRoutePoints([]);setTrackingSeconds(0);started.current=null;}
    setFinalizeOnStop(false);
    setSignal('requesting');lastFix.current=0;setError('');setNotice('');previous.current=null;
    tick.current = setInterval(() => { setTrackingSeconds(started.current ? Math.floor((Date.now() - started.current) / 1000) : 0); setClock(new Date().toLocaleTimeString(locale)); }, 1000);
    watcher.current = navigator.geolocation.watchPosition(
      value => {
        const next = browserGPSFix(value);
        if (!next || next.timestamp > Date.now() + 5000 || Date.now() - next.timestamp > 15000) return;
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
      e => { setSignal('lost'); setError(e.code === 1 ? t("Permisiune refuzată. Permite locația din setările site-ului și reîncarcă pagina.", "Location permission denied. Allow location in your browser or device settings, then try again.") : t("Semnal GPS temporar indisponibil. Urmărirea rămâne pornită și încearcă din nou.", "GPS is temporarily unavailable. Tracking will retry automatically.")); if (e.code === 1) stop(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    setActive(true);
  };
  const saveTrip = async () => {
    if(saved || saveInFlight.current)return;
    const id = vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0]?.id;
    if (active) { setError(t("Oprește urmărirea înainte de salvare.", "Stop tracking before saving.")); return; }
    if (!id || !started.current || distanceRef.current <= 0 || preview) { setError(t("Selectează o mașină și înregistrează o distanță validă.", "Select a vehicle and record a valid distance.")); return; }
    const ended = endedAt.current ?? Date.now();
    saveInFlight.current=true;
    setSaving(true);
    try {
      let finalPoints = routePoints;
      // Read the durable final snapshot, not a potentially stale two-second UI poll.
      if(nativeMode.current){
        const finalTrip=await nativeTracking.snapshot(ownerId);
        if(!finalTrip || finalTrip.active || finalTrip.id!==tripId.current)throw Error('Traseul GPS nu este încă finalizat. Reîncearcă salvarea.');
        finalPoints = finalTrip.points;
        distanceRef.current=finalTrip.distance;
        endedAt.current=finalTrip.endedAt??finalTrip.updatedAt;
      }
      const finalEnd=endedAt.current??ended;
      const res = await fetch('/api/v1/smartdrive/vehicles/' + id + '/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id:tripId.current, syncMileage, expectedOdometer:baseline.current, distanceMeters: Math.round(distanceRef.current), durationSeconds: Math.max(1, Math.round((finalEnd - started.current) / 1000)), startedAt: new Date(started.current).toISOString(), endedAt: new Date(finalEnd).toISOString() }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Salvarea călătoriei a eșuat.');
      await storeTripRoutes(ownerId, [{ id: body.id, points: finalPoints }]);
      if(nativeMode.current){try{await nativeTracking.clear(ownerId);}catch{throw Error('Călătoria a fost salvată, dar arhiva locală nu a putut fi curățată. Reîncearcă salvarea.');}}
      setSaved(true); setNotice(syncMileage ? 'Călătorie salvată. Distanța GPS a fost adăugată kilometrajului și planului de întreținere. Verifică periodic valoarea cu bordul mașinii.' : 'Călătoria GPS a fost salvată separat.'); setError('');
      window.dispatchEvent(new Event('autocare-trips-updated'));
      try{await onSaved();}catch{setNotice('Călătoria a fost salvată. Reîncarcă pagina pentru kilometrajul actualizat.');}
    } catch(e) { setError(e instanceof Error ? e.message : 'Salvarea a eșuat.'); }
    finally { saveInFlight.current=false;setSaving(false); }
  };
  // Also catches trips stopped from the notification while the WebView was closed.
  // Failed requests retain the native snapshot; retry when connectivity returns.
  useEffect(()=>{
    const retry=()=>{if(document.visibilityState==='visible')setSaveRetry(value=>value+1);};
    window.addEventListener('online',retry);
    document.addEventListener('visibilitychange',retry);
    return()=>{window.removeEventListener('online',retry);document.removeEventListener('visibilitychange',retry);};
  },[]);
  useEffect(()=>{
    if((!native&&!finalizeOnStop) || active || automatic || saved || !endedAt.current || distanceRef.current<=0)return;
    void saveTrip();
    // Finalization, rather than each GPS poll, triggers one save attempt.
  },[native,finalizeOnStop,active,automatic,saved,startedAt,saveRetry]);
  const currentCar = vehicles.find(vehicle => vehicle.id === vehicleId) ?? vehicles[0];
  const currentPosition = latestGPSFix(mapPosition, idleLocation.position);
  const telemetry = gpsTelemetry(currentPosition, clock);
  const status = active && signal === 'requesting' && !currentPosition ? 'requesting' : gpsSignal({ position: currentPosition, now: clock, requested: active || idleLocation.waiting, failed: signal === 'lost' && active || !!idleLocation.error, denied: !!error && !active && !telemetry.fresh });
  const speed = active ? telemetry.speed : null;
  const phase = saving ? 'saving' : waitingCar && active ? 'reconnecting' : active && awaitingMotion ? 'waiting' : active && !startedAt ? 'locating' : active ? 'driving' : saved && distance > 0 ? 'saved' : finalizeOnStop || distance > 0 ? 'stopped' : 'ready';
  const driveButton = (!active ? <button type="button" className="primary" disabled={saving || preview || !currentCar || (automatic&&!saved)} onClick={start}><Play size={17}/> {automatic&&!saved ? (locale.startsWith('en')?'Awaiting trip sync':'În așteptarea sincronizării') : distance>0&&!saved ? (english ? 'Resume drive' : 'Reia călătoria') : (english ? 'Start Drive' : 'Pornește călătoria')}</button> : <button type="button" className="ac-drive-stop" onClick={stop}><Square size={17}/> {english ? 'Stop Drive' : 'Oprește călătoria'}</button>);
  return <section className="ac-smartdrive-trip" aria-label="SmartDrive GPS">
    <div className="ac-drive-live-content" hidden={bluetoothOnly}>
    <div className="ac-smartdrive-trip-heading"><span className="ac-premium-kicker"><Route size={18}/> SMARTDRIVE · GPS</span><h3>{t('Fiecare drum, sub control.', 'Every drive, in focus.')}</h3><p>{t('Harta ta în timp real. Călătoriile tale, în siguranță.', 'Your live map. Your journey, clearly recorded.')}</p></div>
    <div className="ac-drive-cockpit">
      <MapStage title={english ? 'Live route' : 'Traseu în timp real'} english={english} actions={driveButton}>
      <div className="ac-smartdrive-map">
        <RoadMapView
          points={routePoints}
          position={currentPosition}
          onLocate={!active && !preview ? idleLocation.locate : undefined}
          locating={idleLocation.waiting || (active && (signal === 'waiting' || signal === 'requesting'))}
          locationError={currentPosition && !telemetry.fresh ? t('Ultima poziție cunoscută · semnal GPS pierdut', 'Last known position · GPS signal lost') : !active ? idleLocation.error : undefined}
          active={active}
          english={locale.startsWith('en')}
        />
        {speed !== null && <div className="ac-drive-speed"><strong>{speed}</strong><span>km/h</span></div>}
        <div className="ac-drive-map-footer">
          <span><MapPin size={16}/> {locale.startsWith('en') ? 'Recorded route · GPS estimate' : 'Traseu înregistrat · estimare GPS'}</span>

        </div>
      </div>
      </MapStage>
    <div className="ac-drive-console">
    <DriveSessionSummary distance={distance} seconds={trackingSeconds} phase={phase} accuracy={telemetry.accuracy} speed={speed} signal={status} english={english}/>
    {vehicles.length > 0 && <label className="ac-drive-vehicle">{t('Mașina pentru călătorie', 'Your vehicle')} <select value={vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0].id} disabled={active || (distance>0 && !saved)} onChange={e => setVehicleId(e.target.value)}>{vehicles.map(v => <option data-user-content key={v.id} value={v.id}>{v.brand} {v.model}{v.plate ? ' · ' + v.plate : ''}</option>)}</select></label>}
    <div className="ac-smartdrive-trip-controls">
      {driveButton}
      {!active && !automatic && distance > 0 && <button type="button" disabled={saving || preview || saved} onClick={() => void saveTrip()}>{saved ? t("Călătorie salvată", "Trip saved") : saving ? 'Se salvează…' : syncMileage ? t("Salvează și sincronizează", "Save and sync mileage") : t("Salvează călătoria GPS", "Save GPS trip")}</button>}
      {!active && !automatic && (distance>0 || (native&&startedAt!==null)) && !saved && <button type="button" disabled={saving} onClick={()=>{if(!window.confirm(t("Renunți la traseul nesalvat?", "Discard the unsaved trip?")))return;if(nativeMode.current){void nativeTracking.clear(ownerId).then(()=>{distanceRef.current=0;started.current=null;setDistance(0);setRoutePoints([]);setStartedAt(null);setTrackingSeconds(0);setNotice('');setError('');}).catch(e=>setError(e instanceof Error?e.message:'GPS indisponibil.'));return;}distanceRef.current=0;started.current=null;previous.current=null;setDistance(0);setRoutePoints([]);setStartedAt(null);setTrackingSeconds(0);setNotice('');setError('');try{localStorage.removeItem(draftKey);}catch{/* Storage unavailable. */}}}>{t('Renunță la traseu', 'Discard trip')}</button>}
      <span><MapPin size={15}/> {active ? t('Înregistrare pornită', 'Recording enabled') : t('Înregistrare oprită', 'Recording off')}</span>
    </div>
    {!automatic&&<label className="ac-smartdrive-sync"><input type="checkbox" checked={syncMileage} disabled={saving||saved} onChange={e=>setSyncMileage(e.target.checked)}/> {t('Adaugă distanța validă la kilometraj și actualizează planul de întreținere la salvare.', 'Sync recorded distance with vehicle mileage and maintenance when saving.')}</label>}
    </div>
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
    </div>
    <div hidden={!bluetoothOnly}><AutoDrivePanel ownerId={ownerId} vehicles={vehicles} english={locale.startsWith('en')} onUpdated={onSaved} preview={preview} visible={bluetoothVisible}/></div>
    {notice && <p role="status">{notice}</p>}
    {error && <p className="ac-smartdrive-trip-error" role="alert">{error}</p>}
  </section>;
}
