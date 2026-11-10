'use client';
import dynamic from 'next/dynamic';
import {translateApplicationCopy} from '@/lib/application-language';
import {ApplicationLanguageProvider,useApplicationLanguage,useApplicationLocale} from './application-locale';
import './app-workspace.css';
import './studio-workspace.css';
import VehiclePhoto from './application/vehicle-photo';
import WorkspaceViewport from './workspace-viewport';
import { WorkspaceNavigation, WorkspaceLauncher, WorkspaceContext, WorkspacePreferences, WorkspaceModuleHeader } from './app-workspace';
import { normalizeWorkspaceSearch, normalizeWorkspaceTab, workspaceHref, workspaceSections } from '@/lib/workspace';
import SiteLanguage from './site-language';
import ApplicationHome from './application/home';
import { AutoAiWorkspace } from './application/auto-ai-workspace';
import ApplicationHeader from './application/header';
import MobileNavigation from './application/mobile-navigation';
import AccountHub from './application/account';
import { ApplicationGarage } from './application/garage';
import { selectActiveVehicle } from '@/lib/application-home';
import CommunicationPreferences from './communication-preferences';
import Membership from './membership';
import PremiumDownloads from './premium-downloads';
import SubscriptionPage from './subscription-page';
import MobileInstall from './mobile-install';
import {AppUpdateSettings} from './auto-update';
import PushSettings from './push-settings';
import {hasNativeTracking,nativeAutomation} from '@/lib/native-tracking';
import NativeTripSync from './native-trip-sync';
import MaintenanceForecast from './maintenance-forecast';
import {maintenanceTargets} from '@/lib/maintenance-schedule';
import ServiceForecastCards from './service-forecast-cards';
import RecordEditor from './record-editor';
import ServiceMileage from './service-mileage';
import {parseServiceDetails} from '@/lib/service-details';
import {completedServiceSeed} from '@/lib/completed-service';
import { filterRecords, documentCounts, serviceStats } from '@/lib/record-filters';
import SupportChat from './support-chat';
import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  CarFront,
  Files,
  Wrench,
  Wallet,
  BellRing,
  Shield,
  Gauge,
  Plus,
  ArrowUpRight,
  LogOut,
  X,
  ChevronRight,
  CalendarDays,
  Download,
  FolderOpen,
  MessageSquare,
  SlidersHorizontal,
  Search,
  Route,
  History,
  MapPin,
  Bluetooth,
} from 'lucide-react';
import { Brand } from './public-shell';
import { VehicleJournal, VehicleSheet, ReminderInbox } from './garage-home';
import { authClient } from '@/lib/auth-client';
import type { dashboard } from '@/lib/service';
const SmartDriveTrip = dynamic(() => import('./smartdrive-trip'), { loading: DriveModuleLoading });
const AutoPointsMap = dynamic(() => import('./auto-points-map'), { loading: DriveModuleLoading });
const SmartDriveHistory = dynamic(() => import('./smartdrive-history'), { loading: DriveModuleLoading });
function DriveModuleLoading() {
  return <div className="ws-loading" role="status"><span className="sr-only">SmartDrive GPS</span><div className="ws-loading-grid" aria-hidden="true"><span/><span/></div></div>;
}
type Data = Awaited<ReturnType<typeof dashboard>>;
type Vehicle = Data['vehicles'][number];
type RecordItem = Data['records'][number];
type Modal = {
  kind: 'vehicle' | 'document' | 'service' | 'expense';
  vehicle?: Vehicle;
  record?: RecordItem;
  completionOf?: string;
} | null;
const _money = (b: number) =>
  new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(b / 100);
async function api(path: string, method = 'GET', data?: unknown) {
  if(method!=='GET' && typeof navigator!=='undefined' && !navigator.onLine) throw new Error('Ești offline. Reconectează-te înainte de a salva.');
  const r = await fetch('/api/v1/' + path, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await r.json().catch(()=>({error:'Serviciul nu a răspuns corect. Încearcă din nou.'}));
  if (r.status === 401)
    throw new Error(
      'Sesiunea a expirat. Reconectează-te pentru a continua; datele nesalvate rămân în formular.',
    );
  if (!r.ok) throw new Error(result.error || 'Operațiunea nu a reușit.');
  return result;
}
function Empty({
  text,
  action,
  actionLabel = 'Adaugă prima înregistrare',
}: {
  text: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="empty">
      <FolderOpen size={30} />
      <p>{text}</p>
      {action && (
        <button onClick={action} className="primary">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
function Status({ record }: { record: RecordItem }) {
  const statusLanguage = useApplicationLanguage();
  if(record.kind==='service' && parseServiceDetails(record.parts||'').completedBy) return <span className="pill valid" data-workspace-ui>{statusLanguage==='en'?'Completed · next cycle saved':'Efectuată · ciclu nou salvat'}</span>;
  return (
    <span className={'pill ' + record.status.state}>
      {record.status.label}
      {record.status.days != null && record.status.days >= 0 && <span data-workspace-ui>{` · ${record.status.days} ${statusLanguage === 'en' ? (record.status.days === 1 ? 'day' : 'days') : (record.status.days === 1 ? 'zi' : 'zile')}`}</span>}
    </span>
  );
}
function Dialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    (ref.current?.querySelector<HTMLElement>('input[type=search]') || ref.current?.querySelector<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)'))?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]',
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', key);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', key);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div className="dialog-backdrop">
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        ref={ref}
      >
        <div className="between">
          <h2 id="dialog-title">{title}</h2>
          <button aria-label="Închide" className="close" onClick={onClose}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

type DriveView = 'live' | 'history' | 'points' | 'bluetooth';
function MileagePlanner({ data, preview, onUpdated, onError, mileageOnly = false, initialDrive, driveVisible = false }: {
  data: Data; preview: boolean; onUpdated: () => Promise<unknown>; onError: (message: string) => void; mileageOnly?: boolean; initialDrive?: string; driveVisible?: boolean;
}) {

  const locale=useApplicationLocale();
  const [driveView, setDriveView] = useState<DriveView>(initialDrive === 'points' || initialDrive === 'bluetooth' || initialDrive === 'history' ? initialDrive : 'live');
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => { if (window.location.hash === '#actualizeaza-km' && data.vehicles.length) { setEditing(data.vehicles[0].id); setKm(String(data.vehicles[0].odometer)); setTimeout(() => document.getElementById('ac-mileage-editor')?.scrollIntoView({behavior:'smooth',block:'center'}), 150); } }, []);
  const [km, setKm] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastReadings, setLastReadings] = useState<Record<string,{odometer:number;recordedAt:string}>>({});
  const [confirmedJump, setConfirmedJump] = useState<string | null>(null);
  useEffect(() => { if (preview) return; let cancelled=false; Promise.all(data.vehicles.filter(v=>!v.archived).map(async v=>{try{const rows=await api('smartdrive/vehicles/'+v.id+'/readings') as {odometer:number;recordedAt:string}[];return [v.id,rows[0]] as const}catch{return [v.id,undefined] as const}})).then(entries=>{if(!cancelled)setLastReadings(Object.fromEntries(entries.filter((e): e is readonly [string,{odometer:number;recordedAt:string}] => e[1] !== undefined))) });return()=>{cancelled=true}; },[preview,data.vehicles.map(v=>v.id+':'+v.odometer).join('|')]);
  const cars = data.vehicles.filter(v => !v.archived);
  const services = data.records.filter(r => r.kind === 'service' && !r.cancelled && (r.nextKm != null && Number(r.nextKm) > 0 || !!r.expiresAt));
  const fmt = (n: number) => n.toLocaleString(locale) + ' km';
  async function saveKm(v: Vehicle) {
    const value = Number(km);
    if (!Number.isSafeInteger(value) || value < 0 || value < v.odometer) {
      onError('Introdu un kilometraj valid, cel puțin egal cu cel înregistrat anterior.');
      return;
    }
    const previous = lastReadings[v.id];
    const days = previous ? Math.max(1,(Date.now()-Date.parse(previous.recordedAt))/86400000) : null;
    const delta = value-v.odometer;
    const daily = days ? delta/days : 0;
    const suspicious = delta > 0 && (delta >= 1500 || daily > 450);
    if (suspicious && confirmedJump !== v.id+':'+value) { setConfirmedJump(v.id+':'+value); return; }
    if (preview) { onError('În previzualizare nu se salvează date.'); return; }
    setSaving(true);
    try {
      await api('smartdrive/vehicles/' + v.id + '/readings', 'POST', { odometer: value });
      await onUpdated();
      setEditing(null); setConfirmedJump(null);
    } catch (e) { onError(e instanceof Error ? e.message : 'Nu s-a putut actualiza kilometrajul.'); }
    finally { setSaving(false); }
  }
  return (
    <section className="mileage-planner">
      <div className="mileage-planner-heading">
        <div><span className="eyebrow">AUTOCARE · PLANIFICARE</span><h2>{mileageOnly ? 'Kilometrajul mașinilor' : 'SmartDrive GPS'}</h2>
          <p>{mileageOnly ? 'Calcule bazate pe kilometrajul introdus și termenele salvate în istoricul mașinii.' : 'Înregistrează traseul și sincronizează distanța cu întreținerea la salvare.'}</p></div>
        <span className="mileage-planner-icon"><Gauge size={27}/></span>
      </div>
      {!cars.length && <div className="card"><p>Adaugă prima mașină în Garaj pentru a urmări întreținerea.</p></div>}
      {!mileageOnly && (
        <>
          <div className="ac-smartdrive-views" role="group" aria-label="SmartDrive">
            <button type="button" aria-pressed={driveView === 'live'} onClick={() => setDriveView('live')}>
              <Route size={17}/> {locale.startsWith('en') ? 'Live Drive Map' : 'Hartă în timp real'}
            </button>
            <button type="button" aria-pressed={driveView === 'history'} onClick={() => setDriveView('history')}>
              <History size={17}/> {locale.startsWith('en') ? 'Trip History' : 'Istoric trasee'}
            </button>
            <button type="button" aria-pressed={driveView === 'points'} onClick={() => setDriveView('points')}>
              <MapPin size={17}/> {locale.startsWith('en') ? 'Map and navigation' : 'Hartă și navigație'}
            </button>
            <button type="button" aria-pressed={driveView === 'bluetooth'} onClick={() => setDriveView('bluetooth')}>
              <Bluetooth size={17}/> Bluetooth
            </button>
          </div>
          <div hidden={driveView !== 'live' && driveView !== 'bluetooth'}>
            <SmartDriveTrip key={data.profile.userId} ownerId={data.profile.userId} preview={preview} onSaved={onUpdated} vehicles={cars} bluetoothOnly={driveView === 'bluetooth'} bluetoothVisible={driveView === 'bluetooth' && driveVisible} liveVisible={driveView === 'live' && driveVisible}/>
          </div>
          {driveView === 'points' && <AutoPointsMap preview={preview} visible={driveVisible} ownerId={data.profile.userId}/>}
          {driveView === 'history' && (
            <SmartDriveHistory ownerId={data.profile.userId} timezone={data.profile.timezone} vehicles={cars} preview={preview} onUpdateMileage={id => {
              const car = cars.find(vehicle => vehicle.id === id);
              if (!car) return;
              setEditing(id);
              setKm(String(car.odometer));
              setConfirmedJump(null);
              requestAnimationFrame(() => {
                const input = document.getElementById('ac-mileage-' + id);
                input?.focus({ preventScroll: true });
                input?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'center' });
              });
            }}/>
          )}
        </>
      )}
      <div className="mileage-planner-grid" id="ac-mileage-editor">
        {cars.map(v => {
          const planned = services.filter(r=>r.vehicleId===v.id);
          const due = planned.filter(r=>r.nextKm!=null).sort((a,b) => Number(a.nextKm)-Number(b.nextKm));
          return <article key={v.id} className="mileage-planner-card">
            <div className="between"><div><span data-user-content className="eyebrow">{v.plate}</span><h3 data-user-content>{v.brand} {v.model}</h3></div><CarFront size={28}/></div>
            <div className="mileage-planner-odometer"><span>Kilometraj înregistrat</span><strong>{fmt(v.odometer)}</strong></div>
            {editing === v.id ? <div className="mileage-planner-edit">
              <label>Kilometraj actual (km)<input id={'ac-mileage-'+v.id} type="number" min={v.odometer} step="1" value={km} onChange={e => {setKm(e.target.value);setConfirmedJump(null)}} /></label>
              {confirmedJump === v.id+':'+Number(km) && <div role="alert" style={{padding:16,border:'1px solid var(--color-warning)',background:'var(--color-warning-soft)',color:'var(--color-warning-ink)',borderRadius:14,margin:'12px 0'}}><strong style={{display:'block',fontSize:16}}>Ești sigur că ai parcurs atât?</strong><p style={{margin:'7px 0'}}>Ai introdus o creștere de <b>{(Number(km)-v.odometer).toLocaleString(locale)} km</b> față de ultima valoare confirmată. Verifică cifra de pe bord înainte de salvare.</p><p style={{fontSize:12,margin:0}}>Poți corecta valoarea în câmpul de mai sus sau confirma înregistrarea. Nu modificăm automat kilometrajul.</p></div>}
              <button className="primary" disabled={saving} onClick={() => void saveKm(v)}>{saving ? 'Se salvează…' : 'Actualizează km'}</button>
              <button disabled={saving} onClick={() => setEditing(null)}>Anulează</button>
            </div> : <button onClick={() => {setEditing(v.id);setKm(String(v.odometer));setConfirmedJump(null);}}>Actualizează kilometrajul</button>}
            {!due.length ? <p className="mileage-planner-empty">Nu există încă o intervenție cu kilometrajul următorului schimb. Adaugă termenul în secțiunea Întreținere.</p> :
              <div className="mileage-planner-items">{due.map(r => {
                const left = Number(r.nextKm) - v.odometer;
                return <div className="mileage-planner-item" key={r.id}>
                  <div><strong data-user-content>{r.title || r.category || 'Intervenție'}</strong><small>Termen: {fmt(Number(r.nextKm))}</small></div>
                  <span className={left <= 0 ? 'mileage-overdue' : left <= 1000 ? 'mileage-soon' : 'mileage-ok'}>
                    {left <= 0 ? 'Depășit cu ' + fmt(Math.abs(left)) : 'Mai sunt ' + fmt(left)}
                  </span>
                </div>;
              })}</div>}
            <ServiceForecastCards vehicleId={v.id} currentKm={v.odometer} preview={preview} timezone={data.profile.timezone} services={data.records.filter(r=>r.vehicleId===v.id&&r.kind==='service'&&!r.cancelled).flatMap(maintenanceTargets)} />
            <p className="micro">Recomandare AutoCare: actualizează kilometrajul periodic. Intervalele se stabilesc după manualul producătorului și condițiile de utilizare.</p>
          </article>;
        })}
      </div>
    </section>
  );
}

export default function Dashboard({ name, previewData, initialTab='Dashboard', initialDrive, initialVehicle }: { name: string; previewData?: Data; initialTab?:string; initialDrive?: string; initialVehicle?: string }) {
  const [data, setData] = useState<Data | null>(previewData || null),
    [tab, setTab] = useState(normalizeWorkspaceTab(initialTab)),
    [openedSmartDrive, setOpenedSmartDrive] = useState(normalizeWorkspaceTab(initialTab) === 'Plan întreținere'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [supportUnread, setSupportUnread] = useState(0),
    [activeVehicleId, setActiveVehicleId] = useState(''),
    [launcherOpen,setLauncherOpen] = useState(false),
    [offline,setOffline] = useState(false),
    [settingsPanel,setSettingsPanel] = useState('account'),
    [language, setLanguage] = useState<'ro' | 'en'>('ro'),
    [currency, setCurrency] = useState<'RON' | 'EUR'>('RON'),
    [signingOut,setSigningOut]=useState(false),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<Modal>(null),
    [filter, setFilter] = useState(''),
    [query, setQuery] = useState(''),
    [vehicleDetail, setVehicleDetail] = useState<string | null>(initialVehicle || null),
    [recordState, setRecordState] = useState(''),
    [unreadOnly, setUnreadOnly] = useState(false),
    [categoryFilter, setCategoryFilter] = useState(''),
    [period, setPeriod] = useState('all'),
    [recordDirty, setRecordDirty] = useState(false),
    [recordSaving, setRecordSaving] = useState(false),
    [recordView, setRecordView] = useState('timeline'),
    [calendarView, setCalendarView] = useState('list'),
    [showArchived, setShowArchived] = useState(false),
    [archiveVehicleTarget, setArchiveVehicleTarget] = useState<Data['vehicles'][number] | null>(null),
    [deleteOpen, setDeleteOpen] = useState(false),
    [history, setHistory] = useState<Array<{
      id: string;
      createdAt: string;
      snapshot: Record<string, unknown>;
    }> | null>(null),
    [admin, setAdmin] = useState<any>(null),
    [invoices, setInvoices] = useState<any[]>([]),
    [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  const dashboardRequest = useRef(0);
  const locale=language==='en'?'en-GB':'ro-RO';
  useEffect(()=>{if(previewData||tab!=='Abonament')return;const timer=setInterval(()=>{if(document.visibilityState==='visible'){void api('billing/sync','POST').then(()=>refresh(true)).catch(()=>{});void refresh(true);void api('billing/invoices').then(setInvoices).catch(e=>setError(e.message));}},15000);return()=>clearInterval(timer);},[tab,previewData]);
  const displayDate=(value:string)=>new Date(value+'T12:00:00').toLocaleDateString(locale);
  useEffect(() => {
    try { if (window.localStorage.getItem('autocare-language') === 'en') {setLanguage('en');setCurrency('EUR');}
      const savedCurrency = window.localStorage.getItem('autocare-currency');
      if (savedCurrency === 'EUR' || savedCurrency === 'RON') setCurrency(savedCurrency); } catch { /* Storage may be unavailable. */ }
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t) setTab(normalizeWorkspaceTab(t));
    refresh();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  useEffect(() => {
    if (previewData || tab !== 'Notificări' || !data?.notifications.some(n => !n.readAt)) return;
    void api('notifications/read', 'POST').then(() => refresh()).catch(e => setError(e.message));
  }, [tab, previewData, data?.notifications]);
  useEffect(() => {
    if (previewData) return;
    if (tab === 'Abonament' || tab === 'Premium') void refresh(true);
    if (tab === 'Abonament') void api('billing/sync','POST').then(()=>refresh(true)).catch(()=>{});
    if (tab === 'Abonament')
      api('billing/invoices')
        .then(setInvoices)
        .catch((e) => setError(e.message));
    if (tab === 'Administrare')
      api('admin')
        .then(setAdmin)
        .catch((e) => setError(e.message));
  }, [tab]);
  // Reconnect an already-authorized desktop/mobile device to Web Push after login.
  useEffect(() => {
    if (previewData || !data?.pushPublicKey || !data.notificationSetup.pushConfigured) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    let cancelled = false;
    const sync = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        const key = data.pushPublicKey!;
        const padding = '='.repeat((4 - (key.length % 4)) % 4);
        const bytes = Uint8Array.from(atob((key + padding).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
        let sub = await reg.pushManager.getSubscription();
        const existing = sub?.options.applicationServerKey;
        if (sub && (!existing || Array.from(new Uint8Array(existing)).join(',') !== Array.from(bytes).join(','))) {
          await sub.unsubscribe();
          sub = null;
        }
        sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
        if (!cancelled) {
          await api('push', 'POST', sub.toJSON());
          if (!data.profile.pushEnabled) await api('profile', 'PUT', { ...profileValues(), pushEnabled: true });
        }
      } catch (error) {
        console.warn('AutoCare: sincronizarea notificărilor nu a reușit.', error);
      }
    };
    void sync();
    return () => { cancelled = true; };
  }, [previewData, data?.pushPublicKey, data?.notificationSetup.pushConfigured]);

  useEffect(() => {
    if (previewData) return;
    let lastUnread: number | null = null;
    let unreadBusy = false;
    const check = () => {
      if (document.hidden || !navigator.onLine || unreadBusy) return;
      unreadBusy = true;
      void api('support/unread')
        .then(async (x) => {
          const count = Number(x.unread || 0);
          if (lastUnread !== null && count > lastUnread && typeof Notification !== 'undefined' && Notification.permission === 'granted' && !document.hidden) {
            const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration('/sw.js').catch(() => undefined) : undefined;
            if (reg) {
              await reg.showNotification('AutoCare · Mesaje noi', {
                body: 'Ai mesaje noi în Centrul de suport.',
                icon: '/icon-192.png',
                tag: 'autocare-support-local',
                data: { url: '/cont?tab=Centru%20de%20suport' },
              });
            } else {
              new Notification('AutoCare · Mesaje noi', { body: 'Ai mesaje noi în Centrul de suport.', icon: '/icon-192.png' });
            }
          }
          lastUnread = count;
          setSupportUnread(count);
        })
        .catch(() => {}).finally(() => { unreadBusy = false; });
    };
    const notifications = () => {
      if (!document.hidden) void refresh(true);
      void check();
    };
    const notificationTimer = setInterval(notifications, 45000);
    window.addEventListener('focus', notifications);
    window.addEventListener('online', notifications);
    document.addEventListener('visibilitychange', notifications);
    check();
    return () => {
      clearInterval(notificationTimer);
      window.removeEventListener('focus', notifications);
      window.removeEventListener('online', notifications);
      document.removeEventListener('visibilitychange', notifications);
    };
  }, [previewData]);
  useEffect(() => {
    if (!recordDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [recordDirty]);
  async function refresh(silent = false) {
    if (previewData) return;
    const request = ++dashboardRequest.current;
    try {
      const updated = await api('dashboard');
      if (request === dashboardRequest.current) setData(updated);
    } catch (e) {
      if (!silent && request === dashboardRequest.current) setError((e as Error).message);
    }
  }
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  function startCheckout(interval: string, extend = false) {
    void act(async () => {
      const out = await api(extend ? 'billing/extend' : 'billing/checkout', 'POST', { interval });
      if (typeof out?.url !== 'string' || !out.url.startsWith('https://checkout.stripe.com/')) {
        throw new Error(language === 'en' ? 'Invalid Stripe checkout link.' : 'Linkul de plată Stripe este invalid.');
      }
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (standalone) setCheckoutUrl(out.url);
      else window.location.assign(out.url);
    }, '');
  }

  async function act(fn: () => Promise<unknown>, message = 'Modificările au fost salvate.') {
    if (previewData) {
      setNotice('Previzualizare de design: date fictive, modificările nu se salvează.');
      return false;
    }
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await fn();
      await refresh();
      if (message) setNotice(message);
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const workspaceViews = useRef(new Map<string,{filter:string;query:string;recordState:string;categoryFilter:string;period:string;showArchived:boolean;scroll:number}>());
  function navigate(t: string, historyMode: 'push' | 'none' = 'push', vehicle: string | null = null) {
    t=normalizeWorkspaceTab(t);

    if (recordSaving || busy) return false;
    if (recordDirty && !window.confirm(translateApplicationCopy('Ai modificări nesalvate. Vrei să le abandonezi?',locale==='ro-RO'?'ro':'en')))
      return false;
    workspaceViews.current.set(tab,{filter,query,recordState,categoryFilter,period,showArchived,scroll:window.scrollY});
    const view=workspaceViews.current.get(t);
    setLauncherOpen(false);
    setModal(null);
    setRecordDirty(false);
    setTab(t);
    setVehicleDetail(t === 'Garaj' || t === 'AutoCare AI' ? vehicle : null);
    if (t === 'Plan întreținere') setOpenedSmartDrive(true);
    setFilter(view?.filter||'');
    setQuery(view?.query||'');
    setRecordState(view?.recordState||'');
    setCategoryFilter(view?.categoryFilter||'');
    setPeriod(view?.period||'all');
    setShowArchived(view?.showArchived||false);
    setError('');
    setNotice('');
    const current = new URLSearchParams(window.location.search);
    if (historyMode === 'push' && (current.get('tab') !== t || current.get('vehicle') !== vehicle))
      window.history.pushState(
        null,
        '',
        workspaceHref(window.location.pathname+window.location.search,t,vehicle),
      );
    return true;
  }
  useEffect(()=>{if(!data?.profile.userId)return;try{setActiveVehicleId(sessionStorage.getItem('autocare-active-vehicle:'+data.profile.userId)||'');}catch { /* Selection stays active for this session when storage is blocked. */ }},[data?.profile.userId]);
  const displayedViewRef = useRef({ tab, vehicleDetail });
  displayedViewRef.current = { tab, vehicleDetail };
  const navigationRef = useRef(navigate);
  navigationRef.current = navigate;
  useEffect(() => {
    const back = () => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get('tab') || 'Dashboard';
      if (navigationRef.current(next, 'none', params.get('vehicle')) === false) {
        const { tab: current, vehicleDetail: vehicle } = displayedViewRef.current;
        window.history.pushState(null, '', workspaceHref(window.location.pathname + window.location.search, current, vehicle));
      }
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  useEffect(()=>{
    setOffline(!navigator.onLine);
    const online=()=>{setOffline(false);void refresh();};
    const offline=()=>setOffline(true);
    window.addEventListener('online',online);window.addEventListener('offline',offline);
    return()=>{window.removeEventListener('online',online);window.removeEventListener('offline',offline);};
  },[]);
  useEffect(()=>{
    const label=workspaceSections.find(s=>s.id===tab)?.[language]||tab;
    document.title=label+' | AutoCare';
    const frame=requestAnimationFrame(()=>{
      document.getElementById('workspace-page-title')?.focus({preventScroll:true});
      window.scrollTo({top:workspaceViews.current.get(tab)?.scroll||0,behavior:'instant'});
    });
    return()=>cancelAnimationFrame(frame);
  },[tab,language,vehicleDetail]);
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'&&!modal&&!recordDirty&&!recordSaving){event.preventDefault();setLauncherOpen(v=>!v);}
    };
    window.addEventListener('keydown',shortcut);return()=>window.removeEventListener('keydown',shortcut);
  },[modal,recordDirty,recordSaving]);
  function changeLanguage(next:'ro'|'en'){
    setLanguage(next);setCurrency(next==='en'?'EUR':'RON');
    try{localStorage.setItem('autocare-language',next);localStorage.setItem('autocare-currency',next==='en'?'EUR':'RON');}catch{ /* Storage may be unavailable. */ }
  }
  function changeCurrency(next:'EUR'|'RON'){
    setCurrency(next);try{localStorage.setItem('autocare-currency',next);}catch{ /* Storage may be unavailable. */ }
  }
  const activeCars = data?.vehicles.filter((v) => !v.archived) || [];
  const primaryVehicleId = selectActiveVehicle(activeCars, data?.primaryVehicleId ?? activeVehicleId)?.id ?? '';
  const garageQuery = normalizeWorkspaceSearch(query);
  const garageCars = tab === 'Garaj' && !vehicleDetail
    ? data?.vehicles.filter(v => (!filter || v.id === filter) && (showArchived || !v.archived) &&
        normalizeWorkspaceSearch(`${v.brand} ${v.model} ${v.plate}`).includes(garageQuery)) || []
    : [];
  const visible =
    data?.records.filter(
      (r) =>
        (showArchived || recordState === 'archived' || !r.cancelled) &&
        (!filter || r.vehicleId === filter),
    ) || [];
  const nowDate = new Date().toLocaleDateString('en-CA', {
    timeZone: data?.profile.timezone || 'Europe/Bucharest',
  });
  const fromDate =
    period === 'month'
      ? nowDate.slice(0, 7) + '-01'
      : period === 'year'
        ? new Date(new Date(nowDate + 'T12:00:00Z').setUTCFullYear(Number(nowDate.slice(0, 4)) - 1))
            .toISOString()
            .slice(0, 10)
        : undefined;
  const kindFilter =
    tab === 'Documente' ? 'document' : tab === 'Întreținere' ? 'service' : 'expense';
  const exportFilters = {
    kind: kindFilter,
    vehicleId: filter,
    category: categoryFilter,
    status: recordState,
    archived: showArchived ? 'all' : 'active',
    q: query,
    from: fromDate,
    to: period === 'all' ? undefined : nowDate,
  };
  const rows = filterRecords(
    data?.records || [],
    exportFilters,
    new Date(),
    data?.profile.timezone || 'Europe/Bucharest',
  ).sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id.localeCompare(a.id));
  const docStats = documentCounts(
    (data?.records || []).filter(
      (r) =>
        (!filter || r.vehicleId === filter) && (!categoryFilter || r.category === categoryFilter),
    ),
    new Date(),
    data?.profile.timezone || 'Europe/Bucharest',
  );
  const maintenanceStats = serviceStats(
    rows,
    new Date(),
    data?.profile.timezone || 'Europe/Bucharest',
  );
  const moneyDisplay = (bani: number): string => currency === 'EUR'
    ? new Intl.NumberFormat('en-IE', {style:'currency',currency:'EUR'}).format(bani / 500)
    : new Intl.NumberFormat(locale, {style:'currency',currency:'RON'}).format(bani / 100);
  const exportUrl = (format: string) =>
    '/api/v1/export?' +
    new URLSearchParams(
      Object.entries({ ...exportFilters, format }).filter(
        ([, v]) => v !== undefined && v !== '',
      ) as [string, string][],
    ).toString();
  function closeRecord() {
    if (recordSaving || busy) return;
    if (
      recordDirty &&
      !window.confirm(translateApplicationCopy('Ai modificări nesalvate. Închizi formularul și renunți la ele?',locale==='ro-RO'?'ro':'en'))
    )
      return;
    setRecordDirty(false);
    setModal(null);
  }
  const profileValues = () =>
    data
      ? {
          timezone: data.profile.timezone,
          emailEnabled: data.profile.emailEnabled,
          pushEnabled: data.profile.pushEnabled,
          afterExpiry: data.profile.afterExpiry,
          offsets: data.profile.offsets,
          hour: data.profile.hour,
        }
      : {};
  function vehicleName(id: string) {
    const v = data?.vehicles.find((v) => v.id === id);
    return v ? `${v.brand} ${v.model} · ${v.plate}` : 'Mașină';
  }
  async function saveForm(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!modal) return;
    const f = new FormData(e.currentTarget);
    const str = (key: string) => String(f.get(key) || '');
    const number = (key: string) => (str(key) === '' ? null : Number(str(key)));
    let payload: unknown, path: string, method: string;
    if (modal.kind === 'vehicle') {
      payload = {
        brand: str('brand'),
        model: str('model'),
        year: number('year'),
        plate: str('plate'),
        vin: str('vin') || null,
        engine: str('engine'),
        fuel: str('fuel'),
        capacity: number('capacity'),
        odometer: number('odometer') || 0,
        purchasedAt: str('purchasedAt') || null,
        notes: str('notes'),
      };
      path = 'vehicles' + (modal.vehicle ? '/' + modal.vehicle.id : '');
      method = modal.vehicle ? 'PATCH' : 'POST';
    } else {
      payload = {
        kind: modal.kind,
        vehicleId: str('vehicleId'),
        category: str('category'),
        title: str('title'),
        date: str('date') || null,
        expiresAt: str('expiresAt') || null,
        nextKm: number('nextKm'),
        odometer: number('odometer'),
        amountBani: Math.round((number('amount') || 0) * 100),
        provider: str('provider'),
        number: str('number'),
        parts: str('parts'),
        notes: str('notes'),
      };
      path = 'records' + (modal.record ? '/' + modal.record.id : '');
      method = modal.record ? 'PATCH' : 'POST';
    }
    if (await act(() => api(path, method, payload))) {
      setRecordDirty(false);
      setModal(null);
    }
  }
  async function push() {
    await act(async () => {
      if (!window.isSecureContext)
        throw new Error('Deschide AutoCare prin HTTPS pentru notificări.');
      if (
        !('PushManager' in window) ||
        !('Notification' in window) ||
        !('serviceWorker' in navigator)
      )
        throw new Error('Browserul nu suportă Web Push.');
      if (!data?.pushPublicKey) throw new Error('Cheile push nu sunt configurate.');
      if ((await Notification.requestPermission()) !== 'granted')
        throw new Error('Permisiunea pentru notificări nu a fost acordată.');
      const timeout = <T,>(promise: Promise<T>): Promise<T> =>
        new Promise((resolve, reject) => {
          const timer = window.setTimeout(
            () =>
              reject(
                new Error('Activarea durează prea mult. Reîncarcă pagina și încearcă din nou.'),
              ),
            20000,
          );
          promise.then(
            (value) => {
              clearTimeout(timer);
              resolve(value);
            },
            (error) => {
              clearTimeout(timer);
              reject(error);
            },
          );
        });
      await timeout(navigator.serviceWorker.register('/sw.js'));
      const reg = await timeout(navigator.serviceWorker.ready);
      const key = data.pushPublicKey;
      const padding = '='.repeat((4 - (key.length % 4)) % 4);
      const bytes = Uint8Array.from(
        atob((key + padding).replace(/-/g, '+').replace(/_/g, '/')),
        (c) => c.charCodeAt(0),
      );
      let sub = await timeout(reg.pushManager.getSubscription());
      if (sub) {
        const existing = sub.options.applicationServerKey;
        if (
          !existing ||
          Array.from(new Uint8Array(existing)).join(',') !== Array.from(bytes).join(',')
        ) {
          await timeout(sub.unsubscribe());
          sub = null;
        }
      }
      sub ??= await timeout(
        reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes }),
      );
      await api('push', 'POST', sub.toJSON());
      await api('profile', 'PUT', { ...profileValues(), pushEnabled: true });
    }, 'Notificările push au fost activate pentru acest browser.');
  }
  async function selectVehicle(id: string) {
    if (!data || id === data.primaryVehicleId || busy) return;
    if (!previewData && !await act(() => api('vehicles/primary', 'PUT', { vehicleId: id }))) return;
    setActiveVehicleId(id);
    if (!previewData) setData(current => current?.vehicles.some(vehicle => vehicle.id === id && !vehicle.archived) ? { ...current, primaryVehicleId: id } : current);
    try { sessionStorage.setItem('autocare-active-vehicle:' + data.profile.userId, id); }
    catch { /* The server preference remains available if storage is blocked. */ }
  }
  async function signOut() {
    if (previewData || signingOut) return;
    if (recordDirty && !window.confirm(translateApplicationCopy('Ai modificări nesalvate. Vrei să te deconectezi?',language))) return;
    setSigningOut(true); setError('');
    try { if(hasNativeTracking()&&data?.profile.userId)await nativeAutomation.signOut(data.profile.userId); const result=await authClient.signOut(); if(result.error)throw Error(result.error.message||'Deconectarea nu a reușit. Încearcă din nou.'); window.location.assign('/autentificare'); }
    catch(cause) { setError(cause instanceof Error?cause.message:'Deconectarea nu a reușit. Încearcă din nou.'); setSigningOut(false); }
  }
  return (
    <ApplicationLanguageProvider language={language}><div className="app-shell ac-workspace ac-studio" data-language={language} data-settings-panel={settingsPanel} data-workspace-section={tab}>
      <WorkspaceViewport service={tab==='Întreținere'}/>
      <a className="ws-skip" data-workspace-ui href="#workspace-main">{language==='en'?'Skip to workspace':'Sari la conținut'}</a>
      {launcherOpen && <Dialog title={language==='en'?'Search & quick actions':'Căutare și acțiuni rapide'} onClose={()=>setLauncherOpen(false)}><WorkspaceLauncher data={data} language={language} navigate={navigate} onCreate={kind=>{setLauncherOpen(false);setModal({kind});}} onRecord={record=>{setLauncherOpen(false);setModal({kind:record.kind as 'document'|'service'|'expense',record});}} onVehicle={id=>navigate('Garaj', 'push', id)} /></Dialog>}
      <aside className="sidebar">
        <Brand
          href={previewData ? '/previzualizare' : '/cont'}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate('Dashboard');
          }}
        />
        <span className="sidebar-tagline">GARAJUL TĂU DIGITAL</span>
        <button type="button" className="ws-sidebar-search" data-workspace-ui onClick={()=>setLauncherOpen(true)} disabled={!!modal}><Search size={18}/><span>{language==='en'?'Search & actions':'Căutare și acțiuni'}</span><kbd>⌘ K</kbd></button>
        <div className="ws-sidebar-sections">
          <WorkspaceNavigation tab={tab} language={language} navigate={navigate} notifications={data?.notifications.filter(n=>!n.readAt).length} support={supportUnread} premium={!!data?.premium} path={previewData?'/previzualizare':'/cont'} />
          {['founder', 'superadmin', 'admin', 'assistant'].includes(data?.profile.role || '') && (
            <a className="founder-nav-link" href="/admin">
              <Shield size={18} /> {data?.profile.role === 'founder' ? 'Panou Fondator' : 'Mail Center'} <ArrowUpRight size={13} />
            </a>
          )}
          {data?.profile.role === 'admin' && (
            <button
              className={tab === 'Administrare' ? 'active' : ''}
              onClick={() => navigate('Administrare')}
            >
              <Shield size={18} />
              Administrare
            </button>
          )}
        </div>
        {data?.profile.role !== 'founder' && (
          <div
            className={
              'sidebar-bottom ' + (data?.premium ? 'membership-active' : 'membership-promo')
            }
          >
            <p className="eyebrow">{data?.premium ? (language === 'en' ? 'PREMIUM ACTIVE' : 'PREMIUM ACTIV') : 'AUTOCARE PREMIUM'}</p>
            <p>
              {data?.premium
                ? 'Garajul tău, cu toate avantajele.'
                : 'Mai mult control asupra garajului tău.'}
            </p>
            <button onClick={() => navigate('Abonament')}>
              {data?.premium ? 'Gestionează abonamentul' : 'Descoperă Premium'}{' '}
              <ArrowUpRight size={15} />
            </button>
          </div>
        )}
        <details className="sidebar-account">
          {' '}
          <summary className="sidebar-profile">
            <span className="profile-avatar">{name.slice(0, 1).toUpperCase()}</span>
            <span>
              <strong>{name}</strong>
              <small>
                {(
                  {
                    founder: 'Fondator',
                    admin: 'Administrator',
                    assistant: 'Asistent',
                    user: 'Utilizator',
                  } as Record<string, string>
                )[data?.profile.role || 'user'] || 'Utilizator'}
              </small>
            </span>
            <ArrowUpRight size={15} />
          </summary>
          <div className="profile-actions">
            <button onClick={() => navigate('Setări')}>Profil și preferințe</button>
            <button
              disabled={signingOut || !!previewData}
              onClick={() => void signOut()}
            >
              <LogOut size={16} />
              Deconectare
            </button>
          </div>
        </details>
      </aside>
      {data&&!previewData&&<NativeTripSync ownerId={data.profile.userId} vehicles={data.vehicles.filter(v=>!v.archived)} onUpdated={refresh} onReview={()=>navigate('Plan întreținere')} english={language==='en'}/>}
      <SiteLanguage language={language} />
      <ApplicationHeader title={tab === 'Dashboard' ? (language==='en'?'Home':'Acasă') : (workspaceSections.find(s=>s.id===tab)?.[language] ?? tab)} name={name} unread={data?.notifications.filter(n=>!n.readAt).length ?? 0} premium={!!data?.premium} onSearch={()=>setLauncherOpen(true)} onNotifications={()=>navigate('Notificări')} onAccount={()=>navigate('Cont')} onPremium={()=>navigate('Premium')} onSignOut={()=>void signOut()} signingOut={signingOut} preview={!!previewData}/>
      <MobileNavigation tab={tab} navigate={navigate} path={previewData?'/previzualizare':'/cont'}/>
      <main id="workspace-main" tabIndex={-1} aria-busy={busy||!data}
        className={
          'main workspace-' +
          (tab === 'Dashboard'
            ? 'dashboard'
            : tab === 'Documente'
            ? 'documents'
            : tab === 'Întreținere'
              ? 'service'
              : tab === 'Garaj'
                ? 'garage'
                : tab === 'Plan întreținere'
                  ? 'service'
                : tab === 'Abonament'
                  ? 'membership'
                  : tab === 'Setări'
                    ? 'settings'
                    : tab === 'Cheltuieli'
                      ? 'expenses'
                      : 'general')
        }
      >
        {offline && <div className="ws-offline" role="status" data-workspace-ui>{language==='en'?'You are offline. Displayed data may be out of date. Reconnect before saving.':'Ești offline. Datele afișate pot fi neactualizate. Reconectează-te înainte de a salva.'}</div>}
        {previewData && (
          <div className="preview-note" role="status">
            PREVIZUALIZARE DESIGN · Date fictive, separate de conturile reale. Navigarea este
            disponibilă; modificările nu se salvează.
          </div>
        )}
        {error && (
          <div role="alert" className="error">
            {error}
            {error.startsWith('Sesiunea a expirat') && <a href="/autentificare">Reconectare</a>}
          </div>
        )}
        {notice && (
          <div className="notice ac-workspace-toast">
            <span role="status">{notice}</span>
            <button type="button" onClick={() => setNotice('')} aria-label={language === 'en' ? 'Dismiss notification' : 'Închide notificarea'}><X size={16}/></button>
          </div>
        )}
        {!data ? (
          <div className="ws-loading" role="status">
            <p>{language==='en'?'Loading your workspace…':'Se încarcă spațiul tău de lucru…'}</p>
            {error ? <button type="button" onClick={() => void refresh()}>{language==='en'?'Try again':'Reîncearcă'}</button> : <div className="ws-loading-grid" aria-hidden="true"><span/><span/><span/><span/></div>}
          </div>
        ) : (
          <>
            {!['Dashboard','Cont'].includes(tab) && <WorkspaceModuleHeader tab={tab} language={language}>
              {['Documente', 'Întreținere', 'Cheltuieli'].includes(tab) ? (
                <button
                  className="primary"
                  disabled={!activeCars.length}
                  onClick={() =>
                    setModal(activeCars.length ? {
                      kind:
                        tab === 'Documente'
                          ? 'document'
                          : tab === 'Întreținere'
                            ? 'service'
                            : 'expense',
                    } : { kind: 'vehicle' })
                  }
                >
                  <Plus size={17} />
                  {!activeCars.length ? 'Adaugă întâi o mașină' : tab === 'Documente' ? 'Adaugă document' : tab === 'Întreținere' ? 'Adaugă intervenție' : 'Adaugă cheltuială'}
                </button>
              ) : tab === 'Calendar' ? (
                <button
                  className="primary"
                  disabled={!activeCars.length}
                  onClick={() => setModal({ kind: 'service' })}
                >
                  <Plus size={16} /> Planifică o lucrare
                </button>
              ) : null}
            </WorkspaceModuleHeader>}
            <WorkspaceContext tab={tab} language={language} navigate={navigate} />
            {tab === 'Dashboard' && <ApplicationHome data={data} name={name} selectedVehicle={primaryVehicleId} onSelectVehicle={selectVehicle} navigate={navigate} onVehicle={id=>navigate('Garaj', 'push', id)} onCreate={(kind,vehicleId)=>{if(vehicleId)setFilter(vehicleId);setModal({kind});}} onRecord={record=>setModal({kind:record.kind as 'document'|'service'|'expense',record})} onRefresh={refresh} currency={currency} preview={!!previewData}/>}
            {tab === 'AutoCare AI' && <AutoAiWorkspace
              vehicles={activeCars}
              vehicleId={selectActiveVehicle(activeCars, vehicleDetail ?? primaryVehicleId)?.id ?? ''}
              onVehicle={id => navigate('AutoCare AI', 'push', id)}
              premium={data.premium} available={data.autoAssistantAvailable} preview={!!previewData} onSaved={refresh}
            />}
            {tab === 'Cont' && <AccountHub data={data} name={name} navigate={navigate} onSettings={panel=>{if(navigate('Setări'))setSettingsPanel(panel);}} onSignOut={()=>void signOut()} signingOut={signingOut} preview={!!previewData}/>}
            {tab === 'Istoric auto' && <VehicleJournal data={data} open={record=>setModal({kind:record.kind as 'document'|'service'|'expense',record})}/>}
        {tab === 'Garaj' && vehicleDetail && (
          <section className="ac-vehicle-profile" aria-label={language === 'en' ? 'Vehicle profile' : 'Profilul vehiculului'}>
            <button className="studio-text-button" type="button" onClick={() => navigate('Garaj')}>{language === 'en' ? '← Back to garage' : '← Înapoi în garaj'}</button>
            {data.vehicles.some(car => car.id === vehicleDetail) ? (
            <VehicleSheet
              key={vehicleDetail}
              onAi={() => navigate('AutoCare AI', 'push', vehicleDetail)}
              preview={!!previewData}
              onCreate={(kind) => {
                setFilter(vehicleDetail);
                setModal({ kind });
              }}
              data={data}
              id={vehicleDetail}
              busy={busy}
              removeService={(record) => {
                const question = locale === 'ro-RO'
                  ? 'Arhivezi intervenția și oprești alertele ei?'
                  : 'Archive this service entry and stop its reminders?';
                if (confirm(question)) void act(() => api('records/' + record.id, 'DELETE'));
              }}
              edit={() => {
                const v = data.vehicles.find((v) => v.id === vehicleDetail);
                if (v) setModal({ kind: 'vehicle', vehicle: v });
              }}
              open={(record) => {
                setModal({ kind: record.kind as 'document' | 'service' | 'expense', record });
              }}
            />) : <p role="status">{language === 'en' ? 'This vehicle is unavailable in your garage.' : 'Mașina nu este disponibilă în garajul tău.'}</p>}
          </section>
        )}
            {tab === 'Garaj' && !vehicleDetail && (
              <ApplicationGarage
                data={data} vehicles={garageCars} primaryId={primaryVehicleId} today={nowDate}
                query={query} showArchived={showArchived} busy={busy} preview={!!previewData}
                money={moneyDisplay} onQuery={setQuery} onShowArchived={setShowArchived}
                onAdd={() => setModal({ kind: 'vehicle' })}
                onDetails={id => navigate('Garaj', 'push', id)}
                onAi={id => navigate('AutoCare AI', 'push', id)}
                onEdit={vehicle => setModal({ kind: 'vehicle', vehicle })}
                onDocuments={id => {
                  if (!navigate('Documente')) return;
                  setFilter(id);
                  setQuery('');
                  setCategoryFilter('');
                  setRecordState('');
                  setPeriod('all');
                  setShowArchived(false);
                }}
                onArchive={vehicle => { setError(''); setArchiveVehicleTarget(vehicle); }} onSelect={selectVehicle} onRefresh={refresh}
              />
            )}
            {['Documente', 'Întreținere', 'Cheltuieli'].includes(tab) && (
              <>
                {tab === 'Documente' && (
                  <>
                    <div className="stats document-statistics">
                      {([
                        ['', language === 'en' ? 'All documents' : 'Total documente', docStats.total],
                        ['valid', language === 'en' ? 'Valid' : 'În termen', docStats.valid],
                        ['soon', language === 'en' ? 'Expiring soon' : 'Expiră în 30 de zile', docStats.soon],
                        ['expired', language === 'en' ? 'Expired' : 'Expirate', docStats.expired],
                      ] as const).map(([state, label, value]) => (
                        <button key={state} type="button" className="card stat ac-document-stat" aria-pressed={recordState === state}
                          onClick={() => setRecordState(recordState === state ? '' : state)}>
                          <Files size={17} aria-hidden="true"/>
                          <span className="small muted">{label}</span>
                          <strong className="value">{value}</strong>
                        </button>
                      ))}
                    </div>
                    {docStats.incomplete > 0 && (
                      <p className="data-quality-note">
                        {docStats.incomplete} documente nu au o dată de expirare; acestea nu sunt
                        clasificate ca valabile sau expirate.
                      </p>
                    )}
                  </>
                )}
                {tab === 'Întreținere' && activeCars.length > 0 && (
                  <section className="ac-service-garage" data-workspace-ui aria-label={language === 'en' ? 'Service vehicles' : 'Mașini pentru întreținere'}>
                    <div className="ac-service-vehicles">
                      <button type="button" aria-pressed={!filter} onClick={() => setFilter('')}>
                        <CarFront size={17}/> {language === 'en' ? 'All vehicles' : 'Toate mașinile'}
                      </button>
                      {activeCars.map(vehicle => (
                        <button type="button" key={vehicle.id} aria-pressed={filter === vehicle.id} onClick={() => setFilter(vehicle.id)}>
                          <CarFront size={17}/> <span data-user-content>{vehicle.brand} {vehicle.model}</span>
                        </button>
                      ))}
                    </div>
                    {activeCars.filter(vehicle => vehicle.id === (filter || primaryVehicleId || activeCars[0].id)).map(vehicle => (
                      <div className="ac-service-vehicle" key={vehicle.id}>
                        <div>
                          <span className="eyebrow">{language === 'en' ? 'Vehicle in focus' : 'Mașină selectată'}</span>
                          <h2 data-user-content>{vehicle.brand} {vehicle.model}</h2>
                          <p data-user-content>{[vehicle.year, vehicle.engine, vehicle.fuel].filter(Boolean).join(' · ')}</p>
                          <strong>{vehicle.odometer.toLocaleString(locale)} km</strong>
                        </div>
                        <VehiclePhoto vehicleId={vehicle.id} name={vehicle.brand + ' ' + vehicle.model} uploaded={data.photos.some(photo => photo.vehicleId === vehicle.id)} preview={!!previewData}/>
                      </div>
                    ))}
                  </section>
                )}
                {tab === 'Întreținere' && (
                  <div className="ac-maintenance-views" role="group" aria-label={language === 'en' ? 'Service categories' : 'Categorii de service'}>
                    {([
                      ['', language === 'en' ? 'All service' : 'Tot istoricul', Wrench],
                      ['Schimb ulei', language === 'en' ? 'Oil & filters' : 'Ulei și filtre', Gauge],
                      ['Distribuție', language === 'en' ? 'Timing system' : 'Distribuție', CarFront],
                      ['Revizie generală', language === 'en' ? 'General service' : 'Revizii', CalendarDays],
                    ] as const).map(([category, label, Icon]) => (
                      <button type="button" key={category} aria-pressed={categoryFilter === category} onClick={() => setCategoryFilter(category)}>
                        <Icon size={17}/> {label}
                      </button>
                    ))}
                  </div>
                )}
                {tab === 'Întreținere' && (
                  <div className="stats maintenance-statistics ac-premium-service-stats">
                    {[
                      ['Cost înregistrat', moneyDisplay(maintenanceStats.totalBani)],
                      ['Operațiuni', maintenanceStats.count],
                      [
                        'Următoarea intervenție',
                        (maintenanceStats.next?displayDate(maintenanceStats.next):'') || 'Neplanificată',
                      ],
                      [
                        'Ultimul kilometraj',
                        maintenanceStats.lastOdometer === null
                          ? 'Necompletat'
                          : maintenanceStats.lastOdometer.toLocaleString(locale) + ' km',
                      ],
                    ].map(([label, value]) => (
                      <section key={label} className="card stat ac-premium-service-stat">
                        <span className="ac-premium-service-stat-icon" aria-hidden="true">{label === 'Cost înregistrat' ? <Wallet size={19}/> : label === 'Operațiuni' ? <Wrench size={19}/> : label === 'Următoarea intervenție' ? <CalendarDays size={19}/> : <Gauge size={19}/>}</span>
                        <span className="small muted">{label}</span>
                        <div className="value">{value}</div>
                      </section>
                    ))}
                  </div>
                )}
                <div className="record-tools ac-premium-record-tools">
                  <div className="record-search">
                    <Search size={18} aria-hidden="true" />
                    <input
                      aria-label="Caută o înregistrare"
                      placeholder="Caută titlu, categorie sau service…"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                    />
                  </div>
                  <details key={tab} className="record-filter-panel">
                    <summary>
                      <SlidersHorizontal size={16} /> Filtre și exporturi{' '}
                      <span className="filter-count">
                        {[
                          !!filter,
                          !!categoryFilter,
                          !!recordState,
                          showArchived,
                          period !== 'all',
                        ].filter(Boolean).length || '＋'}
                      </span>
                    </summary>
                    <div className="record-filter-fields">
                      <select
                        aria-label="Filtrează după mașină"
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                      >
                        <option value="">Toate mașinile</option>
                        {data.vehicles.map((v) => (
                          <option data-user-content value={v.id} key={v.id}>
                            {v.brand} {v.model} · {v.plate}
                          </option>
                        ))}
                      </select>
                      <select
                        aria-label="Filtrează după categorie"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                      >
                        <option value="">Toate categoriile</option>
                        {Array.from(
                          new Set(
                            (data.records || [])
                              .filter((r) => r.kind === kindFilter)
                              .map((r) => r.category),
                          ),
                        )
                          .sort()
                          .map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                      </select>
                      {(tab === 'Întreținere' || tab === 'Cheltuieli') && (
                        <select
                          aria-label={language === 'en' ? 'Date range' : 'Perioada înregistrărilor'}
                          value={period}
                          onChange={(e) => setPeriod(e.target.value)}
                        >
                          <option value="all">Tot istoricul</option>
                          <option value="month">Luna curentă</option>
                          <option value="year">Ultimele 12 luni</option>
                        </select>
                      )}
                      {tab === 'Documente' && (
                        <select
                          aria-label="Starea documentului"
                          value={recordState}
                          onChange={(e) => setRecordState(e.target.value)}
                        >
                          <option value="">Toate stările</option>
                          <option value="valid">În termen</option>
                          <option value="soon">Expiră în curând</option>
                          <option value="expired">Expirat</option>
                          <option value="incomplete">Fără dată de expirare</option>
                          <option value="archived">Arhivat</option>
                        </select>
                      )}
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={showArchived}
                          onChange={(e) => setShowArchived(e.target.checked)}
                        />
                        Include arhivate
                      </label>
                      <a href={exportUrl('csv')} className="button small">
                        <Download size={15} />
                        CSV Premium
                      </a>
                      <a href={exportUrl('pdf')} className="button small">
                        <Download size={15} />
                        PDF Premium
                      </a>
                    </div>
                  </details>
                </div>
                {tab === 'Întreținere' && (
                  <div className="between record-view-switch ac-premium-record-switch">
                    <p className="micro">
                      {maintenanceStats.unknownCosts > 0
                        ? maintenanceStats.unknownCosts +
                          ' operațiuni au cost necunoscut și nu intră în total.'
                        : 'Costurile sunt cele înregistrate de tine.'}
                    </p>
                    <div>
                      <button
                        aria-pressed={recordView === 'timeline'}
                        onClick={() => setRecordView('timeline')}
                      >
                        Cronologie
                      </button>
                      <button
                        aria-pressed={recordView === 'table'}
                        onClick={() => setRecordView('table')}
                      >
                        Tabel
                      </button>
                    </div>
                  </div>
                )}
                {tab === 'Întreținere' && <details open className="app-maintenance-plan" data-workspace-ui><summary><CalendarDays size={18}/>{language==='en'?'Maintenance plan · days & mileage':'Planul de întreținere · zile și kilometri'}<ChevronRight size={16}/></summary><MaintenanceForecast data={data} records={visible} preview={!!previewData} onUpdateMileage={()=>navigate('Kilometraj')} onUpgrade={()=>navigate('Abonament')}/></details>}
                {tab === 'Cheltuieli' && (
                  <div className="grid2 ac-expenses-board">
                    <section className="card">
                      <p className="eyebrow">REZUMAT FINANCIAR · TOATE MAȘINILE</p>
                      <h3>Costuri înregistrate</h3>
                      <div className="monthly-cost">
                        <span className="small muted">Luna aceasta</span>
                        <strong>{moneyDisplay(data.summary.monthBani)}</strong>
                      </div>
                      <span className="small muted">Total anual</span>
                      <div className="price">{moneyDisplay(data.summary.annualBani)}</div>
                      <p className="muted small">
                        Include lucrările și documentele cu un cost, fără dublare.
                      </p>
                      <p className="small">
                        {data.summary.costPerKm == null
                          ? (language==='en'?'Cost per km unavailable: at least two distinct readings are required.':'Adaugă cel puțin două citiri distincte pentru a vedea costul pe kilometru.')
                          : (language==='en'?`Estimated cost per km: ${moneyDisplay(data.summary.costPerKm*100)} (partial data coverage)`:`Cost/km estimativ: ${moneyDisplay(data.summary.costPerKm*100)} (acoperire parțială a datelor)`)}
                      </p>
                      {Object.entries(data.summary.categories).map(([category, value]) => (
                        <button
                          className="category-cost"
                          key={category}
                          onClick={() => setQuery(category)}
                        >
                          <span className="between">
                            <span>{category}</span>
                            <strong>{moneyDisplay(value)}</strong>
                          </span>
                          <span className="category-track">
                            <span
                              style={{
                                width:
                                  Math.min(
                                    100,
                                    data.summary.annualBani > 0
                                      ? (value / data.summary.annualBani) * 100
                                      : 0,
                                  ) + '%',
                              }}
                            />
                          </span>
                        </button>
                      ))}
                    </section>
                    {(data.summary.monthly.some(m=>m.bani>0) || !data.premium) && <section className="card">
                      <h3>Evoluția cheltuielilor</h3>
                      {data.premium ? (
                        <ExpenseChart data={data} currency={currency} />
                      ) : (
                        <p className="muted small">
                          Graficele și analiza detaliată sunt disponibile cu Premium.
                        </p>
                      )}
                    </section>}
                  </div>
                )}
                {!rows.length &&
                  (query ||
                    filter ||
                    categoryFilter ||
                    recordState ||
                    showArchived ||
                    period !== 'all') && (
                    <button
                      className="reset-filters"
                      onClick={() => {
                        setQuery('');
                        setFilter('');
                        setCategoryFilter('');
                        setRecordState('');
                        setShowArchived(false);
                        setPeriod('all');
                      }}
                    >
                      Resetează filtrele
                    </button>
                  )}
                {!rows.length ? (
                  <Empty
                    actionLabel={
                      tab === 'Documente'
                        ? 'Adaugă primul document'
                        : tab === 'Întreținere'
                          ? 'Adaugă prima operațiune'
                          : 'Adaugă o cheltuială'
                    }
                    text={
                      query ||
                      filter ||
                      categoryFilter ||
                      recordState ||
                      showArchived ||
                      period !== 'all'
                        ? 'Niciun rezultat pentru filtrele selectate.'
                        : tab === 'Documente'
                          ? 'Nu ai documente încă. Adaugă primul act al mașinii.'
                          : tab === 'Întreținere'
                            ? 'Jurnalul începe cu prima intervenție.'
                            : 'Nu ai cheltuieli înregistrate.'
                    }
                    action={
                      activeCars.length
                        ? () =>
                            setModal({
                              kind:
                                tab === 'Documente'
                                  ? 'document'
                                  : tab === 'Întreținere'
                                    ? 'service'
                                    : 'expense',
                            })
                        : undefined
                    }
                  />
                ) : (
                  <div
                    className={
                      tab === 'Documente'
                        ? 'record-full document-gallery'
                        : 'record-full ' +
                          (tab === 'Întreținere' && recordView === 'timeline'
                            ? 'maintenance-timeline'
                            : '')
                    }
                  >
                    <div className="card table-scroll ac-premium-record-table">
                      <table>
                        <thead>
                          <tr>
                            <th>Înregistrare / mașină</th>
                            <th>Dată / scadență</th>
                            <th>{tab === 'Documente' ? 'Status' : 'Cost / kilometraj'}</th>
                            <th>Acțiuni</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((r) => (
                            <tr className="ac-maintenance-record" key={r.id}>
                              <td data-label="Înregistrare">
                                {tab === 'Documente' && (
                                  <span className="record-kind-mark" aria-hidden="true">
                                    <Files size={20} strokeWidth={1.6} />
                                  </span>
                                )}
                                <strong data-user-content>{r.title}</strong>
                                <div className="muted small">{vehicleName(r.vehicleId)}</div>
                                <div className="micro">
                                  {r.category} {r.provider ? '· ' + r.provider : ''}
                                </div>
                                {r.notes && <p data-user-content className="small">{r.notes}</p>}
                                {data.attachments
                                  .filter((f) => f.recordId === r.id)
                                  .map((f) => (
                                    <div key={f.id} className="inline small">
                                      <a
                                        className="document-file-preview"
                                        href={'/api/v1/files/' + f.id + '?view=1'}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                      >
                                        {f.mime.startsWith('image/') && (
                                          <img
                                            src={'/api/v1/files/' + f.id + '?view=1'}
                                            alt={'Atașament ' + r.category}
                                            loading="lazy"
                                          />
                                        )}
                                        <span>{f.name} · Vezi</span>
                                      </a>
                                      <button
                                        className="close danger"
                                        aria-label={'Șterge ' + f.name}
                                        onClick={() => {
                                          if (confirm(translateApplicationCopy('Ștergi definitiv atașamentul?',locale==='ro-RO'?'ro':'en')))
                                            act(() => api('files/' + f.id, 'DELETE'));
                                        }}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ))}
                              </td>
                              <td data-label="Dată și termen">
                                {r.date
                                  ? displayDate(r.date)
                                  : 'Dată necompletată'}
                                <div className="muted small">
                                  {r.expiresAt
                                    ? 'Expiră la ' + displayDate(r.expiresAt)
                                    : r.nextKm!=null?'Termen după kilometraj':'Fără scadență'}
                                </div>
                                {r.nextKm != null && (
                                  <div className="small ac-record-km-deadline">Următorul prag: {r.nextKm.toLocaleString(locale)} km</div>
                                )}
                              </td>
                              <td data-label="Cost și statut">
                                {tab === 'Documente' ? (
                                  <Status record={r} />
                                ) : (
                                  <>
                                    <strong>
                                      {r.amountKnown === false
                                        ? 'Cost necunoscut'
                                        : moneyDisplay(r.amountBani)}
                                    </strong>
                                    {r.kind==='service'&&data.vehicles.find(v=>v.id===r.vehicleId)&&<ServiceMileage currentKm={data.vehicles.find(v=>v.id===r.vehicleId)!.odometer} lastKm={r.odometer} nextKm={r.nextKm}/>}
                                    <div className="small muted">
                                      {r.odometer != null
                                        ? r.odometer.toLocaleString(locale) + ' km'
                                        : 'Kilometraj necompletat'}
                                    </div>
                                  </>
                                )}
                              </td>
                              <td data-label="Acțiuni">
                                <div className="row-actions ac-premium-record-actions">
                                  <button
                                    onClick={() =>
                                      setModal({
                                        kind: r.kind as 'document' | 'service' | 'expense',
                                        record: r,
                                      })
                                    }
                                  >
                                    Editează
                                  </button>
                                  {r.kind==='service' && data.premium && !parseServiceDetails(r.parts||'').completedBy && <button data-workspace-ui type="button" onClick={()=>setModal({kind:'service',completionOf:r.id,record:completedServiceSeed(r,data.vehicles.find(v=>v.id===r.vehicleId)?.odometer??r.odometer??0,new Date().toLocaleDateString('en-CA',{timeZone:data.profile.timezone}))})}>{language==='en'?'Mark as completed':'Marchează ca efectuată'}</button>}
                                  <label
                                    className="button small"
                                    style={{ cursor: 'pointer' }}
                                  >
                                    Atașează document
                                    <input
                                      className="sr-only"
                                      type="file"
                                      accept="application/pdf,image/jpeg,image/png"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (!file) return;
                                        e.target.value = '';
                                        if (file.size > 2097152) {
                                          setError('Fișierul este prea mare. Alege o poză sau un PDF de maximum 2 MB.');
                                          return;
                                        }
                                        if (!['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)) {
                                          setError('Format neacceptat. Alege un PDF, JPG sau PNG.');
                                          return;
                                        }
                                        const form = new FormData();
                                        form.set('file', file);
                                        form.set('recordId', r.id);
                                        await act(async () => {
                                          const res = await fetch('/api/v1/files', {
                                            method: 'POST',
                                            body: form,
                                          });
                                          const out = await res.json().catch(() => ({}));
                                          if (!res.ok) throw new Error(out.error || 'Încărcarea nu a reușit. Încearcă din nou.');
                                          await refresh();
                                          setNotice('Documentul a fost atașat cu succes.');
                                        });
                                      }}
                                    />
                                  </label>
                                  <details className="record-context">
                                    <summary aria-label={(language==='en'?'More actions for ':'Mai multe acțiuni pentru ') + r.title}>
                                      •••
                                    </summary>
                                    <div>
                                      <button
                                        onClick={() =>
                                          act(async () => {
                                            const h = await api('records/' + r.id + '/history');
                                            setHistory(h);
                                          }, '')
                                        }
                                      >
                                        Istoric
                                      </button>
                                      <button
                                        className="danger"
                                        onClick={() => {
                                          if (
                                            confirm(
                                              translateApplicationCopy('Arhivezi această înregistrare și oprești alertele?',locale==='ro-RO'?'ro':'en'),
                                            )
                                          )
                                            act(() => api('records/' + r.id, 'DELETE'));
                                        }}
                                      >
                                        Arhivează
                                      </button>
                                    </div>
                                  </details>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
            {tab === 'Calendar' && (
              <section className="card">
                <div className="toolbar">
                  <label>
                    Luna
                    <input
                      type="month"
                      value={calendarMonth}
                      onChange={(e) => setCalendarMonth(e.target.value)}
                    />
                  </label>
                  <button type="button" onClick={() => setCalendarMonth(nowDate.slice(0, 7))} disabled={calendarMonth === nowDate.slice(0, 7)}>
                    <CalendarDays size={17}/> {language === 'en' ? 'Current month' : 'Luna curentă'}
                  </button>
                  <span className="small muted">Scadențele documentelor și lucrărilor active</span>
                </div>
                <div className="toolbar">
                  <button
                    aria-pressed={calendarView === 'list'}
                    onClick={() => setCalendarView('list')}
                  >
                    Listă
                  </button>
                  <button
                    aria-pressed={calendarView === 'month'}
                    onClick={() => setCalendarView('month')}
                  >
                    Lună
                  </button>
                  <select
                    aria-label="Mașina din calendar"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="">Toate mașinile</option>
                    {activeCars.map((v) => (
                      <option data-user-content key={v.id} value={v.id}>
                        {v.brand} {v.model} · {v.plate}
                      </option>
                    ))}
                  </select>
                </div>
                {calendarView === 'month' ? (
                  <Calendar
                    month={calendarMonth}
                    open={(record) =>
                      setModal({ kind: record.kind as 'document' | 'service' | 'expense', record })
                    }
                    rows={visible.filter((r) => activeCars.some((v) => v.id === r.vehicleId))}
                  />
                ) : (
                  <div>
                    {visible
                      .filter(
                        (r) =>
                          r.expiresAt?.startsWith(calendarMonth) &&
                          activeCars.some((v) => v.id === r.vehicleId),
                      )
                      .sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!))
                      .map((r) => (
                        <button
                          className="event-line"
                          key={r.id}
                          onClick={() =>
                            setModal({
                              kind: r.kind as 'document' | 'service' | 'expense',
                              record: r,
                            })
                          }
                        >
                          <span className="event-date">{r.expiresAt?.slice(-2)}</span>
                          <span className="list-grow">
                            <strong data-user-content>{r.title}</strong>
                            <span className="muted small">{vehicleName(r.vehicleId)}</span>
                          </span>
                          <Status record={r} />
                        </button>
                      ))}
                    {!visible.some((r) => r.expiresAt?.startsWith(calendarMonth)) && (
                      <Empty text="Nu ai termene înregistrate în luna selectată." />
                    )}
                  </div>
                )}
              </section>
            )}
            {tab === 'Kilometraj' && <MileagePlanner mileageOnly data={data} preview={!!previewData} onUpdated={refresh} onError={setError} />}
            {openedSmartDrive && <div hidden={tab !== 'Plan întreținere'}><MileagePlanner data={data} initialDrive={initialDrive} driveVisible={tab === 'Plan întreținere'} preview={!!previewData} onUpdated={refresh} onError={setError} /></div>}
            {tab === 'Notificări' && (
              <div className="overview-stack">
                <PushSettings
                  configured={data.notificationSetup.pushConfigured}
                  emailConfigured={data.notificationSetup.emailConfigured}
                  preview={!!previewData}
                  onActivate={push}
                  onTest={() =>
                    act(
                      () => api('push/test', 'POST'),
                      'Notificarea a fost acceptată de serviciul push. Verifică bannerele dispozitivului.',
                    ).then(() => {})
                  }
                />
                <ReminderInbox
                  data={data}
                  open={(record) =>
                    setModal({ kind: record.kind as 'document' | 'service' | 'expense', record })
                  }
                />
                <section className="card autocare-notifications">
                  <div className="autocare-notifications-header">
                    <div><h3>{language === 'en' ? 'Your alerts' : 'Alertele tale'}</h3><p>{language === 'en' ? 'Review, mark as read or dismiss.' : 'Consultă, marchează ca citite sau elimină alertele.'}</p></div>
                    <button type="button" className="autocare-notifications-settings" onClick={() => { if (navigate('Setări')) setSettingsPanel('alerts'); }}>
                      {language === 'en' ? 'Preferences' : 'Preferințe'}
                    </button>
                  </div>
                  <div className="ac-notification-controls">
                    <button type="button" aria-pressed={unreadOnly} onClick={() => setUnreadOnly(value => !value)}>{language === 'en' ? 'Unread only' : 'Doar necitite'}</button>
                    <button type="button" disabled={busy || !data.notifications.some(item => !item.readAt)} onClick={() => void act(() => api('notifications/read', 'POST'))}>
                      {language === 'en' ? 'Mark all as read' : 'Marchează toate ca citite'}
                    </button>
                  </div>
                  {data.notifications.some(item => !unreadOnly || !item.readAt) ? (
                    <div className="autocare-notifications-list">
                      {data.notifications.filter(item => !unreadOnly || !item.readAt).map(item => (
                        <article key={item.id} className="ac-alert-row">
                          <div className="autocare-notification-content">
                            <strong data-user-content>{item.message}</strong><small>{item.localDate} · {item.channel}</small>
                          </div>
                          <div className="ac-notification-controls">
                            {!item.readAt && <button type="button" disabled={busy} onClick={() => void act(() => api('notifications/' + item.id + '/read', 'PATCH', { read: true }))}>
                              {language === 'en' ? 'Mark as read' : 'Marchează citită'}
                            </button>}
                            <button type="button" disabled={busy} onClick={() => void act(() => api('notifications/' + item.id, 'DELETE'))}>
                              {language === 'en' ? 'Dismiss' : 'Elimină'} <X size={16}/>
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : <Empty text={language === 'en' ? 'No alerts to show.' : 'Nu există alerte de afișat.'}/>}
                </section>
              </div>
            )}
            {tab === 'Centru de suport' && (
              <SupportChat role={data.profile.role} preview={!!previewData} />
            )}
            {tab==='Abonament'&&<SubscriptionPage data={data} language={language} busy={busy} invoices={invoices} portal={()=>void act(async()=>{if(previewData)throw new Error('Disponibil în contul autentificat.');const out=await api('billing/portal','POST');window.location.assign(out.url);},'')} checkout={startCheckout}/>}
            {tab==='Rapoarte'&&(data.premium?<PremiumDownloads data={data} language={language} preview={!!previewData}/>:<section className="card studio-report-intro"><Download size={32}/><h2>{language==='en'?'Reports, ready when you need them.':'Rapoartele tale, gata când ai nevoie.'}</h2><p>{language==='en'?'PDF and CSV reports are included with Premium. Your personal data export remains free in account settings.':'Rapoartele PDF și CSV sunt incluse cu Premium. Exportul datelor personale rămâne gratuit în setările contului.'}</p><button className="primary" onClick={()=>navigate('Premium')}>{language==='en'?'Compare plans':'Compară planurile'}</button></section>)}
            {tab === 'Premium' && (
              <Membership
                language={language}
                data={data}
                preview={!!previewData}
                invoices={invoices}
                navigate={navigate}
                onRecord={record=>setModal({kind:record.kind as 'document'|'service'|'expense',record})}
                busy={busy}
                checkout={startCheckout}
                portal={() =>
                  void act(async () => {
                    const out = await api('billing/portal', 'POST');
                    window.location.assign(out.url);
                  })
                }
              />
            )}
            {tab === 'Setări' && (
              <div className="ws-settings-layout">
              <nav className="ws-settings-nav" aria-label={language==='en'?'Settings categories':'Categorii setări'} data-workspace-ui>{([['account','Profil și securitate','Profile & security'],['alerts','Notificări și email','Notifications & email'],['device','Aplicație și afișare','App & display'],['help','Ajutor','Help']] as const).map(([id,ro,en])=><button type="button" key={id} aria-current={settingsPanel===id?'page':undefined} onClick={()=>setSettingsPanel(id)}>{language==='en'?en:ro}<ArrowUpRight size={15}/></button>)}</nav>
              <div className="grid2 settings-workspace">
                <section hidden={settingsPanel!=='device'} className="card ac-install-settings"><h3>AutoCare pe telefon</h3><p className="small muted">Instalează aplicația pe iPhone sau Samsung, fără să pierzi datele contului.</p><MobileInstall /><AppUpdateSettings /><WorkspacePreferences language={language} currency={currency} onLanguage={changeLanguage} onCurrency={changeCurrency}/></section>
                <section hidden={settingsPanel!=='alerts'} className="card">
                  <div className="settings-section-title">
                    <span className="list-icon">
                      <BellRing size={22} />
                    </span>
                    <div>
                      <p className="eyebrow">ALERTE ȘI TERMENE</p>
                      <h3>Când vrei să primești notificări?</h3>
                    </div>
                  </div>
                  <p className="small muted">
                    Alege doar ce ai nevoie. Opțiunile avansate sunt ascunse mai jos.
                  </p>
                  <CommunicationPreferences />
                  <form
                    className="stack"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await act(() =>
                        api('profile', 'PUT', {
                          timezone: String(f.get('timezone')),
                          emailEnabled: f.has('emailEnabled'),
                          pushEnabled: f.has('pushEnabled'),
                          afterExpiry: f.has('afterExpiry'),
                          offsets: f.getAll('offset').map(Number),
                          hour: Number(f.get('hour')),
                        }),
                      );
                    }}
                  >
                    <details className="autocare-advanced-settings"><summary>Setări avansate pentru notificări</summary>
                    <label>
                      Fus orar
                      <input
                        name="timezone"
                        defaultValue={data.profile.timezone}
                        required
                        list="zones"
                      />
                      <datalist id="zones">
                        <option>Europe/Bucharest</option>
                        <option>Europe/Berlin</option>
                        <option>Europe/London</option>
                        <option>America/New_York</option>
                      </datalist>
                    </label>
                    <label>
                      Ora locală preferată (Premium)
                      <input
                        type="number"
                        name="hour"
                        min={0}
                        max={23}
                        defaultValue={data.profile.hour}
                        readOnly={!data.premium}
                      />
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        name="emailEnabled"
                        defaultChecked={data.profile.emailEnabled}
                      />
                      Email
                    </label>
                    <label className="check">
                      <input
                        type="checkbox"
                        name="pushEnabled"
                        defaultChecked={data.profile.pushEnabled}
                      />
                      Web Push, dacă este configurat
                    </label>
                    <div className="offsets">
                      {[30, 14, 7, 6, 5, 4, 3, 2, 1, 0].map((n) => (
                        <label className="check" key={n}>
                          <input
                            type="checkbox"
                            name="offset"
                            value={n}
                            defaultChecked={data.profile.offsets.includes(n)}
                            disabled={!data.premium && ![30, 7, 1, 0].includes(n)}
                          />
                          {n === 0 ? 'În ziua expirării' : n === 1 ? '1 zi' : n + ' zile'}
                        </label>
                      ))}
                    </div>
                    <label className="check">
                      <input
                        type="checkbox"
                        name="afterExpiry"
                        defaultChecked={data.profile.afterExpiry}
                        disabled={!data.premium}
                      />
                      Un memento după expirare (Premium)
                    </label>
                    </details>
                    <button className="primary" disabled={busy}>
                      Salvează preferințele
                    </button>
                  </form>
                  <details className="autocare-advanced-settings"><summary>Activare și administrare notificări push</summary>
                  <div className="actions">
                    <button onClick={push}>Activează push în browser</button>
                    <button
                      onClick={() =>
                        act(async () => {
                          await api('push', 'DELETE');
                          await api('profile', 'PUT', { ...profileValues(), pushEnabled: false });
                          const reg = await navigator.serviceWorker?.getRegistration();
                          const sub = await reg?.pushManager.getSubscription();
                          await sub?.unsubscribe();
                        })
                      }
                    >
                      Dezactivează push
                    </button>
                  </div>
                  <p className="micro">
                    Necesită HTTPS și browser compatibil. Nu se promite aceeași funcționare pe toate
                    dispozitivele.
                  </p></details>
                </section>
                <section hidden={settingsPanel!=='account'} className="card">
                  <div className="settings-section-title">
                    <span className="profile-avatar">{name.slice(0, 1).toUpperCase()}</span>
                    <div>
                      <p className="eyebrow">CONTUL TĂU</p>
                      <h3>Profil și securitate</h3>
                    </div>
                  </div>
                  <p className="small muted">Actualizează numele, parola și datele personale.</p>
                  <form
                    className="stack"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await act(async () => {
                        const out = await authClient.updateUser({ name: String(f.get('name')) });
                        if (out.error) throw new Error(out.error.message);
                      });
                    }}
                  >
                    <label>
                      Nume
                      <input name="name" defaultValue={name} required maxLength={100} />
                    </label>
                    <button>Salvează numele</button>
                  </form>
                  <details className="autocare-advanced-settings"><summary>Schimbă parola</summary>
                  <form
                    className="stack"
                    style={{ marginTop: 25 }}
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      await act(async () => {
                        const out = await authClient.changePassword({
                          currentPassword: String(f.get('current')),
                          newPassword: String(f.get('new')),
                          revokeOtherSessions: true,
                        });
                        if (out.error) throw new Error(out.error.message);
                      });
                    }}
                  >
                    <label>
                      Parola curentă
                      <input
                        type="password"
                        name="current"
                        autoComplete="current-password"
                        required
                      />
                    </label>
                    <label>
                      Parola nouă
                      <input
                        type="password"
                        name="new"
                        minLength={12}
                        autoComplete="new-password"
                        required
                      />
                    </label>
                    <button>Schimbă parola</button>
                  </form>
                  </details><details className="autocare-advanced-settings"><summary>Date personale și ștergerea contului</summary>
                  <h3 style={{ marginTop: 30 }}>Datele personale</h3>
                  <a className="button small" href="/api/v1/export?format=json">
                    <Download size={15} />
                    Descarcă datele personale
                  </a>
                  <p className="micro">
                    Include fișierele atașate codificate Base64. Accesibil gratuit.
                  </p>
                  <button className="danger" onClick={() => setDeleteOpen(true)}>
                    Șterge contul și datele
                  </button></details>
                </section>
                <section hidden={settingsPanel!=='help'} className="card support-area">
                  <div className="settings-section-title">
                    <span className="list-icon">
                      <MessageSquare size={22} />
                    </span>
                    <div>
                      <p className="eyebrow">ASISTENȚĂ AUTOCARE</p>
                      <h3>Suntem aici să te ajutăm.</h3>
                    </div>
                  </div>
                  <p className="small muted">
                    Toate mesajele și răspunsurile echipei, în aceeași conversație privată.
                  </p>
                  <button className="primary" onClick={() => navigate('Centru de suport')}>
                    Deschide centrul de suport <ArrowUpRight size={15} />
                  </button>
                </section>
              </div></div>
            )}
            {tab === 'Administrare' &&
              (admin ? (
                <Admin
                  admin={admin}
                  busy={busy}
                  save={async (path: string, method: string, payload?: unknown) => {
                    await act(() => api(path, method, payload));
                    setAdmin(await api('admin'));
                  }}
                />
              ) : (
                <p className="muted">Se verifică accesul…</p>
              ))}
          </>
        )}
        {archiveVehicleTarget && (
          <Dialog title={language === 'en' ? 'Archive vehicle' : 'Arhivează vehiculul'} onClose={() => { if (!busy) setArchiveVehicleTarget(null); }}>
            <p data-user-content><strong>{archiveVehicleTarget.brand} {archiveVehicleTarget.model}</strong> · {archiveVehicleTarget.plate}</p>
            <p>{language === 'en' ? 'Its records stay in your account and its reminders stop.' : 'Datele și istoricul rămân în cont, iar alertele asociate se opresc.'}</p>
            {error && <p role="alert">{error}</p>}
            <div className="ac-garage-confirm-actions">
              <button type="button" disabled={busy} onClick={() => setArchiveVehicleTarget(null)}>{language === 'en' ? 'Cancel' : 'Renunță'}</button>
              <button type="button" disabled={busy} className="danger" onClick={async () => {
                const archived = await act(() => api('vehicles/' + archiveVehicleTarget.id, 'DELETE'));
                if (archived || previewData) setArchiveVehicleTarget(null);
              }}>{language === 'en' ? 'Confirm archive' : 'Confirmă arhivarea'}</button>
            </div>
          </Dialog>
        )}
        {checkoutUrl && (
          <Dialog title={language === 'en' ? 'Secure payment' : 'Plată securizată'} onClose={() => setCheckoutUrl(null)}>
            <a
              className="button primary stripe-checkout-cta"
              href={checkoutUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="stripe-checkout-mark" aria-hidden="true">stripe</span>
              {language === 'en' ? 'Continue to Stripe' : 'Continuă către Stripe'}
            </a>
          </Dialog>
        )}
        {deleteOpen && (
          <Dialog title="Șterge contul" onClose={() => setDeleteOpen(false)}>
            <p>
              Ștergerea contului și a datelor asociate este definitivă. Anulează mai întâi
              abonamentul.
            </p>
            <form
              className="stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await act(async () => {
                  await api('account', 'DELETE', {
                    password: String(f.get('password')),
                    confirm: String(f.get('confirm')),
                  });
                  window.location.assign('/');
                });
              }}
            >
              <label>
                Scrie ȘTERGE
                <input name="confirm" required pattern="ȘTERGE" autoComplete="off" />
              </label>
              <label>
                Confirmă parola
                <input name="password" type="password" required autoComplete="current-password" />
              </label>
              <button className="danger" disabled={busy}>
                Șterge definitiv
              </button>
            </form>
          </Dialog>
        )}
        {history && (
          <Dialog title="Istoricul modificărilor" onClose={() => setHistory(null)}>
            {history.length ? (
              history.map((h) => (
                <section className="card" key={h.id}>
                  <p className="eyebrow">{new Date(h.createdAt).toLocaleString(locale)}</p>
                  <dl>
                    {Object.entries(h.snapshot)
                      .filter(([k]) => !['id', 'userId', 'vehicleId'].includes(k))
                      .map(([k, v]) => (
                        <div key={k}>
                          <dt className="muted small">{k}</dt>
                          <dd>{String(v ?? '—')}</dd>
                        </div>
                      ))}
                  </dl>
                </section>
              ))
            ) : (
              <p className="muted">Nu există versiuni anterioare.</p>
            )}
          </Dialog>
        )}
        {modal && data && (
          <Dialog
            title={
              modal.kind === 'vehicle'
                ? modal.vehicle
                  ? 'Editează mașina'
                  : 'Adaugă mașină'
                : modal.completionOf
                  ? (language==='en'?'Record completed service':'Înregistrează lucrarea efectuată')
                  : modal.record
                  ? 'Editează înregistrarea'
                  : modal.kind === 'document'
                    ? 'Adaugă document'
                    : modal.kind === 'service'
                      ? 'Adaugă intervenție'
                      : 'Adaugă cheltuială'
            }
            onClose={closeRecord}
          >
            {modal.kind !== 'vehicle' ? (
              <RecordEditor
                key={modal.record?.id || modal.kind}
                kind={modal.kind}
                record={modal.record}
                data={data}
                vehicleId={filter || undefined}
                onDirty={setRecordDirty}
                onCancel={closeRecord}
                onSave={async (payload, file) => {
                  if (recordSaving) return false;
                  setRecordSaving(true);
                  setError('');
                  setNotice('');
                  try {
                    if (previewData)
                      throw new Error(
                        'La cererea ta, formularele salvează numai în contul autentificat; demonstrația nu trimite date.',
                      );
                    const saved = await api(
                      modal.completionOf ? 'records/'+modal.completionOf+'/complete' : 'records' + (modal.record ? '/' + modal.record.id : ''),
                      modal.record && !modal.completionOf ? 'PATCH' : 'POST',
                      payload,
                    );
                    if (file) {
                      const form = new FormData();
                      form.set('file', file);
                      form.set('recordId', saved.id);
                      const response = await fetch('/api/v1/files', { method: 'POST', body: form });
                      if (!response.ok) {
                        const out = await response.json();
                        await refresh();
                        setRecordDirty(false);
                        setModal(null);
                        setNotice(
                          'Înregistrarea a fost salvată, dar atașamentul nu s-a încărcat: ' +
                            out.error +
                            '. Poți reîncerca atașarea din listă.',
                        );
                        return true;
                      }
                    }
                    await refresh();
                    setRecordDirty(false);
                    setNotice('Înregistrarea a fost salvată.');
                    setModal(null);
                    return true;
                  } finally {
                    setRecordSaving(false);
                  }
                }}
              />
            ) : (
              <form className="form-grid ac-premium-vehicle-form" onChange={() => setRecordDirty(true)} onSubmit={saveForm}>
                <div className="ac-premium-form-intro full">
                  <div className="ac-premium-form-symbol"><CarFront size={31}/></div>
                  <div><strong>{modal.vehicle ? 'Actualizează datele mașinii' : 'Configurează noua mașină'}</strong>
                  <p>Completează informațiile reale. Le poți modifica ulterior din Garaj.</p></div>
                </div>
                <div className="ac-premium-form-section full"><span>01</span> Identificare și înmatriculare</div>
                <>
                  <label>
                    Marcă
                    <input name="brand" required defaultValue={modal.vehicle?.brand} />
                  </label>
                  <label>
                    Model
                    <input name="model" required defaultValue={modal.vehicle?.model} />
                  </label>
                  <label>
                    An
                    <input
                      type="number"
                      name="year"
                      required
                      min={1886}
                      max={new Date().getFullYear() + 1}
                      defaultValue={modal.vehicle?.year || new Date().getFullYear()}
                    />
                  </label>
                  <label>
                    Număr de înmatriculare
                    <input
                      name="plate"
                      required
                      maxLength={20}
                      defaultValue={modal.vehicle?.plate}
                    />
                  </label>
                  <div className="ac-premium-form-section full"><span>02</span> Date tehnice și kilometraj</div>
                  <label>
                    Kilometraj actual
                    <input
                      name="odometer"
                      type="number"
                      min={0}
                      required
                      defaultValue={modal.vehicle?.odometer ?? 0}
                    />
                  </label>
                  <label>
                    Combustibil
                    <select name="fuel" defaultValue={modal.vehicle?.fuel || 'Benzină'}>
                      {['Benzină', 'Diesel', 'Hibrid', 'Electric', 'GPL', 'Altul'].map((f) => (
                        <option key={f} value={f}>{f}</option>
                      ))}
                    </select>
                  </label>
                  <details className="app-vehicle-extra full"><summary>{language==='en'?'Technical details · optional':'Detalii tehnice · opțional'}</summary><div className="form-grid">
                  <label>
                    VIN (opțional)
                    <input name="vin" maxLength={17} defaultValue={modal.vehicle?.vin || ''} />
                  </label>
                  <label>
                    Motorizare
                    <input name="engine" defaultValue={modal.vehicle?.engine || ''} />
                  </label>
                  <label>
                    Capacitate (cm³)
                    <input
                      name="capacity"
                      type="number"
                      min={0}
                      defaultValue={modal.vehicle?.capacity || ''}
                    />
                  </label>
                  <div className="ac-premium-form-section full"><span>03</span> Alte informații</div>
                  <label>
                    Data achiziției
                    <input
                      name="purchasedAt"
                      type="date"
                      defaultValue={modal.vehicle?.purchasedAt || ''}
                    />
                  </label>
                  </div></details>
                </>
                <label className="full">
                  Note
                  <textarea
                    name="notes"
                    maxLength={4000}
                    defaultValue={modal.record?.notes || modal.vehicle?.notes || ''}
                  />
                </label>
                <div className="full actions">
                  <button className="primary" disabled={busy}>
                    {busy ? 'Se salvează…' : 'Salvează'}
                  </button>
                  <button type="button" disabled={busy} onClick={closeRecord}>
                    Renunță
                  </button>
                </div>
                <p className="micro full">Datele sunt salvate în contul tău. Documentele se pot adăuga ulterior în secțiunea Documente.</p>
              </form>
            )}
          </Dialog>
        )}
      </main>
    </div></ApplicationLanguageProvider>
  );
}
function ExpenseChart({ data, currency }: { data: Data; currency: 'RON' | 'EUR' }) {
  const chartLanguage = useApplicationLanguage();

  const locale=useApplicationLocale();
const moneyDisplay = (bani: number): string => currency === 'EUR'
    ? new Intl.NumberFormat('en-IE', {style:'currency',currency:'EUR'}).format(bani / 500)
    : new Intl.NumberFormat(locale, {style:'currency',currency:'RON'}).format(bani / 100);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const max = Math.max(1, ...data.summary.monthly.map((m) => m.bani));
  return (
    <>
      <div
        className="chart"
        role="group"
        aria-label={
          (chartLanguage === 'en' ? 'Monthly expenses: ' : 'Cheltuieli lunare: ') +
          data.summary.monthly.map((m) => `${m.month}: ${moneyDisplay(m.bani)}`).join(', ')
        }
      >
        {data.summary.monthly.map((m) => (
          <button
            type="button"
            className="bar"
            key={m.month}
            aria-label={`${m.month}: ${moneyDisplay(m.bani)}`}
            aria-pressed={selectedMonth === m.month}
            onClick={() => setSelectedMonth(m.month)}
            title={`${m.month}: ${moneyDisplay(m.bani)}`}
          >
            <div className="bar-fill" style={{ height: Math.max(2, (m.bani / max) * 140) }} />
            <span>{m.month.slice(-2)}</span>
          </button>
        ))}
      </div>
      {selectedMonth && (
        <p role="status" className="small">
          {selectedMonth}:{' '}
          <strong>
            {moneyDisplay(data.summary.monthly.find((m) => m.month === selectedMonth)?.bani || 0)}
          </strong>
        </p>
      )}
      <p className="micro">
        Valori din înregistrările active. Lunile fără date nu indică lipsa cheltuielilor.
      </p>
    </>
  );
}
function Calendar({
  month,
  rows,
  open,
}: {
  month: string;
  rows: RecordItem[];
  open: (record: RecordItem) => void;
}) {
  const language=useApplicationLanguage();
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split('-').map(Number),
    start = (new Date(y, m - 1, 1).getDay() + 6) % 7,
    days = new Date(y, m, 0).getDate();
  return (
    <div className="calendar">
      {(language==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']).map((d) => (
        <div className="muted small" key={d}>
          {d}
        </div>
      ))}
      {Array.from({ length: start }, (_, i) => (
        <div key={'empty' + i} />
      ))}
      {Array.from({ length: days }, (_, i) => {
        const date = month + '-' + String(i + 1).padStart(2, '0');
        return (
          <div
            className={
              'calendar-day ' + (date === new Date().toLocaleDateString('en-CA') ? 'today' : '')
            }
            key={date}
          >
            <strong>{i + 1}</strong>
            {rows
              .filter((r) => r.expiresAt === date)
              .map((r) => (
                <button className="calendar-event" key={r.id} onClick={() => open(r)}>
                  {r.title}
                </button>
              ))}
          </div>
        );
      })}
    </div>
  );
}
function Admin({
  admin,
  busy: _busy,
  save: _save,
}: {
  admin: any;
  busy: boolean;
  save: (path: string, method: string, payload?: unknown) => Promise<void>;
}) {
  return (
    <div className="stack">
      <div className="stats">
        {[
          ['Utilizatori', admin.totals.users],
          ['Utilizatori activi', admin.active.active],
          ['Alerte eșuate', admin.failed.length],
          ['Joburi recente', admin.jobs.length],
        ].map(([label, value]) => (
          <div className="card stat" key={label}>
            <span className="muted small">{label}</span>
            <div className="value">{value}</div>
          </div>
        ))}
      </div>
      <section className="card">
        <h3>Venituri din facturi de test</h3>
        {admin.revenues.length ? (
          admin.revenues.map((r: { currency: string; total: number }) => (
            <p key={r.currency}>
              {(r.total / 100).toFixed(2)} {r.currency.toUpperCase()}
            </p>
          ))
        ) : (
          <p className="muted">Nu există încasări înregistrate.</p>
        )}
        <p className="micro">
          Utilizator activ: sesiune neexpirată actualizată în ultimele 30 zile. Listele de mai jos
          sunt limitate la 200 înregistrări.
        </p>
      </section>

      {[
        ['Utilizatori', admin.users],
        ['Abonamente', admin.subscriptions],
        ['Joburi', admin.jobs],
        ['Alerte eșuate', admin.failed],
        ['Audit administrativ', admin.audit],
      ].map(([label, items]) => (
        <section className="card table-scroll" key={label}>
          <h3>{label}</h3>
          {items.length ? (
            <table>
              <thead>
                <tr>
                  {Object.keys(items[0]).map((k) => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((r: any, i: number) => (
                  <tr key={i}>
                    {Object.values(r).map((v: any, j: number) => (
                      <td key={j}>{String(v ?? '—')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="muted">Nu există înregistrări.</p>
          )}
        </section>
      ))}
      <SupportChat role="admin" />
    </div>
  );
}
