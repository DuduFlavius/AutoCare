'use client';
import {useApplicationLocale} from './application-locale';
import { useEffect, useRef, useState } from 'react';
import { MapPin, Play, Square, Route } from 'lucide-react';

type Sample = { latitude: number; longitude: number; accuracy: number; timestamp: number };
const radians = (n: number) => n * Math.PI / 180;
export function segmentMeters(a: Sample, b: Sample): number {
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export default function SmartDriveTrip({ preview, vehicles }: { preview: boolean; vehicles: { id: string; brand: string; model: string }[] }) {

  const locale=useApplicationLocale();
const [active, setActive] = useState(false);
  const [vehicleId, setVehicleId] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [distance, setDistance] = useState(0);
  const [error, setError] = useState('');
  const [samples, setSamples] = useState(0);
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
  const stop = () => {
    if (watcher.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) navigator.geolocation.clearWatch(watcher.current);
    watcher.current = null;
    if (tick.current) clearInterval(tick.current);
    tick.current = null;
    previous.current = null;
    setActive(false);
  };
  useEffect(() => () => { if (watcher.current !== null) navigator.geolocation.clearWatch(watcher.current); if (tick.current) clearInterval(tick.current); }, []);
  const start = () => {
    if (preview) { setError('GPS-ul nu este activ în modul demonstrativ.'); return; }
    if (!window.isSecureContext || !('geolocation' in navigator)) { setError('GPS-ul necesită HTTPS și un browser cu localizare.'); return; }
    if (watcher.current !== null) return;
    setStartedAt(Date.now()); setClock(new Date().toLocaleTimeString(locale));
    setDistance(0); distanceRef.current = 0; setSamples(0); setRoutePoints([]); setMapCenter(null); setFollow(true); setAccuracy(null); setSignal('waiting'); lastFix.current = 0; setTrackingSeconds(0); setError(''); setNotice(''); previous.current = null; started.current = Date.now();
    tick.current = setInterval(() => { setTrackingSeconds(Math.floor((Date.now() - (started.current ?? Date.now())) / 1000)); setClock(new Date().toLocaleTimeString(locale)); }, 1000);
    watcher.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        const next: Sample = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp };
        // Reject inaccurate points and implausible GPS jumps; never change the odometer.
        if (!Number.isFinite(next.accuracy) || next.accuracy > 60) return;
        setAccuracy(Math.round(next.accuracy)); lastFix.current = Date.now(); setSignal('ok');
        if (previous.current) {
          const seconds = (next.timestamp - previous.current.timestamp) / 1000;
          const meters = segmentMeters(previous.current, next);
          // Avoid counting stationary GPS drift, old fixes and implausible jumps.
          if (seconds > 0 && seconds <= 90 && meters > Math.max(12, next.accuracy, previous.current.accuracy) && meters / seconds < 55) {
            distanceRef.current += meters;
            setDistance(distanceRef.current);
          }
        }
        previous.current = next; setSamples(v => v + 1);
        setRoutePoints(points => points.length >= 600 ? [...points.filter((_, i) => i % 2 === 0), next] : [...points, next]);
        if (follow) setMapCenter({latitude:next.latitude,longitude:next.longitude});
      },
      e => { setSignal('lost'); setError(e.code === 1 ? 'Permisiune refuzată. Permite locația din setările site-ului și reîncarcă pagina.' : 'Semnal GPS temporar indisponibil. Urmărirea rămâne pornită și încearcă din nou.'); if (e.code === 1) stop(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    setActive(true);
  };
  const saveTrip = async () => {
    const id = vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0]?.id;
    if (active) { setError('Oprește urmărirea înainte de salvare.'); return; }
    if (!id || !started.current || distanceRef.current <= 0 || preview) { setError('Selectează o mașină și înregistrează o distanță validă.'); return; }
    const ended = Date.now();
    setSaving(true);
    try {
      const res = await fetch('/api/v1/smartdrive/vehicles/' + id + '/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ distanceMeters: Math.round(distanceRef.current), durationSeconds: Math.max(1, Math.round((ended - started.current) / 1000)), startedAt: new Date(started.current).toISOString(), endedAt: new Date(ended).toISOString() }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Salvarea călătoriei a eșuat.');
      setNotice('Călătoria GPS a fost salvată. Istoricul se actualizează după reîncărcarea paginii. Kilometrajul de bord nu este modificat automat.'); setError('');
    } catch(e) { setError(e instanceof Error ? e.message : 'Salvarea a eșuat.'); }
    finally { setSaving(false); }
  };
  return <section className="ac-smartdrive-trip" aria-label="SmartDrive GPS">
    <div className="ac-smartdrive-trip-heading"><span className="ac-premium-kicker"><Route size={18}/> SMARTDRIVE · GPS</span><h3>Estimarea distanței unei călătorii</h3></div>
    <div className="ac-smartdrive-trip-metric"><strong>{(distance / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })}</strong><span>km estimați prin GPS · actualizare la fiecare citire validă</span></div>
    <div className="ac-smartdrive-live" aria-live="off">
      <div><span>Distanță parcursă</span><strong>{(distance / 1000).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</strong></div>
      <div><span>Ora actuală</span><strong>{clock || '--:--:--'}</strong></div>
      <div><span>Timp de la pornire</span><strong>{String(Math.floor(trackingSeconds / 3600)).padStart(2, '0')}:{String(Math.floor(trackingSeconds % 3600 / 60)).padStart(2, '0')}:{String(trackingSeconds % 60).padStart(2, '0')}</strong></div>
      <div><span>Început urmărire</span><strong>{startedAt === null ? '—' : new Date(startedAt).toLocaleTimeString(locale)}</strong></div>
    </div>
    <div className="ac-smartdrive-map" style={{margin:'18px 0',padding:12,background:'#fff',border:'1px solid #dbe5f3',borderRadius:18}}>
      <strong style={{display:'block',marginBottom:8,color:'#172b48'}}>Hartă rutieră · GPS în timp real</strong>
      {routePoints.length && mapCenter ? (() => {
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
        const path=routePoints.map((p,i)=>{const q=project(p.latitude,p.longitude);return (i?'L':'M')+(q.x-left).toFixed(1)+' '+(q.y-top).toFixed(1)}).join(' ');
        const last=project(routePoints[routePoints.length-1].latitude,routePoints[routePoints.length-1].longitude);
        return <div style={{position:'relative',height:'clamp(330px,55vh,540px)',overflow:'hidden',borderRadius:16,border:'1px solid #d6e3f0',background:'#edf2f7'}}>
          <svg viewBox="0 0 1024 640" preserveAspectRatio="xMidYMid slice" style={{width:'100%',height:'100%',display:'block',background:'#edf2f7'}} aria-label="Hartă cu drumuri și traseul GPS parcurs">
            {tiles}
            {routePoints.length>1 && <><path d={path} fill="none" stroke="#fff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round"/><path d={path} fill="none" stroke="#2475ed" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round"/></>}
            <circle cx={last.x-left} cy={last.y-top} r="19" fill="#2475ed" opacity=".16"/><circle cx={last.x-left} cy={last.y-top} r="9" fill="#2475ed" stroke="white" strokeWidth="4"/>
          </svg>
          <span style={{position:'absolute',left:12,top:12,padding:'8px 12px',borderRadius:10,background:'#fff',color:'#173a70',fontWeight:750,fontSize:12,boxShadow:'0 2px 12px #0b254020'}}>GPS {signal === 'lost' ? '· SEMNAL PIERDUT' : '· LIVE'} · ±{accuracy??'?'} m</span>
          <div style={{position:'absolute',right:12,top:12,display:'grid',gap:7}}>
            <button type="button" aria-label="Mărește harta" onClick={()=>setMapZoom(z=>Math.min(18,z+1))} style={{background:'white',color:'#173a70',borderRadius:9,padding:9}}>＋</button>
            <button type="button" aria-label="Micșorează harta" onClick={()=>setMapZoom(z=>Math.max(10,z-1))} style={{background:'white',color:'#173a70',borderRadius:9,padding:9}}>－</button>
            <button type="button" onClick={()=>{const p=routePoints[routePoints.length-1];setMapCenter({latitude:p.latitude,longitude:p.longitude});setFollow(true);}} style={{background:'white',color:'#173a70',borderRadius:9,padding:9,fontSize:12}}>Centrare</button>
          </div>
          <span style={{position:'absolute',left:12,bottom:12,padding:'6px 10px',borderRadius:8,background:'#ffffffeb',fontSize:11,color:'#345'}}>© OpenStreetMap contributors</span>
          <span style={{position:'absolute',right:12,bottom:12,padding:'8px 12px',borderRadius:10,background:'#fff',color:'#173a70',fontWeight:750,fontSize:12}}>{active ? (signal==='lost'?'● SEMNAL PIERDUT':routePoints.length>1 && routePoints[routePoints.length-1].timestamp-routePoints[routePoints.length-2].timestamp<15000 && segmentMeters(routePoints[routePoints.length-2],routePoints[routePoints.length-1])>12?'● ÎN MIȘCARE':'● STAȚIONARE'):'● CURSĂ OPRITĂ'}</span>
        </div>;
      })() : <div style={{padding:'48px 16px',textAlign:'center',background:'#f4f7fc',borderRadius:12,color:'#536681'}}>Pornește urmărirea și permite localizarea. Harta rutieră și traseul vor apărea aici.</div>}
      <p style={{fontSize:12,color:'#536681',margin:'9px 0 0'}}>Hartă rutieră OpenStreetMap cu traseul parcurs desenat în albastru, fără cost API Google. Punctele GPS sunt păstrate doar pe acest ecran, nu pe server. Păstrează aplicația deschisă.</p>
    </div>
    {active && signal === 'lost' && <div role="alert" style={{background:'#fff3df',color:'#8a4600',border:'1px solid #ffd18a',borderRadius:12,padding:13,margin:'12px 0',fontWeight:700}}>Semnal GPS pierdut sau întârziat peste 25 secunde. Verifică locația și menține aplicația în prim-plan. Distanța nu crește fără puncte valide.</div>}
    {active && signal === 'waiting' && <p role="status" style={{color:'#815500'}}>Se caută semnal GPS de precizie…</p>}
    <p role="status">Precizie GPS: {accuracy === null ? 'în așteptare' : `±${accuracy} m`} · Citiri valide: {samples} · {active ? 'Urmărire în desfășurare' : 'Urmărire oprită'}</p>
    <p>GPS-ul funcționează numai cât pagina rămâne activă și browserul permite localizarea. Distanța este estimativă și nu modifică kilometrajul real de pe bord. Poți salva separat distanța și durata după oprire; coordonatele GPS nu sunt trimise la server.</p>
    {vehicles.length > 0 && <label>Mașina pentru călătorie <select value={vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0].id} disabled={active} onChange={e => setVehicleId(e.target.value)}>{vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model}</option>)}</select></label>}
    <div className="ac-smartdrive-trip-controls">
      {!active ? <button type="button" className="primary" onClick={start}><Play size={17}/> Pornește GPS</button> : <button type="button" className="primary" style={{background:"#b42332",color:"#fff",borderColor:"#b42332"}} onClick={stop}><Square size={17}/> Oprește GPS</button>}
      {!active && distance > 0 && <button type="button" disabled={saving || preview} onClick={() => void saveTrip()}>{saving ? 'Se salvează…' : 'Salvează călătoria GPS'}</button>}
      <span><MapPin size={15}/> {active ? 'GPS activ' : 'GPS oprit'} · {samples} citiri valide</span>
    </div>
    {notice && <p role="status">{notice}</p>}
    {error && <p className="ac-smartdrive-trip-error" role="alert">{error}</p>}
  </section>;
}
