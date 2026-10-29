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
  const [routePoints, setRoutePoints] = useState<Sample[]>([]);
  const [trackingSeconds, setTrackingSeconds] = useState(0);
  const [clock, setClock] = useState('');
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const watcher = useRef<number | null>(null);
  const previous = useRef<Sample | null>(null);
  const started = useRef<number | null>(null);
  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const distanceRef = useRef(0);
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
    setDistance(0); distanceRef.current = 0; setSamples(0); setRoutePoints([]); setAccuracy(null); setTrackingSeconds(0); setError(''); setNotice(''); previous.current = null; started.current = Date.now();
    tick.current = setInterval(() => { setTrackingSeconds(Math.floor((Date.now() - (started.current ?? Date.now())) / 1000)); setClock(new Date().toLocaleTimeString('ro-RO')); }, 1000);
    watcher.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        const next: Sample = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp };
        // Reject inaccurate points and implausible GPS jumps; never change the odometer.
        if (!Number.isFinite(next.accuracy) || next.accuracy > 60) return;
        setAccuracy(Math.round(next.accuracy));
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
      e => { setError(e.code === 1 ? 'Permisiune refuzată. Permite locația din setările site-ului și reîncarcă pagina.' : 'Semnal GPS indisponibil. Verifică localizarea și conexiunea.'); stop(); },
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
    <div className="ac-smartdrive-trip-metric"><strong>{(distance / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 2 })}</strong><span>km estimați prin GPS</span></div>
    <div className="ac-smartdrive-live" aria-live="off">
      <div><span>Distanță parcursă</span><strong>{(distance / 1000).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</strong></div>
      <div><span>Ora actuală</span><strong>{clock || '--:--:--'}</strong></div>
      <div><span>Timp de la pornire</span><strong>{String(Math.floor(trackingSeconds / 3600)).padStart(2, '0')}:{String(Math.floor(trackingSeconds % 3600 / 60)).padStart(2, '0')}:{String(trackingSeconds % 60).padStart(2, '0')}</strong></div>
      <div><span>Început urmărire</span><strong>{startedAt === null ? '—' : new Date(startedAt).toLocaleTimeString('ro-RO')}</strong></div>
    </div>
    <div className="ac-smartdrive-map" style={{margin:'18px 0',padding:12,background:'#fff',border:'1px solid #dbe5f3',borderRadius:18}}>
      <strong style={{display:'block',marginBottom:8,color:'#172b48'}}>Hartă GPS · Poziție live</strong>
      {routePoints.length ? <>
        <iframe title="Poziția GPS pe OpenStreetMap" loading="lazy" referrerPolicy="no-referrer" style={{display:'block',width:'100%',height:280,border:0,borderRadius:12}}
          src={(() => { const p=routePoints[routePoints.length-1];const lat=p.latitude,lon=p.longitude;const d=.009;return 'https://www.openstreetmap.org/export/embed.html?bbox='+[lon-d,lat-d,lon+d,lat+d].join('%2C')+'&layer=mapnik&marker='+lat+'%2C'+lon; })()} />
        <p style={{fontSize:12,color:'#536681',margin:'9px 0 0'}}>Poziție aproximativă (±{accuracy ?? '?'} m). Harta indică ultima poziție validă; traseul complet nu este încă desenat pe hartă. Datele GPS nu se salvează pe server.</p>
      </> : <div style={{padding:'48px 16px',textAlign:'center',background:'#f4f7fc',borderRadius:12,color:'#536681'}}>Pornește urmărirea și permite localizarea pentru a vedea poziția pe hartă.</div>}
    </div>
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
