'use client';
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
  const [mapZoom, setMapZoom] = useState(16);
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
    setStartedAt(Date.now()); setClock(new Date().toLocaleTimeString('ro-RO'));
    setDistance(0); distanceRef.current = 0; setSamples(0); setRoutePoints([]); setAccuracy(null); setSignal('waiting'); lastFix.current = 0; setTrackingSeconds(0); setError(''); setNotice(''); previous.current = null; started.current = Date.now();
    tick.current = setInterval(() => { setTrackingSeconds(Math.floor((Date.now() - (started.current ?? Date.now())) / 1000)); setClock(new Date().toLocaleTimeString('ro-RO')); }, 1000);
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
      },
      e => { setSignal('lost'); setError(e.code === 1 ? 'Permisiune refuzată. Permite locația din setările site-ului și reîncarcă pagina.' : 'Semnal GPS indisponibil. Verifică localizarea și conexiunea.'); stop(); },
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
    <div className="ac-smartdrive-trip-metric"><strong>{(distance / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 2 })}</strong><span>km estimați prin GPS · actualizare la fiecare citire validă</span></div>
    <div className="ac-smartdrive-live" aria-live="off">
      <div><span>Distanță parcursă</span><strong>{(distance / 1000).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</strong></div>
      <div><span>Ora actuală</span><strong>{clock || '--:--:--'}</strong></div>
      <div><span>Timp de la pornire</span><strong>{String(Math.floor(trackingSeconds / 3600)).padStart(2, '0')}:{String(Math.floor(trackingSeconds % 3600 / 60)).padStart(2, '0')}:{String(trackingSeconds % 60).padStart(2, '0')}</strong></div>
      <div><span>Început urmărire</span><strong>{startedAt === null ? '—' : new Date(startedAt).toLocaleTimeString('ro-RO')}</strong></div>
    </div>
    <div className="ac-smartdrive-map" style={{margin:'18px 0',padding:12,background:'#fff',border:'1px solid #dbe5f3',borderRadius:18}}>
      <strong style={{display:'block',marginBottom:8,color:'#172b48'}}>Hartă rutieră · GPS în timp real</strong>
      {routePoints.length ? (() => {
        const p=routePoints[routePoints.length-1]; const zoom=mapZoom; const scale=256*Math.pow(2,zoom);
        const project=(lat:number,lon:number)=>({x:(lon+180)/360*scale,y:(1-Math.log(Math.tan(lat*Math.PI/180)+1/Math.cos(lat*Math.PI/180))/Math.PI)/2*scale});
        const center=project(p.latitude,p.longitude); const tileX=Math.floor(center.x/256),tileY=Math.floor(center.y/256);
        const path=routePoints.map((q,i)=>{const v=project(q.latitude,q.longitude);return (i?'L':'M')+(v.x-center.x+450).toFixed(1)+' '+(v.y-center.y+280).toFixed(1)}).join(' ');
        return <div style={{position:'relative',height:'clamp(320px,55vh,510px)',overflow:'hidden',borderRadius:16,background:'#dbe7f0',border:'1px solid #d6e3f0',isolation:'isolate'}}>\n          <div style={{position:'absolute',width:900,height:560,left:'50%',top:'50%',transform:'translate(-50%,-50%)'}}>
          {Array.from({length:25},(_,i)=>{const dx=i%5-2,dy=Math.floor(i/5)-2,x=tileX+dx,y=tileY+dy;return <img key={i} alt="" loading="lazy" src={'https://tile.openstreetmap.org/'+zoom+'/'+x+'/'+y+'.png'} style={{position:'absolute',width:256,height:256,maxWidth:'none',left:450+(x*256-center.x),top:280+(y*256-center.y),pointerEvents:'none'}}/>})}
          <svg viewBox="0 0 900 560" style={{position:'absolute',inset:0,width:900,height:560,pointerEvents:'none'}} aria-label="Traseul GPS parcurs"><path d={path} fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" strokeLinejoin="round"/><path d={path} fill="none" stroke="#1664e8" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="450" cy="280" r="16" fill="#fff"/><circle cx="450" cy="280" r="10" fill="#1664e8" stroke="#fff" strokeWidth="3"/></svg>
          <span style={{position:'absolute',left:10,top:10,padding:'7px 10px',borderRadius:10,background:'#fff',color:'#173a70',fontWeight:750,fontSize:12}}>● GPS LIVE · ±{accuracy??'?'} m</span>
          <div style={{position:'absolute',right:12,top:12,display:'grid',gap:5}}><button type="button" aria-label="Mărește harta" onClick={()=>setMapZoom(z=>Math.min(18,z+1))} style={{background:'#fff',color:'#17365d',border:'1px solid #c6d5e6',borderRadius:9,width:40,height:40,fontSize:23,fontWeight:700,boxShadow:'0 2px 9px #09234420'}}>+</button><button type="button" aria-label="Micșorează harta" onClick={()=>setMapZoom(z=>Math.max(12,z-1))} style={{background:'#fff',color:'#17365d',border:'1px solid #c6d5e6',borderRadius:9,width:40,height:40,fontSize:23,fontWeight:700,boxShadow:'0 2px 9px #09234420'}}>−</button></div>\n          <span style={{position:'absolute',bottom:6,right:8,background:'#ffffffd9',fontSize:10,color:'#334155',padding:'3px 5px'}}>© OpenStreetMap contributors</span>
        </div>;
      })() : <div style={{padding:'48px 16px',textAlign:'center',background:'#f4f7fc',borderRadius:12,color:'#536681'}}>Pornește urmărirea și permite localizarea pentru a vedea poziția pe hartă.</div>}
      <p style={{fontSize:12,color:'#536681',margin:'9px 0 0'}}>Harta rutieră OpenStreetMap afișează străzile și drumurile reale, urmărește poziția și trasează parcursul în sesiunea curentă. Datele de localizare nu sunt salvate pe server. Păstrează aplicația deschisă.</p>
    </div>
    {active && signal === 'lost' && <div role="alert" style={{background:'#fff3df',color:'#8a4600',border:'1px solid #ffd18a',borderRadius:12,padding:13,margin:'12px 0',fontWeight:700}}>Semnal GPS pierdut sau întârziat peste 25 secunde. Verifică locația și menține aplicația în prim-plan. Distanța nu crește fără puncte valide.</div>}
    {active && signal === 'waiting' && <p role="status" style={{color:'#815500'}}>Se caută semnal GPS de precizie…</p>}
    <p role="status">Precizie GPS: {accuracy === null ? 'în așteptare' : `±${accuracy} m`} · Citiri valide: {samples} · {active ? 'Urmărire în desfășurare' : 'Urmărire oprită'}</p>
    <p>GPS-ul funcționează numai cât pagina rămâne activă și browserul permite localizarea. Distanța este estimativă și nu modifică kilometrajul real de pe bord. Poți salva separat distanța și durata după oprire; coordonatele GPS nu sunt trimise la server.</p>
    {vehicles.length > 0 && <label>Mașina pentru călătorie <select value={vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0].id} disabled={active} onChange={e => setVehicleId(e.target.value)}>{vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model}</option>)}</select></label>}
    <div className="ac-smartdrive-trip-controls">
      {!active ? <button type="button" className="primary" onClick={start}><Play size={17}/> Pornește urmărirea</button> : <button type="button" onClick={stop}><Square size={17}/> Oprește urmărirea</button>}
      {!active && distance > 0 && <button type="button" disabled={saving || preview} onClick={() => void saveTrip()}>{saving ? 'Se salvează…' : 'Salvează călătoria GPS'}</button>}
      <span><MapPin size={15}/> {active ? 'GPS activ' : 'GPS oprit'} · {samples} citiri valide</span>
    </div>
    {notice && <p role="status">{notice}</p>}
    {error && <p className="ac-smartdrive-trip-error" role="alert">{error}</p>}
  </section>;
}
