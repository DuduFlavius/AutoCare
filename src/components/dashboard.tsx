'use client';
import SiteLanguage from './site-language';
import CommunicationPreferences from './communication-preferences';
import Membership from './membership';
import MobileInstall from './mobile-install';
import PushSettings from './push-settings';
import SmartDriveTrip from './smartdrive-trip';
import ServiceForecastCards from './service-forecast-cards';
import SmartDriveHistory from './smartdrive-history';
import RecordEditor from './record-editor';
import { filterRecords, documentCounts, serviceStats } from '@/lib/record-filters';
import SupportChat from './support-chat';
import { useState, useEffect, useRef, type FormEvent } from 'react';
import {
  CarFront,
  LayoutDashboard,
  Files,
  Wrench,
  Wallet,
  BellRing,
  Settings,
  CreditCard,
  Shield,
  Star,
  Gauge,
  Plus,
  ArrowUpRight,
  LogOut,
  ChevronDown,
  X,
  CalendarDays,
  Download,
  FolderOpen,
  MessageSquare,
  SlidersHorizontal,
  Search,
  Menu,
  MapPin,
} from 'lucide-react';
import { Brand } from './public-shell';
import { GarageHome, VehicleJournal, VehicleSheet, ReminderInbox } from './garage-home';
import { authClient } from '@/lib/auth-client';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
type Vehicle = Data['vehicles'][number];
type RecordItem = Data['records'][number];
type Modal = {
  kind: 'vehicle' | 'document' | 'service' | 'expense';
  vehicle?: Vehicle;
  record?: RecordItem;
} | null;
const money = (b: number) =>
  new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(b / 100);
const tabs = [
  ['Dashboard', LayoutDashboard],
  ['Garaj', CarFront],
  ['Documente', Files],
  ['Calendar', CalendarDays],
  ['Întreținere', Wrench],
  ['Plan întreținere', Gauge],
  ['Kilometraj', Gauge],
  ['Cheltuieli', Wallet],
  ['Centru de suport', MessageSquare],
  ['Istoric auto', Gauge],
  ['Notificări', BellRing],
  ['Abonament', CreditCard],
  ['Setări', Settings],
] as const;
async function api(path: string, method = 'GET', data?: unknown) {
  const r = await fetch('/api/v1/' + path, {
    method,
    headers: data ? { 'Content-Type': 'application/json' } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await r.json();
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
  return (
    <span className={'pill ' + record.status.state}>
      {record.status.label}
      {record.status.days != null && record.status.days >= 0 ? ` · ${record.status.days} zile` : ''}
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
    ref.current?.querySelector<HTMLElement>('button,input,select')?.focus();
    function key(e: KeyboardEvent) {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button,input,select,textarea,a[href]',
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

function MileagePlanner({ data, preview, onUpdated, onError, mileageOnly = false }: {
  data: Data; preview: boolean; onUpdated: () => Promise<unknown>; onError: (message: string) => void; mileageOnly?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => { if (window.location.hash === '#actualizeaza-km' && data.vehicles.length) { setEditing(data.vehicles[0].id); setKm(String(data.vehicles[0].odometer)); setTimeout(() => document.getElementById('ac-mileage-editor')?.scrollIntoView({behavior:'smooth',block:'center'}), 150); } }, []);
  const [km, setKm] = useState('');
  const [saving, setSaving] = useState(false);
  const [lastReadings, setLastReadings] = useState<Record<string,{odometer:number;recordedAt:string}>>({});
  const [confirmedJump, setConfirmedJump] = useState<string | null>(null);
  useEffect(() => { if (preview) return; let cancelled=false; Promise.all(data.vehicles.filter(v=>!v.archived).map(async v=>{try{const rows=await api('smartdrive/vehicles/'+v.id+'/readings') as {odometer:number;recordedAt:string}[];return [v.id,rows[0]] as const}catch{return [v.id,undefined] as const}})).then(entries=>{if(!cancelled)setLastReadings(Object.fromEntries(entries.filter((e): e is readonly [string,{odometer:number;recordedAt:string}] => e[1] !== undefined))) });return()=>{cancelled=true}; },[preview,data.vehicles.map(v=>v.id+':'+v.odometer).join('|')]);
  const cars = data.vehicles.filter(v => !v.archived);
  const services = data.records.filter(r => r.kind === 'service' && !r.cancelled && r.nextKm != null && Number(r.nextKm) > 0);
  const fmt = (n: number) => n.toLocaleString('ro-RO') + ' km';
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
        <div><span className="eyebrow">AUTOCARE · PLANIFICARE</span><h2>{mileageOnly ? 'Kilometrajul mașinilor' : 'Următoarea întreținere'}</h2>
          <p>Calcule bazate pe kilometrajul introdus și termenele salvate în istoricul mașinii. Nu sunt estimări GPS.</p></div>
        <span className="mileage-planner-icon"><Gauge size={27}/></span>
      </div>
      {!cars.length && <div className="card"><p>Adaugă prima mașină în Garaj pentru a urmări întreținerea.</p></div>}
      {!mileageOnly && <SmartDriveHistory vehicles={cars.map(v => ({ id: v.id, brand: v.brand, model: v.model, odometer: v.odometer }))} preview={preview} />}
      {!mileageOnly && <SmartDriveTrip preview={preview} vehicles={cars.map(v => ({ id: v.id, brand: v.brand, model: v.model }))} />}
      <div className="mileage-planner-grid" id="ac-mileage-editor">
        {cars.map(v => {
          const due = services.filter(r => r.vehicleId === v.id).sort((a,b) => Number(a.nextKm)-Number(b.nextKm));
          return <article key={v.id} className="mileage-planner-card">
            <div className="between"><div><span className="eyebrow">{v.plate}</span><h3>{v.brand} {v.model}</h3></div><CarFront size={28}/></div>
            <div className="mileage-planner-odometer"><span>Kilometraj înregistrat</span><strong>{fmt(v.odometer)}</strong></div>
            {editing === v.id ? <div className="mileage-planner-edit">
              <label>Kilometraj actual (km)<input type="number" min={v.odometer} step="1" value={km} onChange={e => {setKm(e.target.value);setConfirmedJump(null)}} /></label>
              {confirmedJump === v.id+':'+Number(km) && <div role="alert" style={{padding:16,border:'1px solid #f0c68b',background:'linear-gradient(125deg,#fffaf0,#fff2dd)',color:'#6e410c',borderRadius:14,margin:'12px 0'}}><strong style={{display:'block',fontSize:16}}>Ești sigur că ai parcurs atât?</strong><p style={{margin:'7px 0'}}>Ai introdus o creștere de <b>{(Number(km)-v.odometer).toLocaleString('ro-RO')} km</b> față de ultima valoare confirmată. Verifică cifra de pe bord înainte de salvare.</p><p style={{fontSize:12,margin:0}}>Poți corecta valoarea în câmpul de mai sus sau confirma înregistrarea. Nu modificăm automat kilometrajul.</p></div>}
              <button className="primary" disabled={saving} onClick={() => void saveKm(v)}>{saving ? 'Se salvează…' : 'Actualizează km'}</button>
              <button disabled={saving} onClick={() => setEditing(null)}>Anulează</button>
            </div> : <button onClick={() => {setEditing(v.id);setKm(String(v.odometer));setConfirmedJump(null);}}>Actualizează kilometrajul</button>}
            {!due.length ? <p className="mileage-planner-empty">Nu există încă o intervenție cu kilometrajul următorului schimb. Adaugă termenul în secțiunea Întreținere.</p> :
              <div className="mileage-planner-items">{due.map(r => {
                const left = Number(r.nextKm) - v.odometer;
                return <div className="mileage-planner-item" key={r.id}>
                  <div><strong>{r.title || r.category || 'Intervenție'}</strong><small>Termen: {fmt(Number(r.nextKm))}</small></div>
                  <span className={left <= 0 ? 'mileage-overdue' : left <= 1000 ? 'mileage-soon' : 'mileage-ok'}>
                    {left <= 0 ? 'Depășit cu ' + fmt(Math.abs(left)) : 'Mai sunt ' + fmt(left)}
                  </span>
                </div>;
              })}</div>}
            <ServiceForecastCards vehicleId={v.id} currentKm={v.odometer} preview={preview} services={due.map(r => ({id:r.id,title:r.title || r.category || 'Intervenție',nextKm:Number(r.nextKm),expiresAt:r.expiresAt}))} />
            <p className="micro">Recomandare AutoCare: actualizează kilometrajul periodic. Intervalele se stabilesc după manualul producătorului și condițiile de utilizare.</p>
          </article>;
        })}
      </div>
    </section>
  );
}

export default function Dashboard({ name, previewData }: { name: string; previewData?: Data }) {
  const [data, setData] = useState<Data | null>(previewData || null),
    [tab, setTab] = useState('Dashboard'),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [supportUnread, setSupportUnread] = useState(0),
    [locationStatus, setLocationStatus] = useState<'idle'|'loading'|'active'|'denied'|'unavailable'>('idle'),
    [locationAccuracy, setLocationAccuracy] = useState<number | null>(null),
    [menuOpen, setMenuOpen] = useState(false),
    [language, setLanguage] = useState<'ro' | 'en'>('ro'),
    [currency, setCurrency] = useState<'RON' | 'EUR'>('RON'),
    [busy, setBusy] = useState(false),
    [modal, setModal] = useState<Modal>(null),
    [filter, setFilter] = useState(''),
    [query, setQuery] = useState(''),
    [vehicleDetail, setVehicleDetail] = useState<string | null>(null),
    [recordState, setRecordState] = useState(''),
    [categoryFilter, setCategoryFilter] = useState(''),
    [period, setPeriod] = useState('all'),
    [recordDirty, setRecordDirty] = useState(false),
    [recordSaving, setRecordSaving] = useState(false),
    [recordView, setRecordView] = useState('timeline'),
    [calendarView, setCalendarView] = useState('list'),
    [showArchived, setShowArchived] = useState(false),
    [deleteOpen, setDeleteOpen] = useState(false),
    [history, setHistory] = useState<Array<{
      id: string;
      createdAt: string;
      snapshot: Record<string, unknown>;
    }> | null>(null),
    [admin, setAdmin] = useState<any>(null),
    [invoices, setInvoices] = useState<any[]>([]),
    [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));
  useEffect(() => {
    try { if (window.localStorage.getItem('autocare-language') === 'en') {setLanguage('en');setCurrency('EUR');}
      const savedCurrency = window.localStorage.getItem('autocare-currency');
      if (savedCurrency === 'EUR' || savedCurrency === 'RON') setCurrency(savedCurrency); } catch { /* Storage may be unavailable. */ }
    const t = new URLSearchParams(window.location.search).get('tab');
    if (t) setTab(t);
    refresh();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);
  useEffect(() => {
    if (previewData || tab !== 'Notificări' || !data?.notifications.some(n => !n.readAt)) return;
    void api('notifications/read', 'POST').then(refresh).catch(e => setError(e.message));
  }, [tab, previewData, data?.notifications]);
  useEffect(() => {
    if (previewData) return;
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
    const check = () => {
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
        .catch(() => {});
    };
    const notifications = () => {
      if (!document.hidden) void api('dashboard').then(setData).catch(() => {});
      void check();
    };
    const notificationTimer = setInterval(notifications, 30000);
    window.addEventListener('focus', notifications);
    document.addEventListener('visibilitychange', notifications);
    check();
    const timer = setInterval(check, 15000);
    return () => {
      clearInterval(timer);
      clearInterval(notificationTimer);
      window.removeEventListener('focus', notifications);
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
  async function refresh() {
    if (previewData) return;
    try {
      setData(await api('dashboard'));
    } catch (e) {
      setError((e as Error).message);
    }
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
  function navigate(t: string, historyMode: 'push' | 'none' = 'push') {
    if (recordSaving) return false;
    if (recordDirty && !window.confirm('Ai modificări nesalvate. Vrei să le abandonezi?'))
      return false;
    setModal(null);
    setRecordDirty(false);
    setTab(t);
    setMenuOpen(false);
    setFilter('');
    setQuery('');
    setRecordState('');
    setCategoryFilter('');
    setPeriod('all');
    setShowArchived(false);
    setError('');
    setNotice('');
    if (historyMode === 'push' && new URLSearchParams(window.location.search).get('tab') !== t)
      window.history.pushState(
        null,
        '',
        (previewData ? '/previzualizare?tab=' : '/cont?tab=') + encodeURIComponent(t),
      );
    return true;
  }
  const displayedTabRef = useRef(tab);
  displayedTabRef.current = tab;
  const navigationRef = useRef(navigate);
  navigationRef.current = navigate;
  useEffect(() => {
    const back = () => {
      const next = new URLSearchParams(window.location.search).get('tab') || 'Dashboard';
      if (navigationRef.current(next, 'none') === false) {
        const url = new URL(window.location.href);
        url.searchParams.set('tab', displayedTabRef.current);
        window.history.pushState(null, '', url);
      }
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  const activeCars = data?.vehicles.filter((v) => !v.archived) || [];
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
    : new Intl.NumberFormat('ro-RO', {style:'currency',currency:'RON'}).format(bani / 100);
  const exportUrl = (format: string) =>
    '/api/v1/export?' +
    new URLSearchParams(
      Object.entries({ ...exportFilters, format }).filter(
        ([, v]) => v !== undefined && v !== '',
      ) as [string, string][],
    ).toString();
  function closeRecord() {
    if (recordSaving) return;
    if (
      recordDirty &&
      !window.confirm('Ai modificări nesalvate. Închizi formularul și renunți la ele?')
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
  return (
    <div className="app-shell">
      {menuOpen && (
        <div className="navigation-overlay">
          <Dialog title={data?.profile.role === 'founder' ? 'AutoCare · Fondator' : 'Navigare AutoCare'} onClose={() => setMenuOpen(false)}>
            <nav aria-label="Navigare mobil">
              {([
                ['ESENȚIAL', ['Dashboard', 'Garaj', 'Documente', 'Notificări']],
                ['ORGANIZARE', ['Kilometraj', 'Plan întreținere', 'Calendar', 'Întreținere', 'Cheltuieli', 'Istoric auto']],
                ['CONT ȘI AJUTOR', ['Centru de suport', 'Abonament', 'Setări']],
              ] as const).map(([group, labels]) => (
                <div className="autocare-mobile-menu-group" key={group}>
                  <span className="autocare-mobile-menu-heading">{group}</span>
                  {tabs.filter(([label]) => (labels as readonly string[]).includes(label)).map(([label, Icon]) => (
                    <button key={label} aria-current={tab === label ? 'page' : undefined} onClick={() => navigate(label)}>
                      <Icon size={19} />
                      <span>{label === 'Dashboard' ? 'Acasă' : label === 'Plan întreținere' ? 'SmartDrive GPS' : label === 'Kilometraj' ? 'Kilometraj & revizii' : label}</span>
                      {label === 'Notificări' && !!data?.notifications.filter((n) => !n.readAt).length && (
                        <span className="nav-unread">{data.notifications.filter((n) => !n.readAt).length}</span>
                      )}
                      {label === 'Centru de suport' && supportUnread > 0 && <span className="nav-unread">{supportUnread}</span>}
                    </button>
                  ))}
                </div>
              ))}
              {data?.profile.role === 'founder' && (
                <div className="autocare-mobile-founder-card">
                  <div className="autocare-mobile-founder-identity">
                    <Shield size={20} />
                    <span><strong>FONDATOR AUTOCARE</strong><small>Administrare și acces Premium gratuit</small></span>
                  </div>
                  <a className="autocare-mobile-founder-action" href="/admin">
                    <Star size={18} /> Acordă Premium prietenilor <ArrowUpRight size={16} />
                  </a>
                </div>
              )}
              {data?.profile.role === 'admin' && (
                <button onClick={() => navigate('Administrare')}>
                  <Shield size={20} />
                  Administrare
                </button>
              )}
              <div className="autocare-mobile-account-actions">
                <button type="button" onClick={() => navigate('Setări')}>
                  <Settings size={19} /> <span>Contul meu și setări</span>
                </button>
                <button type="button" onClick={async () => {
                  if (previewData) return;
                  if (recordDirty && !window.confirm('Ai modificări nesalvate. Vrei să te deconectezi?')) return;
                  try {
                    await authClient.signOut();
                    window.location.assign('/autentificare');
                  } catch {
                    window.alert('Deconectarea nu a reușit. Încearcă din nou.');
                  }
                }}>
                  <LogOut size={19} /> <span>Deconectare</span>
                </button>
              </div>
            </nav>
          </Dialog>
          <button
            className="drawer-outside"
            aria-label="Închide meniul"
            onClick={() => setMenuOpen(false)}
          />
        </div>
      )}
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
        <nav aria-label="Navigare cont">
          {tabs.map(([label, Icon]) => (
            <button
              key={label}
              className={tab === label ? 'active' : ''}
              aria-current={tab === label ? 'page' : undefined}
              onClick={() => navigate(label)}
            >
              <Icon size={18} />
              {label === 'Dashboard' ? 'Acasă' : label === 'Garaj' ? 'Garajul meu' : label === 'Întreținere' ? 'Intervenții' : label === 'Plan întreținere' ? 'SmartDrive GPS' : label === 'Centru de suport' ? 'Centru de suport' : label === 'Abonament' ? 'Premium' : label}
              {label === 'Notificări' && !!data?.notifications.filter((n) => !n.readAt).length && (
                <span className="nav-unread">
                  {data.notifications.filter((n) => !n.readAt).length}
                </span>
              )}
              {label === 'Centru de suport' && supportUnread > 0 && (
                <span className="nav-unread">{supportUnread}</span>
              )}
            </button>
          ))}
          {data?.profile.role === 'founder' && (
            <a className="founder-nav-link" href="/admin">
              <Shield size={18} /> Panou Fondator <ArrowUpRight size={13} />
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
        </nav>
        {data?.profile.role !== 'founder' && (
          <div
            className={
              'sidebar-bottom ' + (data?.premium ? 'membership-active' : 'membership-promo')
            }
          >
            <p className="eyebrow">{data?.premium ? 'PREMIUM ACTIV' : 'AUTOCARE PREMIUM'}</p>
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
              onClick={async () => {
                if (previewData) return;
                if (
                  recordDirty &&
                  !window.confirm('Ai modificări nesalvate. Vrei să te deconectezi?')
                )
                  return;
                await authClient.signOut();
                window.location.assign('/autentificare');
              }}
            >
              <LogOut size={16} />
              Deconectare
            </button>
          </div>
        </details>
      </aside>
      <SiteLanguage language={language} />
      <header className="app-header between">
        <button
          className="mobile-menu-toggle"
          aria-label="Deschide meniul"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <Menu size={23} />
        </button>
        <span className="autocare-header-breadcrumb" aria-label={`Garaj personal, ${tab}`}>
          <span>Garaj personal</span><span className="autocare-header-divider" aria-hidden="true">/</span><strong>{tab === 'Dashboard' ? 'Acasă' : tab}</strong>
        </span>
        <div className="inline autocare-header-actions">
          <select aria-label="Language / Limbă" value={language} onChange={e => { const next = e.target.value === 'en' ? 'en' : 'ro'; setLanguage(next); setCurrency(next === 'en' ? 'EUR' : 'RON'); try { localStorage.setItem('autocare-currency',next === 'en' ? 'EUR' : 'RON'); localStorage.setItem('autocare-language',next); document.documentElement.lang = next; } catch {} }} style={{border:'1px solid #bdd1ef',borderRadius:10,padding:'8px 9px',fontWeight:800,color:'#173e76',background:'#f4f8ff',maxWidth:76}}><option value="ro">RO</option><option value="en">EN</option></select>
          <select aria-label="Currency / Monedă" title={language === 'en' ? 'Display currency (estimated conversion)' : 'Moneda de afișare (conversie estimativă)'} value={currency} onChange={e => {const next = e.target.value === 'EUR' ? 'EUR' : 'RON';setCurrency(next);try{localStorage.setItem('autocare-currency',next)}catch{}}} style={{border:'1px solid #bdd1ef',borderRadius:10,padding:'8px 9px',fontWeight:800,color:'#173e76',background:'#f4f8ff'}}><option value="RON">RON</option><option value="EUR">EUR</option></select>
          <button
            type="button"
            className="autocare-location-button"
            title={locationStatus === 'active' ? 'Locația este activă pe acest dispozitiv.' : 'Verifică sau activează permisiunea de localizare pentru AutoCare'}
            aria-label="Verifică locația AutoCare"
            disabled={locationStatus === 'loading'}
            onClick={() => {
              // Geolocation must be called directly from the user gesture.
              if (!window.isSecureContext || !('geolocation' in navigator)) {
                setLocationStatus('unavailable');
                setNotice('Locația necesită HTTPS și un browser compatibil.');
                return;
              }
              setLocationStatus('loading');
              setNotice('');
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  setLocationAccuracy(Math.round(position.coords.accuracy));
                  setLocationStatus('active');
                  setNotice('Locația a fost permisă și activată.');
                },
                (err) => {
                  setLocationStatus(err.code === 1 ? 'denied' : 'unavailable');
                  setNotice(err.code === 1
                    ? 'Browserul blochează locația. Dacă nu apare fereastra de permisiune, permite locația din setările site-ului și apasă din nou.'
                    : err.code === 3 ? 'GPS-ul nu a răspuns la timp. Încearcă din nou.'
                    : 'Activează localizarea pe telefon și încearcă din nou.');
                },
                { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
              );
            }}
          >
            <MapPin size={16}/>
            <span>{locationStatus === 'active' ? 'Locație activă' : locationStatus === 'loading' ? 'Se verifică…' : locationStatus === 'denied' ? 'Locație refuzată' : locationStatus === 'unavailable' ? 'Locație indisponibilă' : 'Activează locația'}</span>
          </button>
          {locationStatus === 'denied' && <span className="ac-premium-location-help" role="status">Locația este blocată pe dispozitiv. Samsung: Setări site în Chrome → Locație → Permite; verifică și Locație în setările telefonului. iPhone: Configurări → Confidențialitate și securitate → Servicii de localizare și Safari → Locație → Permite. Reîncarcă apoi AutoCare. Permisiunea nu poate fi forțată de aplicație.</span>}
          {locationStatus === 'active' && locationAccuracy !== null && <span className="autocare-location-accuracy" title="Precizia estimată a localizării">±{locationAccuracy} m</span>}

          <button className="autocare-header-user" onClick={() => navigate('Setări')} aria-label="Deschide profilul și preferințele">
            <span className="autocare-header-avatar">{name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()}</span>
            <span className="autocare-header-identity">
              <strong>{name}</strong>
              <small>{({ founder: 'Fondator', admin: 'Administrator', assistant: 'Asistent', user: 'Utilizator' } as Record<string, string>)[data?.profile.role || 'user']}</small>
            </span>
            <ChevronDown size={16} />
          </button>
          <button
            className="autocare-header-signout autocare-signout-premium"
            type="button"
            aria-label={language === 'en' ? 'Sign out' : 'Deconectare'}
            title={language === 'en' ? 'Sign out securely' : 'Deconectare securizată'}
            onClick={async () => {
              if (previewData) return;
              if (recordDirty && !window.confirm('Ai modificări nesalvate. Vrei să te deconectezi?')) return;
              try {
                await authClient.signOut();
                window.location.assign('/autentificare');
              } catch {
                window.alert(language === 'en' ? 'Sign out failed. Please try again.' : 'Deconectarea nu a reușit. Încearcă din nou.');
              }
            }}
          >
            <LogOut size={18} /><span className="autocare-signout-label">{language === 'en' ? 'Sign out' : 'Deconectare'}</span>
          </button>
        </div>
      </header>
      <nav className="autocare-mobile-dock" aria-label="Navigare rapidă">
        {tabs.filter(([label]) => ['Dashboard','Garaj','Documente','Notificări'].includes(label)).map(([label, Icon]) => (
          <button key={label} className={tab === label ? 'active' : ''} onClick={() => navigate(label)}>
            <Icon size={20} /><span>{label === 'Dashboard' ? 'Acasă' : label === 'Documente' ? 'Acte' : label === 'Notificări' ? 'Alerte' : label}</span>
          </button>
        ))}
        <button className={!['Dashboard','Garaj','Documente','Notificări'].includes(tab) ? 'active' : ''} onClick={() => setMenuOpen(true)}><Menu size={20}/><span>Meniu</span></button>
      </nav>
      <main
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
          <div role="status" className="notice">
            {notice}
          </div>
        )}
        {!data ? (
          <div className="spinner" role="status">
            Se încarcă garajul…{error && <button onClick={refresh}>Reîncearcă</button>}
          </div>
        ) : (
          <>
            <div className="page-head between">
              <div>
                <p className="eyebrow">
                  {tab === 'Dashboard'
                    ? `Bună, ${name.split(' ')[0]} 👋`
                    : 'GARAJUL TĂU DIGITAL'}
                </p>
                <h1>
                  {tab === 'Dashboard'
                    ? 'Acasă, în garaj.'
                    : tab === 'Garaj'
                      ? 'Garajul tău'
                      : tab === 'Întreținere'
                        ? 'Întreținere și service'
                        : tab === 'Documente'
                          ? 'Documente auto'
                          : tab === 'Cheltuieli'
                            ? 'Cheltuielile garajului'
                            : tab === 'Notificări'
                              ? 'Centrul de notificări'
                              : tab === 'Calendar'
                                ? 'Calendar auto'
                                : tab === 'Abonament'
                                  ? 'Abonamentul tău'
                                  : tab === 'Setări'
                                    ? 'Profil și preferințe'
                                    : tab}
                </h1>
                <p className="muted small">
                  {tab === 'Dashboard'
                    ? 'Totul despre mașinile tale, într-un singur loc.'
                    : (
                        {
                          Garaj: 'Toate mașinile tale, într-un singur loc.',
                          Documente: 'Toate actele mașinilor tale, organizate și ușor de găsit.',
                          Întreținere:
                            'Păstrează un istoric clar și planifică următoarele intervenții.',
                          Calendar: 'Toate termenele și lucrările programate, la îndemână.',
                          Cheltuieli: 'Vezi costurile înregistrate și cum se împart în timp.',
                          Notificări: 'Documente și lucrări care au nevoie de atenția ta.',
                          Abonament: 'Planul actual, beneficiile și istoricul facturării.',
                          Setări: 'Alege cum primești mementourile și gestionează datele contului.',
                        } as Record<string, string>
                      )[tab] || 'Informațiile înregistrate de tine, organizate în siguranță.'}
                </p>
              </div>
              {['Dashboard', 'Garaj'].includes(tab) ? (
                <button className="primary" onClick={() => setModal({ kind: 'vehicle' })}>
                  <Plus size={17} />
                  Adaugă o mașină
                </button>
              ) : ['Documente', 'Întreținere', 'Cheltuieli'].includes(tab) ? (
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
                  {!activeCars.length ? 'Adaugă întâi o mașină' : tab === 'Documente' ? 'Adaugă document' : tab === 'Întreținere' ? 'Adaugă lucrare' : 'Adaugă cheltuială'}
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
            </div>
            {tab === 'Dashboard' && (
              <GarageHome
                currency={currency}
                language={language}
                data={data}
                name={name}
                navigate={navigate}
                add={(kind) => setModal({ kind })}
                open={(record) =>
                  setModal({ kind: record.kind as 'document' | 'service' | 'expense', record })
                }
              />
            )}
            {tab === 'Istoric auto' && (
              <VehicleJournal
                data={data}
                open={(record) =>
                  setModal({ kind: record.kind as 'document' | 'service' | 'expense', record })
                }
              />
            )}
            {tab === 'Garaj' && (
              <>
                <div className="ac-premium-garage-intro">
                  <div>
                    <span className="ac-premium-kicker"><CarFront size={17}/> GARAJUL MEU</span>
                    <h2>Mașinile tale, organizate într-un singur loc</h2>
                    <p>Documente, kilometraj și întreținere — informații din contul tău.</p>
                  </div>
                  <div className="ac-premium-garage-counter"><strong>{data.vehicles.filter(v => !v.archived).length}</strong><span>mașini active</span></div>
                </div>
                <div className="toolbar">
                  {data.vehicles.length > 1 && <input
                    aria-label="Caută o mașină"
                    placeholder="Caută marcă, model sau număr…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />}
                  {data.vehicles.some((v) => v.archived) && <label className="check">
                    <input
                      type="checkbox"
                      checked={showArchived}
                      onChange={(e) => setShowArchived(e.target.checked)}
                    />{' '}
                    Arată și mașinile arhivate
                  </label>}
                </div>
                {!data.vehicles.length ? (
                  <Empty
                    text="Bine ai venit în garaj! Adaugă o mașină ca să poți salva actele și reviziile ei."
                    action={() => setModal({ kind: 'vehicle' })}
                  />
                ) : (
                  <div className="grid3">
                    {data.vehicles
                      .filter(
                        (v) =>
                          (!filter || v.id === filter) &&
                          (showArchived || !v.archived) &&
                          (!query ||
                            `${v.brand} ${v.model} ${v.plate}`
                              .toLowerCase()
                              .includes(query.toLowerCase())),
                      )
                      .map((v) => (
                        <article key={v.id} className="card car-card">
                          <div className="between">
                            <span className="eyebrow">
                              {v.year} · {v.fuel}
                            </span>
                            <span className={'pill ' + (v.archived ? 'archived' : 'valid')}>
                              {v.archived ? 'Arhivată' : 'Activă'}
                            </span>
                          </div>
                          <div className="autocare-garage-card-icon" aria-hidden="true"><CarFront size={74} strokeWidth={1.15}/><span className="ac-premium-garage-visual-caption">{v.brand} {v.model}</span></div>
                          <h2>
                            {v.brand} {v.model}
                          </h2>
                          <div className="between">
                            <span className="plate">{v.plate}</span>
                            <span className="small muted">
                              {v.odometer.toLocaleString('ro-RO')} km
                            </span>
                          </div>
                          <p className="small muted" style={{ marginTop: 15 }}>
                            VIN: {v.vin || '—'}
                            <br />
                            {v.engine || 'Motorizare necompletată'}
                            {v.capacity ? ` · ${v.capacity} cm³` : ''}
                          </p>
                          <div className="car-metrics">
                            <div>
                              <span>Documente</span>
                              <strong>
                                {
                                  data.records.filter(
                                    (r) =>
                                      r.vehicleId === v.id && r.kind === 'document' && !r.cancelled,
                                  ).length
                                }{' '}
                                active
                              </strong>
                            </div>
                            <div>
                              <span>Următorul termen</span>
                              {(() => {
                                const r = data.records
                                  .filter(
                                    (r) => r.vehicleId === v.id && !r.cancelled && r.expiresAt,
                                  )
                                  .sort((a, b) =>
                                    (a.expiresAt || '').localeCompare(b.expiresAt || ''),
                                  )[0];
                                return r ? (
                                  <strong
                                    className={
                                      r.status.days != null && r.status.days <= 30
                                        ? 'deadline-warning'
                                        : ''
                                    }
                                  >
                                    {r.category} · {r.expiresAt?.split('-').reverse().join('.')}
                                  </strong>
                                ) : (
                                  <strong>De completat</strong>
                                );
                              })()}
                            </div>
                          </div>
                          {v.notes && <p className="small">{v.notes}</p>}
                          <div className="row-actions">
                            <button className="primary" onClick={() => setVehicleDetail(v.id)}>
                              Vezi mașina <ArrowUpRight size={14} />
                            </button>
                            <button
                              disabled={v.archived}
                              onClick={() => setModal({ kind: 'vehicle', vehicle: v })}
                            >
                              Editează
                            </button>
                            <button
                              onClick={() => {
                                navigate('Documente');
                                setFilter(v.id);
                              }}
                            >
                              Documente
                            </button>
                            {!v.archived && (
                              <button
                                className="danger"
                                disabled={busy}
                                onClick={() => {
                                  if (confirm('Arhivezi mașina? Alertele asociate se opresc.'))
                                    act(() => api('vehicles/' + v.id, 'DELETE'));
                                }}
                              >
                                Arhivează
                              </button>
                            )}
                          </div>
                        </article>
                      ))}
                    <button className="add-car-tile" onClick={() => setModal({ kind: 'vehicle' })}>
                      <CarFront size={36} strokeWidth={1.3} />
                      <Plus size={23} />
                      <strong>Mai ai o mașină?</strong>
                      <span>Completează datele și gestionează totul dintr-un singur loc.</span>
                      <span className="button">
                        Adaugă o mașină <Plus size={15} />
                      </span>
                    </button>
                  </div>
                )}
              </>
            )}
            {['Documente', 'Întreținere', 'Cheltuieli'].includes(tab) && (
              <>
                {tab === 'Documente' && (
                  <>
                    <div className="stats document-statistics">
                      {[
                        ['Total documente', docStats.total],
                        ['În termen', docStats.valid],
                        ['Expiră în 30 de zile', docStats.soon],
                        ['Expirate', docStats.expired],
                      ].map(([label, value]) => (
                        <section key={label} className="card stat">
                          <span className="small muted">{label}</span>
                          <div className="value">{value}</div>
                        </section>
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
                {tab === 'Întreținere' && (
                  <div className="stats maintenance-statistics ac-premium-service-stats">
                    {[
                      ['Cost înregistrat', moneyDisplay(maintenanceStats.totalBani)],
                      ['Operațiuni', maintenanceStats.count],
                      [
                        'Următoarea intervenție',
                        maintenanceStats.next?.split('-').reverse().join('.') || 'Neplanificată',
                      ],
                      [
                        'Ultimul kilometraj',
                        maintenanceStats.lastOdometer === null
                          ? 'Necompletat'
                          : maintenanceStats.lastOdometer.toLocaleString('ro-RO') + ' km',
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
                          <option value={v.id} key={v.id}>
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
                      {tab === 'Întreținere' && (
                        <select
                          aria-label="Perioada jurnalului"
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
                {tab === 'Întreținere' &&
                  visible.some(
                    (r) =>
                      r.kind === 'service' && !r.cancelled && (r.expiresAt || r.nextKm != null),
                  ) && (
                    <div className="maintenance-overview ac-premium-maintenance-overview">
                      <section className="card">
                        <p className="eyebrow">ÎNGRIJIRE LA TIMP</p>
                        <h3>Următoarele intervenții</h3>
                        {visible
                          .filter(
                            (r) =>
                              r.kind === 'service' &&
                              !r.cancelled &&
                              (r.expiresAt || r.nextKm != null),
                          )
                          .sort((a, b) =>
                            (a.expiresAt || '9999').localeCompare(b.expiresAt || '9999'),
                          )
                          .slice(0, 3)
                          .map((r) => (
                            <button
                              className="event-line"
                              key={r.id}
                              onClick={() => setModal({ kind: 'service', record: r })}
                            >
                              <span className="list-icon">
                                <Wrench size={18} />
                              </span>
                              <span className="list-grow">
                                <strong>{r.title}</strong>
                                <span className="micro">
                                  {r.expiresAt || 'Dată nestabilită'}
                                  {r.nextKm != null
                                    ? ' · ' + r.nextKm.toLocaleString('ro-RO') + ' km'
                                    : ''}
                                </span>
                              </span>
                              <ArrowUpRight size={15} />
                            </button>
                          ))}
                        {!visible.some(
                          (r) =>
                            r.kind === 'service' &&
                            !r.cancelled &&
                            (r.expiresAt || r.nextKm != null),
                        ) && (
                          <p className="small muted">
                            Programează următoarea lucrare după dată sau kilometraj, conform
                            planului mașinii tale.
                          </p>
                        )}
                      </section>
                    </div>
                  )}
                {tab === 'Cheltuieli' && (
                  <div className="grid2" style={{ marginBottom: 20 }}>
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
                          ? 'Cost/km indisponibil: sunt necesare minimum două citiri distincte.'
                          : `Cost/km estimativ: ${data.summary.costPerKm.toFixed(2)} lei (acoperire parțială a datelor)`}
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
                    <section className="card">
                      <h3>Evoluția cheltuielilor</h3>
                      {data.premium ? (
                        <ExpenseChart data={data} currency={currency} />
                      ) : (
                        <p className="muted small">
                          Graficele și analiza detaliată sunt disponibile cu Premium.
                        </p>
                      )}
                    </section>
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
                            <tr key={r.id}>
                              <td data-label="Înregistrare">
                                {tab === 'Documente' && (
                                  <span className="record-kind-mark" aria-hidden="true">
                                    <Files size={20} strokeWidth={1.6} />
                                  </span>
                                )}
                                <strong>{r.title}</strong>
                                <div className="muted small">{vehicleName(r.vehicleId)}</div>
                                <div className="micro">
                                  {r.category} {r.provider ? '· ' + r.provider : ''}
                                </div>
                                {r.notes && <p className="small">{r.notes}</p>}
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
                                          if (confirm('Ștergi definitiv atașamentul?'))
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
                                  ? r.date.split('-').reverse().join('.')
                                  : 'Dată necompletată'}
                                <div className="muted small">
                                  {r.expiresAt
                                    ? 'Expiră la ' + r.expiresAt.split('-').reverse().join('.')
                                    : 'Fără scadență'}
                                </div>
                                {r.nextKm != null && (
                                  <div className="small">Următorul prag: {r.nextKm} km</div>
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
                                    <div className="small muted">
                                      {r.odometer != null
                                        ? r.odometer.toLocaleString('ro-RO') + ' km'
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
                                    <summary aria-label={'Mai multe acțiuni pentru ' + r.title}>
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
                                              'Arhivezi această înregistrare și oprești alertele?',
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
                      <option key={v.id} value={v.id}>
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
                            <strong>{r.title}</strong>
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
            {tab === 'Plan întreținere' && <MileagePlanner data={data} preview={!!previewData} onUpdated={refresh} onError={setError} />}
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
                    <div><h3>Notificările tale</h3><p>Apasă pe o notificare pentru a o elimina din listă.</p></div>
                    <button type="button" className="autocare-notifications-settings" onClick={() => navigate('Setări')}>Preferințe</button>
                  </div>
                  {!data.notifications.length ? <Empty text="Nu ai notificări. Ești la zi!" /> : (
                    <div className="autocare-notifications-list">
                      {data.notifications.map(n => (
                        <button key={n.id} type="button" className="autocare-notification" disabled={busy}
                          onClick={() => void act(() => api('notifications/' + n.id, 'DELETE'))}
                          aria-label={`Elimină notificarea: ${n.message}`}>
                          <span className="autocare-notification-content">
                            <strong>{n.message}</strong><small>{n.localDate} · {n.channel}</small>
                          </span>
                          <span className="autocare-notification-remove">Elimină <X size={16} /></span>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}
            {tab === 'Centru de suport' && (
              <SupportChat role={data.profile.role} preview={!!previewData} />
            )}
            {tab === 'Abonament' && (
              <Membership
                language={language}
                data={data}
                invoices={invoices}
                busy={busy}
                checkout={(interval) =>
                  void act(async () => {
                    setNotice('Se pregătește plata securizată Stripe…');
                    try {
                      const out = await api('billing/checkout', 'POST', { interval });
                      if (typeof out?.url !== 'string' || !out.url.startsWith('https://checkout.stripe.com/')) {
                        throw new Error('Stripe nu a returnat un link valid pentru plată. Încearcă din nou sau contactează suportul.');
                      }
                      window.location.assign(out.url);
                    } catch (e) {
                      const reason = (e as Error).message || 'Eroare necunoscută la inițierea plății.';
                      window.alert('Plata nu a putut fi inițiată.\\n\\n' + reason);
                      throw e;
                    }
                  }, '')
                }
                portal={() =>
                  void act(async () => {
                    const out = await api('billing/portal', 'POST');
                    window.location.assign(out.url);
                  })
                }
              />
            )}
            {tab === 'Setări' && (
              <div className="grid2 settings-workspace">
                <section className="card ac-install-settings"><h3>AutoCare pe telefon</h3><p className="small muted">Instalează aplicația pe iPhone sau Samsung, fără să pierzi datele contului.</p><MobileInstall /></section>
                <section className="card">
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
                <section className="card">
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
                <section className="card support-area">
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
              </div>
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
        {vehicleDetail && data && (
          <Dialog title="Fișa mașinii" onClose={() => setVehicleDetail(null)}>
            <VehicleSheet
              data={data}
              id={vehicleDetail}
              edit={() => {
                const v = data.vehicles.find((v) => v.id === vehicleDetail);
                setVehicleDetail(null);
                if (v) setModal({ kind: 'vehicle', vehicle: v });
              }}
              open={(record) => {
                setVehicleDetail(null);
                setModal({ kind: record.kind as 'document' | 'service' | 'expense', record });
              }}
            />
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
                  <p className="eyebrow">{new Date(h.createdAt).toLocaleString('ro-RO')}</p>
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
                : modal.record
                  ? 'Editează înregistrarea'
                  : modal.kind === 'document'
                    ? 'Adaugă document'
                    : modal.kind === 'service'
                      ? 'Adaugă lucrare'
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
                      'records' + (modal.record ? '/' + modal.record.id : ''),
                      modal.record ? 'PATCH' : 'POST',
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
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </label>
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
                  <button type="button" onClick={() => setModal(null)}>
                    Renunță
                  </button>
                </div>
                <p className="micro full">Datele sunt salvate în contul tău. Documentele se pot adăuga ulterior în secțiunea Documente.</p>
              </form>
            )}
          </Dialog>
        )}
      </main>
    </div>
  );
}
function ExpenseChart({ data, currency }: { data: Data; currency: 'RON' | 'EUR' }) {
  const moneyDisplay = (bani: number): string => currency === 'EUR'
    ? new Intl.NumberFormat('en-IE', {style:'currency',currency:'EUR'}).format(bani / 500)
    : new Intl.NumberFormat('ro-RO', {style:'currency',currency:'RON'}).format(bani / 100);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const max = Math.max(1, ...data.summary.monthly.map((m) => m.bani));
  return (
    <>
      <div
        className="chart"
        role="group"
        aria-label={
          'Cheltuieli lunare în lei: ' +
          data.summary.monthly.map((m) => `${m.month}: ${m.bani / 100}`).join(', ')
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
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split('-').map(Number),
    start = (new Date(y, m - 1, 1).getDay() + 6) % 7,
    days = new Date(y, m, 0).getDate();
  return (
    <div className="calendar">
      {['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du'].map((d) => (
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
