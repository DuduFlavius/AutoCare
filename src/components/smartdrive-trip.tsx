'use client';
import {useApplicationLocale} from './application-locale';
import { useEffect, useRef, useState } from 'react';
import AutoDrivePanel from './auto-drive-panel';
import DriveSessionSummary from './drive-session-summary';
import dynamic from 'next/dynamic';
import { MapPin, Play, Square, Route } from 'lucide-react';

import {hasNativeTracking,nativeTracking,type NativeTrip} from '@/lib/native-tracking';
import { acceptGPSFix, type GPSFix as Sample } from '@/lib/gps-tracking';
const RoadMapView=dynamic(()=>import('./road-map'),{ssr:false});
export default function SmartDriveTrip({ preview, vehicles, onSaved, ownerId }: { preview: boolean; ownerId:string; vehicles: { id: string; brand: string; model: string; odometer:number }[]; onSaved:()=>Promise<unknown> }) {

  const locale=useApplicationLocale();
  const [waitingCar,setWaitingCar]=useState(false);
  const [awaitingMotion,setAwaitingMotion]=useState(false);
  const [mapPosition,setMapPosition]=useState<Sample|null>(null);
  const [locating,setLocating]=useState(false);
  const [locationMessage,setLocationMessage]=useState('');
  const locate = () => {
    if (!navigator.geolocation) { setLocationMessage(locale.startsWith('en') ? 'Location is not supported on this device.' : 'Localizarea nu este disponibilă pe acest dispozitiv.'); return; }
    setLocating(true); setLocationMessage('');
    navigator.geolocation.getCurrentPosition(position => {
      setMapPosition({latitude:position.coords.latitude,longitude:position.coords.longitude,accuracy:position.coords.accuracy,timestamp:position.timestamp});
      setLocating(false);
      setLocationMessage(locale.startsWith('en') ? `Position located · accuracy approximately ${Math.round(position.coords.accuracy)} m. This does not record a trip or change mileage.` : `Poziție localizată · precizie aproximativă ${Math.round(position.coords.accuracy)} m. Nu înregistrează un traseu și nu modifică kilometrajul.`);
    }, error => {
      setLocating(false);
      setLocationMessage(error.code===1 ? (locale.startsWith('en') ? 'Allow location access in your phone or browser settings.' : 'Permite accesul la locație din setările telefonului sau browserului.') : (locale.startsWith('en') ? 'Position unavailable. Check GPS and try again outdoors.' : 'Poziția nu este disponibilă. Verifică GPS-ul și încearcă din nou în aer liber.'));
    }, {enableHighAccuracy:true,maximumAge:0,timeout:20000});
  };
  useEffect(() => {
    if (preview || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        if (![coords.latitude, coords.longitude, coords.accuracy, timestamp].every(Number.isFinite))
          return;
        setMapPosition({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: coords.accuracy,
          timestamp,
        });
        setLocationMessage('');
      },
      (error) => {
        setLocationMessage(
          error.code === 1
            ? locale.startsWith('en')
              ? 'Allow precise location in your phone settings to show your position.'
              : 'Permite locația precisă în setările telefonului pentru afișarea poziției tale.'
            : locale.startsWith('en')
              ? 'Waiting for your GPS position…'
              : 'Se așteaptă poziția ta GPS…',
        );
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [preview, locale]);
  const [automatic,setAutomatic]=useState(false);
  const [native,setNative]=useState(false);
  const nativeMode=useRef(false);
  const nativeStarting=useRef(false);
const [active, setActive] = useState(false);
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
  const [signal, setSignal] = useState<'waiting'|'ok'|'lost'>('waiting');
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
      setNotice('Traseu recuperat pe acest dispozitiv. Reia GPS-ul sau salvează distanța deja înregistrată.');
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
    setActive(false);
  };
  useEffect(() => () => { if (watcher.current !== null) navigator.geolocation.clearWatch(watcher.current); if (tick.current) clearInterval(tick.current); }, []);
  const start = () => {
    if(hasNativeTracking()&&!preview){
      if(nativeStarting.current || saveInFlight.current)return;
      const car=vehicles.find(v=>v.id===vehicleId)||vehicles[0];if(!car){setError('Selectează o mașină înainte de pornire.');return;}
      nativeStarting.current=true;setError('');
      void (async()=>{try{
        if(saved)await nativeTracking.clear(ownerId);
        const value=await nativeTracking.start({id:tripId.current&&!saved?tripId.current:crypto.randomUUID(),ownerId,vehicleId:car.id,baseline:car.odometer});
        setSaved(false);setNotice('');applyNative(value);
      }catch(e){setError(e instanceof Error?e.message:'Nu s-a putut porni urmărirea GPS.');}finally{nativeStarting.current=false;}})();return;
    }

    const resume=distanceRef.current>0 && !saved;
    if (preview) { setError('GPS-ul nu este activ în modul demonstrativ.'); return; }
    if (!window.isSecureContext || !('geolocation' in navigator)) { setError('GPS-ul necesită HTTPS și un browser cu localizare.'); return; }
    if (watcher.current !== null) return;
    const car=vehicles.find(v=>v.id===vehicleId)||vehicles[0];
    if(!car){setError('Selectează o mașină înainte de pornire.');return;}
    if(!resume){baseline.current=car.odometer; tripId.current=crypto.randomUUID();} endedAt.current=null; setSaved(false);
    setClock(new Date().toLocaleTimeString(locale));
    if(!resume){setStartedAt(Date.now());setDistance(0);distanceRef.current=0;setRoutePoints([]);setTrackingSeconds(0);started.current=Date.now();}
    setSignal('waiting');lastFix.current=0;setError('');setNotice('');previous.current=null;
    tick.current = setInterval(() => { setTrackingSeconds(Math.floor((Date.now() - (started.current ?? Date.now())) / 1000)); setClock(new Date().toLocaleTimeString(locale)); }, 1000);
    watcher.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        const next: Sample = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, speed:coords.speed, timestamp };
        if(![next.latitude,next.longitude,next.accuracy,next.timestamp].every(Number.isFinite)||next.accuracy>50||next.accuracy<0)return;
        if(timestamp>Date.now()+5000 || Date.now()-timestamp>15000)return;
        lastFix.current=Date.now(); setSignal('ok');
        const accepted=acceptGPSFix(previous.current,next);
        if(!accepted) return;
        distanceRef.current+=accepted.meters; setDistance(distanceRef.current);
        previous.current=accepted.point;
        setRoutePoints(points=>[...points.slice(-1499),accepted.point]);

      },
      e => { setSignal('lost'); setError(e.code === 1 ? 'Permisiune refuzată. Permite locația din setările site-ului și reîncarcă pagina.' : 'Semnal GPS temporar indisponibil. Urmărirea rămâne pornită și încearcă din nou.'); if (e.code === 1) stop(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    setActive(true);
  };
  const saveTrip = async () => {
    if(saved || saveInFlight.current)return;
    const id = vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0]?.id;
    if (active) { setError('Oprește urmărirea înainte de salvare.'); return; }
    if (!id || !started.current || distanceRef.current <= 0 || preview) { setError('Selectează o mașină și înregistrează o distanță validă.'); return; }
    const ended = endedAt.current ?? Date.now();
    saveInFlight.current=true;
    setSaving(true);
    try {
      // Read the durable final snapshot, not a potentially stale two-second UI poll.
      if(nativeMode.current){
        const finalTrip=await nativeTracking.snapshot(ownerId);
        if(!finalTrip || finalTrip.active || finalTrip.id!==tripId.current)throw Error('Traseul GPS nu este încă finalizat. Reîncearcă salvarea.');
        distanceRef.current=finalTrip.distance;
        endedAt.current=finalTrip.endedAt??finalTrip.updatedAt;
      }
      const finalEnd=endedAt.current??ended;
      const res = await fetch('/api/v1/smartdrive/vehicles/' + id + '/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id:tripId.current, syncMileage, expectedOdometer:baseline.current, distanceMeters: Math.round(distanceRef.current), durationSeconds: Math.max(1, Math.round((finalEnd - started.current) / 1000)), startedAt: new Date(started.current).toISOString(), endedAt: new Date(finalEnd).toISOString() }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Salvarea călătoriei a eșuat.');
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
  return <section className="ac-smartdrive-trip" aria-label="SmartDrive GPS">
    <div className="ac-smartdrive-trip-heading"><span className="ac-premium-kicker"><Route size={18}/> SMARTDRIVE · GPS</span><h3>Traseul tău, în timp real</h3></div>
    <DriveSessionSummary distance={distance} seconds={trackingSeconds} phase={saving?'saving':waitingCar&&active?'reconnecting':active&&awaitingMotion?'waiting':active?'driving':saved&&distance>0?'saved':'ready'} accuracy={mapPosition?.accuracy??null} english={locale.startsWith('en')}/>
    {vehicles.length > 0 && <label>Mașina pentru călătorie <select value={vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0].id} disabled={active || (distance>0 && !saved)} onChange={e => setVehicleId(e.target.value)}>{vehicles.map(v => <option data-user-content key={v.id} value={v.id}>{v.brand} {v.model}</option>)}</select></label>}
    {!automatic&&<label className="ac-smartdrive-sync" style={{display:'flex',gap:12,alignItems:'center',padding:16,border:'1px solid #dbe5f3',borderRadius:14,marginBottom:16}}><input type="checkbox" checked={syncMileage} disabled={saving||saved} onChange={e=>setSyncMileage(e.target.checked)}/> Adaugă distanța GPS la kilometraj la salvare. Actualizează automat uleiul, distribuția și celelalte intervale, păstrând kilometrajul intervențiilor.</label>}
    <div className="ac-smartdrive-trip-controls">
      {!active ? <button type="button" className="primary" disabled={saving||(automatic&&!saved)} onClick={start}><Play size={17}/> {automatic&&!saved ? (locale.startsWith('en')?'Awaiting trip sync':'În așteptarea sincronizării') : distance>0&&!saved ? 'Reia GPS' : 'Pornește GPS'}</button> : <button type="button" className="primary" style={{background:"#b42332",color:"#fff",borderColor:"#b42332"}} onClick={stop}><Square size={17}/> Oprește GPS</button>}
      {!active && !automatic && distance > 0 && <button type="button" disabled={saving || preview || saved} onClick={() => void saveTrip()}>{saved ? 'Călătorie salvată' : saving ? 'Se salvează…' : syncMileage ? 'Salvează și sincronizează' : 'Salvează călătoria GPS'}</button>}
      {!active && !automatic && (distance>0 || (native&&startedAt!==null)) && !saved && <button type="button" disabled={saving} onClick={()=>{if(!window.confirm('Renunți la traseul nesalvat?'))return;if(nativeMode.current){void nativeTracking.clear(ownerId).then(()=>{distanceRef.current=0;started.current=null;setDistance(0);setRoutePoints([]);setStartedAt(null);setTrackingSeconds(0);setNotice('');setError('');}).catch(e=>setError(e instanceof Error?e.message:'GPS indisponibil.'));return;}distanceRef.current=0;started.current=null;previous.current=null;setDistance(0);setRoutePoints([]);setStartedAt(null);setTrackingSeconds(0);setNotice('');setError('');try{localStorage.removeItem(draftKey);}catch{/* Storage unavailable. */}}}>Renunță la traseu</button>}
      <span><MapPin size={15}/> {active ? 'GPS activ' : 'GPS oprit'}</span>
    </div>
    <div className="service-reminder-box" data-workspace-ui><strong>{locale.startsWith('en')?'Current vehicle mileage: ':'Kilometraj actual al mașinii: '}{(vehicles.find(v=>v.id===vehicleId)??vehicles[0])?.odometer.toLocaleString(locale)} km</strong><p>{locale.startsWith('en')?'Saved sessions update maintenance mileage.':'Sesiunile salvate actualizează kilometrajul folosit pentru întreținere.'}</p><a href="?tab=%C3%8Entre%C8%9Binere">{locale.startsWith('en')?'View maintenance and remaining kilometres':'Vezi intervențiile și kilometrii rămași'}</a></div>
    <div className="ac-smartdrive-map" style={{margin:'18px 0',padding:12,background:'#fff',border:'1px solid #dbe5f3',borderRadius:18}}>
      <strong style={{display:'block',marginBottom:8,color:'#172b48'}}>Hartă rutieră · GPS în timp real</strong>
      {!active && routePoints.length===0 && <button type="button" disabled={locating||preview} onClick={locate} style={{marginBottom:12}}><MapPin size={17}/> {locating ? (locale.startsWith('en')?'Locating…':'Se caută poziția…') : (locale.startsWith('en')?'Show my location':'Arată poziția mea')}</button>}
      {locationMessage && !active && <p role="status" style={{fontSize:13,marginBottom:12}}>{locationMessage}</p>}
      <RoadMapView points={routePoints} position={mapPosition && (!routePoints.at(-1) || mapPosition.timestamp >= routePoints.at(-1)!.timestamp) ? mapPosition : routePoints.at(-1)} active={active} english={locale.startsWith('en')}/>
      <p style={{fontSize:12,color:'#536681',margin:'9px 0 0'}}>Traseul parcurs este afișat în albastru. Coordonatele rămân pe acest dispozitiv pentru recuperarea traseului și nu sunt trimise la server.</p>
    </div>
    {active && signal === 'lost' && <div role="alert" style={{background:'#fff3df',color:'#8a4600',border:'1px solid #ffd18a',borderRadius:12,padding:13,margin:'12px 0',fontWeight:700}}>Semnal GPS pierdut sau întârziat peste 25 secunde. Verifică locația și permisiunile telefonului. Distanța nu crește fără puncte valide.</div>}
    {active && signal === 'waiting' && <p role="status" style={{color:'#815500'}}>Se caută semnal GPS de precizie…</p>}
    <p role="status">{active ? 'Urmărire în desfășurare' : 'Urmărire oprită'}</p>
    <p role="status"><strong>{native ? 'GPS Android/iOS nativ · disponibil în fundal' : 'GPS în browser · fără urmărire în fundal'}</strong></p>
    {native && <button type="button" onClick={() => void import('@/lib/native-tracking').then(({nativeAutomation}) => nativeAutomation.openSettings()).catch(() => setError('Deschide Setările telefonului → Aplicații → AutoCare.'))}>Deschide permisiunile telefonului</button>}
    {native && <p className="small muted">După Pornește GPS trebuie să apară notificarea permanentă „AutoCare · GPS activ”. Pe Android, verifică în Setări → Aplicații → AutoCare: locație precisă, notificări permise și Baterie → Fără restricții. Pentru pornirea automată prin Bluetooth, permite locația „Tot timpul”.</p>}
    <p>{native ? 'Urmărirea nativă continuă în fundal, cu permisiunea telefonului, până alegi Oprește GPS. Oprirea forțată a aplicației sau restricțiile telefonului pot întrerupe înregistrarea.' : 'Menține aplicația deschisă pentru înregistrare. Browserul poate opri GPS-ul în fundal sau cu ecranul blocat. Segmentele fără semnal nu sunt adăugate la distanță.'}</p>

    {waitingCar&&active&&<p role="status">{locale.startsWith('en')?'Car connection interrupted. Distance is paused while reconnection is checked.':'Conexiunea mașinii este întreruptă. Kilometrii sunt opriți cât se verifică reconectarea.'}</p>}
    {automatic&&!active&&!saved&&distance>0&&<p role="status">{locale.startsWith('en')?'Automatic trip saved on this device; waiting for safe account sync.':'Traseu automat păstrat pe dispozitiv; în așteptarea sincronizării sigure în cont.'}</p>}
    <AutoDrivePanel ownerId={ownerId} vehicles={vehicles} english={locale.startsWith('en')} onUpdated={onSaved} preview={preview}/>
    {notice && <p role="status">{notice}</p>}
    {error && <p className="ac-smartdrive-trip-error" role="alert">{error}</p>}
  </section>;
}
