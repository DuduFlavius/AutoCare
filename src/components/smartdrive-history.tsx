'use client';
import {useApplicationLocale} from './application-locale';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { clearTripRoutes, readTripRoute } from '@/lib/local-trip-routes';
import { driveDuration } from '@/lib/drive-display';
import { Gauge, History, Bell, Route } from 'lucide-react';
import { mileageMetrics } from '@/lib/smartdrive-metrics';
const RoadMapView = dynamic(() => import('./road-map'), { ssr: false });
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
export default function SmartDriveHistory({ vehicles, preview, onUpdateMileage, ownerId, timezone }: { vehicles: Vehicle[]; preview: boolean; ownerId: string; timezone: string; onUpdateMileage:(vehicleId:string)=>void }) {

  const locale=useApplicationLocale();
  const english = locale.startsWith('en');
  const t = (ro: string, en: string) => english ? en : ro;
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const refresh=()=>setRevision(v=>v+1);window.addEventListener('autocare-trips-updated',refresh);return()=>window.removeEventListener('autocare-trips-updated',refresh);},[]);
  const [selected, setSelected] = useState('');
  const [routeResult, setRouteResult] = useState<{ id: string; points: Awaited<ReturnType<typeof readTripRoute>> } | null>(null);
  const [clearingRoutes, setClearingRoutes] = useState(false);
  const [resultVehicle, setResultVehicle] = useState('');
  const [selectedTripId, setSelectedTripId] = useState('');
  const [tripDate, setTripDate] = useState('');
  const [page, setPage] = useState(0);
  const [tripError, setTripError] = useState('');
  const [tripResult, setTripResult] = useState<{ key: string; trips: Trip[] } | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [prefs, setPrefs] = useState<Preferences>({ frequencyDays: 3, enabled: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const vehicleId = vehicles.some(v => v.id === selected) ? selected : (vehicles[0]?.id || '');
  useEffect(() => {
    if (preview || !vehicleId) return;
    let cancelled = false;
    Promise.all([
      request<Reading[]>('smartdrive/vehicles/' + vehicleId + '/readings'),
      request<Preferences>('smartdrive/preferences'),
    ]).then(([r,p]) => { if (!cancelled) { setReadings(r); setResultVehicle(vehicleId); setPrefs(p); setError(''); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Eroare SmartDrive.'); });
    return () => { cancelled = true; };
  }, [vehicleId, preview, revision, vehicles.map(v => v.odometer).join(',')]);
  const visibleReadings = resultVehicle === vehicleId ? readings : [];
  const tripQuery = new URLSearchParams({ page: String(page), ...(tripDate ? { date: tripDate } : {}) });
  const tripPath = 'smartdrive/vehicles/' + vehicleId + '/trips?' + tripQuery.toString();
  useEffect(() => {
    if (preview || !vehicleId) return;
    let cancelled = false;
    setTripError('');
    request<Trip[]>(tripPath).then(trips => {
      if (!cancelled) setTripResult({ key: tripPath, trips });
    }).catch(error => {
      if (!cancelled) setTripError(error.message);
    });
    return () => { cancelled = true; };
  }, [tripPath, vehicleId, preview, revision]);
  const filteredTrips = tripResult?.key === tripPath ? tripResult.trips : [];
  const selectedTrip = filteredTrips.find(trip => trip.id === selectedTripId) ?? filteredTrips[0];
  const tripId = selectedTrip?.id;
  useEffect(() => {
    if (preview || !tripId) return;
    let cancelled = false;
    void readTripRoute(ownerId, tripId).then(points => {
      if (!cancelled) setRouteResult({ id: tripId, points });
    });
    return () => { cancelled = true; };
  }, [ownerId, tripId, preview, revision]);
  const route = routeResult?.id === tripId ? routeResult?.points : undefined;
  async function clearRoutes() {
    if (!window.confirm(t('Ștergi toate traseele păstrate pe acest dispozitiv?', 'Delete all routes stored on this device?'))) return;
    setClearingRoutes(true);
    try { await clearTripRoutes(ownerId); setRouteResult(null); setRevision(value => value + 1); }
    catch { setError(t('Traseele locale nu au putut fi șterse.', 'The local routes could not be deleted.')); }
    finally { setClearingRoutes(false); }
  }
  const { deltaKm, dailyKm, monthlyKm } = mileageMetrics(visibleReadings);
  const save = async () => {
    if (preview) return;
    setBusy(true);
    try { const p = await request<Preferences>('smartdrive/preferences','PUT',prefs); setPrefs(p); setError(''); }
    catch(e) { setError(e instanceof Error ? e.message : 'Salvarea a eșuat.'); }
    finally { setBusy(false); }
  };
  return <section className="ac-smartdrive-history">
    <div className="ac-smartdrive-history-head"><div><span className="ac-premium-kicker"><History size={17}/> SMARTDRIVE · ISTORIC</span><h3>Citiri confirmate și călătorii</h3></div>
      {vehicles.length > 1 && <label>Mașina <select value={vehicleId} onChange={e => { setSelected(e.target.value); setPage(0); }}>{vehicles.map(v => <option data-user-content key={v.id} value={v.id}>{v.brand} {v.model}</option>)}</select></label>}</div>
    <div className="ac-trip-history-cockpit">
      <div className="ac-trip-history-list">
        <label>{t('Data călătoriei', 'Trip date')} <input type="date" value={tripDate} onChange={event => { setTripDate(event.target.value); setPage(0); }} /></label>
        {tripDate && <button type="button" onClick={() => { setTripDate(''); setPage(0); }}>{t('Toate datele', 'All dates')}</button>}
        {filteredTrips.map(trip => (
          <button type="button" key={trip.id} aria-pressed={selectedTrip?.id === trip.id} onClick={() => setSelectedTripId(trip.id)}>
            <span>{new Date(trip.startedAt).toLocaleString(locale, { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' })}</span>
            <strong>{(trip.distanceMeters / 1000).toLocaleString(locale, { maximumFractionDigits: 2 })} km · {driveDuration(trip.durationSeconds)}</strong>
          </button>
        ))}
        {filteredTrips.length === 0 && <p className="small muted">{tripError || (preview || !vehicleId || tripResult?.key === tripPath ? t('Nu există călătorii salvate în această perioadă.', 'There are no saved trips in this period.') : t('Se încarcă istoricul…', 'Loading trip history…'))}</p>}
        {(page > 0 || filteredTrips.length === 100) && <nav className="ac-trip-pages" aria-label={t('Paginile istoricului', 'History pages')}>
          <button type="button" disabled={!page} onClick={() => setPage(page - 1)}>{t('Înapoi', 'Previous')}</button>
          <span>{page + 1}</span>
          <button type="button" disabled={filteredTrips.length < 100 || page >= 10000} onClick={() => setPage(page + 1)}>{t('Înainte', 'Next')}</button>
        </nav>}
      </div>
      <div className="ac-trip-history-map">
        {route && route.length > 1 ? (
          <>
            <RoadMapView key={selectedTrip.id} points={route} history active={false} english={english} />
            <div className="ac-trip-map-legend"><span>{t('Plecare', 'Start')}</span><span>{t('Sosire', 'End')}</span></div>
          </>
        ) : (
          <div className="ac-trip-map-empty">
            <Route size={28}/>
            <strong>{selectedTrip ? t('Harta traseului nu este disponibilă', 'Trip map unavailable') : t('Istoricul traseelor GPS', 'GPS trip history')}</strong>
            <p>{selectedTrip ? t('Coordonatele acestei călătorii nu sunt salvate pe acest dispozitiv.', 'This trip has no coordinates on this device.') : t('Călătoriile salvate vor apărea aici.', 'Saved trips will appear here.')}</p>
          </div>
        )}
        <p className="small muted">{t('Coordonatele rămân pe dispozitivul care a înregistrat traseul. Distanța și durata rămân în cont.', 'Coordinates stay on the recording device. Distance and duration stay in your account.')}</p>
        {!preview && vehicleId && (
          <button type="button" disabled={clearingRoutes} onClick={() => void clearRoutes()}>{t('Șterge traseele de pe dispozitiv', 'Delete routes from this device')}</button>
        )}
      </div>
    </div>
    <div className="ac-mileage-history-callout">
      <div>
        <strong>Următoarea citire de kilometraj</strong>
        <p className="small muted">{visibleReadings.length && Number.isFinite(Date.parse(visibleReadings[0].recordedAt)) ? (() => {
          const date = new Date(visibleReadings[0].recordedAt);
          date.setDate(date.getDate() + Math.max(1, prefs.frequencyDays));
          return date.getTime() <= Date.now()
            ? 'E timpul să introduci kilometrajul actual.'
            : 'Reintrodu kilometrii în jurul datei de ' + date.toLocaleDateString(locale);
        })() : 'Introdu o primă citire pentru a calcula data următoarei actualizări.'}</p>
      </div>
      <button className="primary" type="button" disabled={!vehicleId} onClick={() => onUpdateMileage(vehicleId)}>Introdu km acum</button>
    </div>
    <div className="ac-smartdrive-history-metrics">
      <div><Gauge size={19}/><span>Diferență între citiri</span><strong>{deltaKm !== null ? deltaKm.toLocaleString(locale) + ' km' : '—'}</strong></div>
      <div><span>Medie zilnică</span><strong>{dailyKm === null ? 'Date insuficiente' : dailyKm.toLocaleString(locale,{maximumFractionDigits:1}) + ' km/zi'}</strong></div>
      <div><span>Medie lunară estimată (30 zile)</span><strong>{monthlyKm === null ? 'Date insuficiente' : monthlyKm.toLocaleString(locale,{maximumFractionDigits:0}) + ' km'}</strong></div>
    </div>
    <p className="ac-smartdrive-history-note">Mediile folosesc numai citirile confirmate, nu distanțele GPS. Pentru calcul sunt necesare două citiri la cel puțin o zi distanță.</p>
    <div className="ac-smartdrive-history-columns">
      <div><h4>Citiri kilometraj</h4>{visibleReadings.length ? visibleReadings.slice(0,8).map((r,i) => <div className="ac-smartdrive-history-row" key={r.id}><span>{new Date(r.recordedAt).toLocaleDateString(locale)} · {r.source === 'manual' ? 'Manual' : r.source}</span><strong>{r.odometer.toLocaleString(locale)} km</strong>{visibleReadings[i+1] && <small>+{Math.max(0,r.odometer-visibleReadings[i+1].odometer).toLocaleString(locale)} km</small>}</div>) : <p>Nu există citiri salvate în istoricul nou.</p>}</div>
    </div>
    <div className="ac-smartdrive-reminder"><div><span className="ac-premium-kicker"><Bell size={17}/> REMINDER KILOMETRAJ</span><p>Preferința este salvată în cont. Livrarea periodică necesită activarea jobului pe baza de date configurată.</p></div>
      <label><input type="checkbox" checked={prefs.enabled} onChange={e => setPrefs(p => ({...p,enabled:e.target.checked}))}/> Activ</label>
      <label>La fiecare <select value={prefs.frequencyDays} onChange={e => setPrefs(p => ({...p,frequencyDays:Number(e.target.value)}))}>{[1,2,3,5,7,14,30].map(n => <option key={n} value={n}>{n===1?'1 zi':n+' zile'}</option>)}</select></label>
      <button type="button" disabled={busy || preview} onClick={save}>{busy ? 'Se salvează…' : 'Salvează preferința'}</button>
    </div>
    {error && <p role="alert" className="ac-smartdrive-history-error">{error}</p>}
  </section>;
}
