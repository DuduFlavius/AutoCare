'use client';
import { useEffect, useState } from 'react';
import { Gauge, History, Bell } from 'lucide-react';
type Vehicle = { id: string; brand: string; model: string; odometer: number };
type Reading = { id: string; odometer: number; recordedAt: string; source: string };
type Trip = { id: string; distanceMeters: number; durationSeconds: number; startedAt: string };
type Preferences = { frequencyDays: number; enabled: boolean };
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const res = await fetch('/api/v1/' + path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Nu s-au putut încărca datele.');
  return json as T;
}
export default function SmartDriveHistory({ vehicles, preview }: { vehicles: Vehicle[]; preview: boolean }) {
  const [selected, setSelected] = useState('');
  const [readings, setReadings] = useState<Reading[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [prefs, setPrefs] = useState<Preferences>({ frequencyDays: 3, enabled: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const vehicleId = vehicles.some(v => v.id === selected) ? selected : (vehicles[0]?.id || '');
  useEffect(() => {
    if (preview || !vehicleId) return;
    let cancelled = false;
    Promise.all([
      request<Reading[]>('smartdrive/vehicles/' + vehicleId + '/readings'),
      request<Trip[]>('smartdrive/vehicles/' + vehicleId + '/trips'),
      request<Preferences>('smartdrive/preferences'),
    ]).then(([r,t,p]) => { if (!cancelled) { setReadings(r); setTrips(t); setPrefs(p); setError(''); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Eroare SmartDrive.'); });
    return () => { cancelled = true; };
  }, [vehicleId, preview, vehicles.map(v => v.odometer).join(',')]);
  const asc = [...readings].sort((a,b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime());
  const first = asc[0], last = asc[asc.length - 1];
  const days = first && last ? (new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime()) / 86400000 : 0;
  const delta = first && last ? Math.max(0,last.odometer - first.odometer) : 0;
  const daily = days >= 1 ? delta / days : null;
  const save = async () => {
    if (preview) return;
    setBusy(true);
    try { const p = await request<Preferences>('smartdrive/preferences','PUT',prefs); setPrefs(p); setError(''); }
    catch(e) { setError(e instanceof Error ? e.message : 'Salvarea a eșuat.'); }
    finally { setBusy(false); }
  };
  return <section className="ac-smartdrive-history">
    <div className="ac-smartdrive-history-head"><div><span className="ac-premium-kicker"><History size={17}/> SMARTDRIVE · ISTORIC</span><h3>Citiri confirmate și călătorii</h3></div>
      {vehicles.length > 1 && <label>Mașina <select value={vehicleId} onChange={e => setSelected(e.target.value)}>{vehicles.map(v => <option key={v.id} value={v.id}>{v.brand} {v.model}</option>)}</select></label>}</div>
    <div className="ac-smartdrive-history-metrics">
      <div><Gauge size={19}/><span>Diferență între citiri</span><strong>{asc.length >= 2 ? delta.toLocaleString('ro-RO') + ' km' : '—'}</strong></div>
      <div><span>Medie zilnică</span><strong>{daily === null ? 'Date insuficiente' : daily.toLocaleString('ro-RO',{maximumFractionDigits:1}) + ' km/zi'}</strong></div>
      <div><span>Medie lunară estimată (30 zile)</span><strong>{daily === null ? 'Date insuficiente' : (daily*30).toLocaleString('ro-RO',{maximumFractionDigits:0}) + ' km'}</strong></div>
    </div>
    <p className="ac-smartdrive-history-note">Mediile folosesc numai citirile confirmate, nu distanțele GPS. Pentru calcul sunt necesare două citiri la cel puțin o zi distanță.</p>
    <div className="ac-smartdrive-history-columns">
      <div><h4>Citiri kilometraj</h4>{readings.length ? readings.slice(0,8).map((r,i) => <div className="ac-smartdrive-history-row" key={r.id}><span>{new Date(r.recordedAt).toLocaleDateString('ro-RO')} · {r.source === 'manual' ? 'Manual' : r.source}</span><strong>{r.odometer.toLocaleString('ro-RO')} km</strong>{readings[i+1] && <small>+{Math.max(0,r.odometer-readings[i+1].odometer).toLocaleString('ro-RO')} km</small>}</div>) : <p>Nu există citiri salvate în istoricul nou.</p>}</div>
      <div><h4>Călătorii GPS salvate</h4>{trips.length ? trips.slice(0,8).map(t => <div className="ac-smartdrive-history-row" key={t.id}><span>{new Date(t.startedAt).toLocaleString('ro-RO')}</span><strong>{(t.distanceMeters/1000).toLocaleString('ro-RO',{maximumFractionDigits:2})} km estimați</strong><small>{Math.round(t.durationSeconds/60)} minute</small></div>) : <p>Nu există călătorii GPS salvate.</p>}</div>
    </div>
    <div className="ac-smartdrive-reminder"><div><span className="ac-premium-kicker"><Bell size={17}/> REMINDER KILOMETRAJ</span><p>Preferința este salvată în cont. Livrarea periodică necesită activarea jobului pe baza de date configurată.</p></div>
      <label><input type="checkbox" checked={prefs.enabled} onChange={e => setPrefs(p => ({...p,enabled:e.target.checked}))}/> Activ</label>
      <label>La fiecare <select value={prefs.frequencyDays} onChange={e => setPrefs(p => ({...p,frequencyDays:Number(e.target.value)}))}>{[1,2,3,5,7,14,30].map(n => <option key={n} value={n}>{n} zile</option>)}</select></label>
      <button type="button" disabled={busy || preview} onClick={save}>{busy ? 'Se salvează…' : 'Salvează preferința'}</button>
    </div>
    {error && <p role="alert" className="ac-smartdrive-history-error">{error}</p>}
  </section>;
}
