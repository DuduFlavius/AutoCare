'use client';
import {useApplicationLocale} from './application-locale';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Play, Square, Route } from 'lucide-react';

import { acceptGPSFix, segmentMeters, type GPSFix as Sample } from '@/lib/gps-tracking';
export default function SmartDriveTrip({ preview, vehicles, onSaved, ownerId }: { preview: boolean; ownerId:string; vehicles: { id: string; brand: string; model: string; odometer:number }[]; onSaved:()=>Promise<unknown> }) {

  const locale=useApplicationLocale();
const [active, setActive] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [distance, setDistance] = useState(0);
  const [error, setError] = useState('');
  const [syncMileage,setSyncMileage]=useState(true);
  const [saved,setSaved]=useState(false);
  const tripId=useRef('');
  const baseline=useRef(0);
  const endedAt=useRef<number|null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [signal, setSignal] = useState<'waiting'|'ok'|'lost'>('waiting');
  const lastFix = useRef<number>(0);
  const [routePoints, setRoutePoints] = useState<Sample[]>([]);
  const [mapZoom, setMapZoom] = useState(15);
  const [follow, setFollow] = useState(true);
  const [mapCenter, setMapCenter] = useState<{latitude:number;longitude:number}|null>(null);
  const [trackingSeconds, setTrackingSeconds] = useState(0);
  const [clock, setClock] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const watcher = useRef<number | null>(null);
  const previous = useRef<Sample | null>(null);
  const started = useRef<number | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const distanceRef = useRef(0);
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
    if(preview)return;
    try{
      const draft=JSON.parse(localStorage.getItem(draftKey)||'null');
      if(!draft || Date.now()-draft.updatedAt>86400000 || !vehicles.some(v=>v.id===draft.vehicleId) || !Number.isFinite(draft.distance) || draft.distance<=0 || !Number.isFinite(draft.startedAt) || !Number.isFinite(draft.baseline) || !Array.isArray(draft.points) || typeof draft.id!=='string')return;
      tripId.current=draft.id;baseline.current=draft.baseline;started.current=draft.startedAt;endedAt.current=draft.updatedAt;
      distanceRef.current=draft.distance;setDistance(draft.distance);setStartedAt(draft.startedAt);setVehicleId(draft.vehicleId);
      const points=draft.points.filter((p:Sample)=>[p.latitude,p.longitude,p.accuracy,p.timestamp].every(Number.isFinite)).slice(-1500);
      setRoutePoints(points);if(points.length)setMapCenter(points[points.length-1]);
      setTrackingSeconds(Math.max(0,Math.floor((draft.updatedAt-draft.startedAt)/1000)));
      setNotice('Traseu recuperat pe acest dispozitiv. Reia GPS-ul sau salvează distanța deja înregistrată.');
    }catch{/* Storage can be disabled. */}
  // Restore once for this signed-in account, never when the odometer refreshes.
  },[draftKey,preview]);
  useEffect(()=>{
    if(preview || !started.current || distance<=0)return;
    try{if(saved){localStorage.removeItem(draftKey);return;}localStorage.setItem(draftKey,JSON.stringify({id:tripId.current,vehicleId:vehicleId||vehicles[0]?.id,baseline:baseline.current,startedAt:started.current,updatedAt:endedAt.current??Date.now(),distance,points:routePoints}));}catch{/* Preserve the live trip if storage is full. */}
  },[distance,routePoints,saved,draftKey,preview,vehicleId,vehicles]);
  const stop = () => {
    if (watcher.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) navigator.geolocation.clearWatch(watcher.current);
    watcher.current = null;
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    previous.current = null;
    endedAt.current=Date.now();
    setActive(false);
  };
  useEffect(() => () => { if (watcher.current !== null) navigator.geolocation.clearWatch(watcher.current); if (tick.current) clearInterval(tick.current); }, []);
  const start = () => {
    const resume=distanceRef.current>0 && !saved;
    if (preview) { setError('GPS-ul nu este activ în modul demonstrativ.'); return; }
    if (!window.isSecureContext || !('geolocation' in navigator)) { setError('GPS-ul necesită HTTPS și un browser cu localizare.'); return; }
    if (watcher.current !== null) return;
    const car=vehicles.find(v=>v.id===vehicleId)||vehicles[0];
    if(!car){setError('Selectează o mașină înainte de pornire.');return;}
    if(!resume){baseline.current=car.odometer; tripId.current=crypto.randomUUID();} endedAt.current=null; setSaved(false);
    setClock(new Date().toLocaleTimeString(locale));
    if(!resume){setStartedAt(Date.now());setDistance(0);distanceRef.current=0;setRoutePoints([]);setMapCenter(null);setTrackingSeconds(0);started.current=Date.now();}
    setFollow(true);setAccuracy(null);setSignal('waiting');lastFix.current=0;setError('');setNotice('');previous.current=null;
    tick.current = setInterval(() => { setTrackingSeconds(Math.floor((Date.now() - (started.current ?? Date.now())) / 1000)); setClock(new Date().toLocaleTimeString(locale)); }, 1000);
    watcher.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        const next: Sample = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, speed:coords.speed, timestamp };
        if(![next.latitude,next.longitude,next.accuracy,next.timestamp].every(Number.isFinite)||next.accuracy>50||next.accuracy<0)return;
        if(timestamp>Date.now()+5000 || Date.now()-timestamp>15000)return;
        setAccuracy(Math.round(next.accuracy)); lastFix.current=Date.now(); setSignal('ok');
        const accepted=acceptGPSFix(previous.current,next);
        if(!accepted) return;
        distanceRef.current+=accepted.meters; setDistance(distanceRef.current);
        previous.current=accepted.point;
        setRoutePoints(points=>[...points.slice(-1499),accepted.point]);
        if(follow) setMapCenter({latitude:next.latitude,longitude:next.longitude});
      },
      e => { setSignal('lost'); setError(e.code === 1 ? 'Permisiune refuzată. Permite locația din setările site-ului și reîncarcă pagina.' : 'Semnal GPS temporar indisponibil. Urmărirea rămâne pornită și încearcă din nou.'); if (e.code === 1) stop(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    setActive(true);
  };
  const saveTrip = async () => {
    if(saved || saving)return;
    const id = vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0]?.id;
    if (active) { setError('Oprește urmărirea înainte de salvare.'); return; }
    if (!id || !started.current || distanceRef.current <= 0 || preview) { setError('Selectează o mașină și înregistrează o distanță validă.'); return; }
    const ended = endedAt.current ?? Date.now();
    setSaving(true);
    try {
      const res = await fetch('/api/v1/smartdrive/vehicles/' + id + '/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id:tripId.current, syncMileage, expectedOdometer:baseline.current, distanceMeters: Math.round(distanceRef.current), durationSeconds: Math.max(1, Math.round((ended - started.current) / 1000)), startedAt: new Date(started.current).toISOString(), endedAt: new Date(ended).toISOString() }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Salvarea călătoriei a eșuat.');
      setSaved(true); setNotice(syncMileage ? 'Călătorie salvată. Distanța GPS a fost adăugată kilometrajului și planului de întreținere. Verifică periodic valoarea cu bordul mașinii.' : 'Călătoria GPS a fost salvată separat.'); setError('');
      window.dispatchEvent(new Event('autocare-trips-updated'));
      try{await onSaved();}catch{setNotice('Călătoria a fost salvată. Reîncarcă pagina pentru kilometrajul actualizat.');}
    } catch(e) { setError(e instanceof Error ? e.message : 'Salvarea a eșuat.'); }
    finally { setSaving(false); }
  };
  return <section className="ac-smartdrive-trip" aria-label="SmartDrive GPS">
    <div className="ac-smartdrive-trip-heading"><span className="ac-premium-kicker"><Route size={18}/> SMARTDRIVE · GPS</span><h3>Traseul tău, în timp real</h3></div>
    <div className="ac-smartdrive-trip-metric"><strong>{(distance / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })}</strong><span>km estimați · traseu filtrat în timp real</span></div>
    <div className="ac-smartdrive-live" aria-live="off">
      <div><span>Distanță parcursă</span><strong>{(distance / 1000).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</strong></div>
      <div><span>Ora actuală</span><strong>{clock || '--:--:--'}</strong></div>
      <div><span>Timp de la pornire</span><strong>{String(Math.floor(trackingSeconds / 3600)).padStart(2, '0')}:{String(Math.floor(trackingSeconds % 3600 / 60)).padStart(2, '0')}:{String(trackingSeconds % 60).padStart(2, '0')}</strong></div>
      <div><span>Început urmărire</span><strong>{startedAt === null ? '—' : new Date(startedAt).toLocaleTimeString(locale)}</strong></div>
    </div>
    {vehicles.length > 0 && <label>Mașina pentru călătorie <select value={vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0].id} disabled={active || (distance>0 && !saved)} onChange={e => setVehicleId(e.target.value)}>{vehicles.map(v => <option data-user-content key={v.id} value={v.id}>{v.brand} {v.model}</option>)}</select></label>}
    <div className="ac-smartdrive-trip-controls">
      {!active ? <button type="button" className="primary" disabled={saving} onClick={start}><Play size={17}/> {distance>0&&!saved ? 'Reia GPS' : 'Pornește GPS'}</button> : <button type="button" className="primary" style={{background:"#b42332",color:"#fff",borderColor:"#b42332"}} onClick={stop}><Square size={17}/> Oprește GPS</button>}
      {!active && distance > 0 && <button type="button" disabled={saving || preview || saved} onClick={() => void saveTrip()}>{saved ? 'Călătorie salvată' : saving ? 'Se salvează…' : syncMileage ? 'Salvează și sincronizează' : 'Salvează călătoria GPS'}</button>}
      {!active && distance>0 && !saved && <button type="button" disabled={saving} onClick={()=>{if(!window.confirm('Renunți la traseul nesalvat?'))return;distanceRef.current=0;started.current=null;previous.current=null;setDistance(0);setRoutePoints([]);setMapCenter(null);setStartedAt(null);setTrackingSeconds(0);setNotice('');setError('');try{localStorage.removeItem(draftKey);}catch{/* Storage unavailable. */}}}>Renunță la traseu</button>}
      <span><MapPin size={15}/> {active ? 'GPS activ' : 'GPS oprit'}</span>
    </div>
    <div className="ac-smartdrive-map" style={{margin:'18px 0',padding:12,background:'#fff',border:'1px solid #dbe5f3',borderRadius:18}}>
      <strong style={{display:'block',marginBottom:8,color:'#172b48'}}>Hartă rutieră · GPS în timp real</strong>
      {routePoints.length > 0 && mapCenter ? (() => {
        const zoom = mapZoom;
        const scale = 256 * Math.pow(2, zoom);
        const project = (lat:number,lon:number) => {
          const sin = Math.sin(Math.max(-85.0511,Math.min(85.0511,lat))*Math.PI/180);
          return {x:(lon+180)/360*scale,y:(0.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*scale};
        };
        const center = project(mapCenter.latitude,mapCenter.longitude);
        const tiles = [];
        const left = center.x-512, top = center.y-320;
        for(let tx=Math.floor(left/256);tx<=Math.floor((left+1024)/256);tx++) for(let ty=Math.floor(top/256);ty<=Math.floor((top+640)/256);ty++){
          const max=Math.pow(2,zoom);
          if(ty<0||ty>=max)continue;
          tiles.push(<image key={tx+'-'+ty} href={'https://tile.openstreetmap.org/'+zoom+'/'+((tx%max+max)%max)+'/'+ty+'.png'} x={tx*256-left} y={ty*256-top} width="256" height="256"/>);
        }
        const path=routePoints.map((p,i)=>{const q=project(p.latitude,p.longitude);return (i&&!p.breakBefore?'L':'M')+(q.x-left).toFixed(1)+' '+(q.y-top).toFixed(1)}).join(' ');
        const last=project(routePoints[routePoints.length-1].latitude,routePoints[routePoints.length-1].longitude);
        return <div style={{position:'relative',height:'clamp(330px,55vh,540px)',overflow:'hidden',borderRadius:16,border:'1px solid #d6e3f0',background:'#edf2f7'}}>
          <svg viewBox="0 0 1024 640" preserveAspectRatio="xMidYMid slice" style={{width:'100%',height:'100%',display:'block',background:'#edf2f7'}} aria-label="Hartă cu drumuri și traseul GPS parcurs">
            {tiles}
            {routePoints.length>1 && <><path d={path} fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/><path d={path} fill="none" stroke="#2475ed" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></>}
            <circle cx={last.x-left} cy={last.y-top} r="19" fill="#2475ed" opacity=".16"/><circle cx={last.x-left} cy={last.y-top} r="9" fill="#2475ed" stroke="white" strokeWidth="4"/>
          </svg>
          <span style={{position:'absolute',left:12,top:12,padding:'8px 12px',borderRadius:10,background:'#fff',color:'#173a70',fontWeight:750,fontSize:12,boxShadow:'0 2px 12px #0b254020'}}>GPS {!active ? '· OPRIT' : signal === 'lost' ? '· SEMNAL PIERDUT' : '· LIVE'} · ±{accuracy??'?'} m</span>
          <div style={{position:'absolute',right:12,top:12,display:'grid',gap:7}}>
            <button type="button" aria-label="Mărește harta" onClick={()=>setMapZoom(z=>Math.min(18,z+1))} style={{background:'white',color:'#173a70',borderRadius:9,padding:9}}>＋</button>
            <button type="button" aria-label="Micșorează harta" onClick={()=>setMapZoom(z=>Math.max(10,z-1))} style={{background:'white',color:'#173a70',borderRadius:9,padding:9}}>－</button>
            <button type="button" onClick={()=>{const p=routePoints[routePoints.length-1];setMapCenter({latitude:p.latitude,longitude:p.longitude});setFollow(true);}} style={{background:'white',color:'#173a70',borderRadius:9,padding:9,fontSize:12}}>Centrare</button>
          </div>
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style={{position:'absolute',left:12,bottom:12,padding:'6px 10px',borderRadius:8,background:'#ffffffeb',fontSize:11,color:'#345'}}>© OpenStreetMap contributors</a>
          <span style={{position:'absolute',right:12,bottom:12,padding:'8px 12px',borderRadius:10,background:'#fff',color:'#173a70',fontWeight:750,fontSize:12}}>{active ? (signal==='lost'?'● SEMNAL PIERDUT':routePoints.length>1 && routePoints[routePoints.length-1].timestamp-routePoints[routePoints.length-2].timestamp<15000 && segmentMeters(routePoints[routePoints.length-2],routePoints[routePoints.length-1])>12?'● ÎN MIȘCARE':'● STAȚIONARE'):'● CURSĂ OPRITĂ'}</span>
        </div>;
      })() : <div style={{padding:'48px 16px',textAlign:'center',background:'#f4f7fc',borderRadius:12,color:'#536681'}}>Pornește urmărirea și permite localizarea. Harta rutieră și traseul vor apărea aici.</div>}
      <p style={{fontSize:12,color:'#536681',margin:'9px 0 0'}}>Traseul parcurs este afișat în albastru. Coordonatele rămân pe acest dispozitiv pentru recuperarea traseului și nu sunt trimise la server.</p>
    </div>
    {active && signal === 'lost' && <div role="alert" style={{background:'#fff3df',color:'#8a4600',border:'1px solid #ffd18a',borderRadius:12,padding:13,margin:'12px 0',fontWeight:700}}>Semnal GPS pierdut sau întârziat peste 25 secunde. Verifică locația și menține aplicația în prim-plan. Distanța nu crește fără puncte valide.</div>}
    {active && signal === 'waiting' && <p role="status" style={{color:'#815500'}}>Se caută semnal GPS de precizie…</p>}
    <p role="status">{active ? 'Urmărire în desfășurare' : 'Urmărire oprită'}</p>
    <p>Menține aplicația deschisă pentru înregistrare. Browserul poate opri GPS-ul în fundal sau cu ecranul blocat. Segmentele fără semnal nu sunt adăugate la distanță.</p>
    <label className="ac-smartdrive-sync" style={{display:'flex',gap:12,alignItems:'center',padding:16,border:'1px solid #dbe5f3',borderRadius:14,marginBottom:16}}><input type="checkbox" checked={syncMileage} disabled={saving||saved} onChange={e=>setSyncMileage(e.target.checked)}/> Adaugă distanța GPS la kilometraj la salvare. Actualizează automat uleiul, distribuția și celelalte intervale, păstrând kilometrajul intervențiilor.</label>
    {notice && <p role="status">{notice}</p>}
    {error && <p className="ac-smartdrive-trip-error" role="alert">{error}</p>}
  </section>;
}
