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
  const watcher = useRef<number | null>(null);
  const previous = useRef<Sample | null>(null);
  const started = useRef<number | null>(null);
  const stop = () => {
    if (watcher.current !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) navigator.geolocation.clearWatch(watcher.current);
    watcher.current = null;
    previous.current = null;
    setActive(false);
  };
  useEffect(() => () => { if (watcher.current !== null) navigator.geolocation.clearWatch(watcher.current); }, []);
  const start = () => {
    if (preview) { setError('GPS-ul nu este activ în modul demonstrativ.'); return; }
    if (!window.isSecureContext || !('geolocation' in navigator)) { setError('GPS-ul necesită HTTPS și un browser cu localizare.'); return; }
    if (watcher.current !== null) return;
    setDistance(0); setSamples(0); setError(''); setNotice(''); previous.current = null; started.current = Date.now();
    watcher.current = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        const next: Sample = { latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy, timestamp };
        // Reject inaccurate points and implausible GPS jumps; never change the odometer.
        if (!Number.isFinite(next.accuracy) || next.accuracy > 60) return;
        if (previous.current) {
          const seconds = (next.timestamp - previous.current.timestamp) / 1000;
          const meters = segmentMeters(previous.current, next);
          if (seconds > 0 && meters > Math.max(10, next.accuracy, previous.current.accuracy) && meters / seconds < 65) setDistance(v => v + meters);
        }
        previous.current = next; setSamples(v => v + 1);
      },
      e => { setError(e.code === 1 ? 'Permisiune refuzată. Permite locația din setările site-ului și reîncarcă pagina.' : 'Semnal GPS indisponibil. Verifică localizarea și conexiunea.'); stop(); },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 },
    );
    setActive(true);
  };
  const saveTrip = async () => {
    const id = vehicles.some(v => v.id === vehicleId) ? vehicleId : vehicles[0]?.id;
    if (!id || !started.current || distance <= 0 || preview) { setError('Selectează o mașină și înregistrează o distanță validă.'); return; }
    const ended = Date.now();
    setSaving(true);
    try {
      const res = await fetch('/api/v1/smartdrive/vehicles/' + id + '/trips', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ distanceMeters: Math.round(distance), durationSeconds: Math.max(1, Math.round((ended - started.current) / 1000)), startedAt: new Date(started.current).toISOString(), endedAt: new Date(ended).toISOString() }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Salvarea călătoriei a eșuat.');
      setNotice('Călătoria estimată a fost salvată. Actualizează pagina pentru a vedea istoricul.'); setError('');
    } catch(e) { setError(e instanceof Error ? e.message : 'Salvarea a eșuat.'); }
    finally { setSaving(false); }
  };
  return <section className="ac-smartdrive-trip" aria-label="SmartDrive GPS">
    <div className="ac-smartdrive-trip-heading"><span className="ac-premium-kicker"><Route size={18}/> SMARTDRIVE · GPS</span><h3>Estimarea distanței unei călătorii</h3></div>
    <div className="ac-smartdrive-trip-metric"><strong>{(distance / 1000).toLocaleString('ro-RO', { maximumFractionDigits: 2 })}</strong><span>km estimați prin GPS</span></div>
    <p>GPS-ul funcționează numai cât pagina rămâne activă și browserul permite localizarea. Distanța este estimativă, nu se salvează și nu modifică kilometrajul real de pe bord. Punctele GPS nu sunt trimise la server.</p>
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
