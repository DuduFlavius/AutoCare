'use client';
import { useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Bell,
  ArrowRight,
  Plus,
  Wrench,
  Files,
  Wallet,
  Gauge,
  ShieldCheck,
  Route,
  Droplets,
  Settings2,
  CalendarDays,
  CarFront,
  SlidersHorizontal,
} from 'lucide-react';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { useMileageUsage } from '../use-mileage-usage';
import InlineMileageEditor from '../inline-mileage-editor';
import DailyMileageInput from '../daily-mileage-input';
import {
  selectActiveVehicle,
  upcomingMaintenance,
  currentHomeMaintenance,
  isOilMaintenance,
  vehicleCareScore,
} from '@/lib/application-home';
import { forecastDuration } from '@/lib/service-forecast';
import { AppEmpty, AppStatus } from './ui';
import { TitaniumWave } from '../titanium-wave';
import { calendarRecordDate, isPlannedService } from '@/lib/planned-service';
import { daysRemaining } from '@/lib/config';
import { AutoAssistant } from './auto-assistant';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
type Row = Data['records'][number];
type Props = {
  data: Data;
  name: string;
  selectedVehicle: string;
  onSelectVehicle: (id: string) => void;
  navigate: (tab: string) => void;
  onVehicle: (id: string) => void;
  onCreate: (kind: 'vehicle' | 'service' | 'document' | 'expense', vehicleId?: string) => void;
  onRecord: (record: Row) => void;
  onRefresh: () => Promise<void>;
  currency: 'RON' | 'EUR';
  preview: boolean;
};
export default function ApplicationHome({
  data,
  name,
  selectedVehicle,
  onSelectVehicle,
  navigate,
  onVehicle,
  onCreate,
  onRecord,
  onRefresh,
  currency,
  preview,
}: Props) {
  const language = useApplicationLanguage(),
    en = language === 'en',
    locale = useApplicationLocale();
  const t = (ro: string, english: string) => (en ? english : ro);
  const car = selectActiveVehicle(data.vehicles, selectedVehicle),
    cars = data.vehicles.filter((v) => !v.archived);
  const usage = useMileageUsage(car?.id ?? '', car?.odometer ?? 0, preview);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null),
    [editingEstimate, setEditingEstimate] = useState(false);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: data.profile.timezone });
  const allRows = data.records.filter((r) => !r.cancelled && r.vehicleId === car?.id);
  const rows = allRows.filter(row => !isPlannedService(row, today));
  const imminent = allRows.filter(row => isPlannedService(row, today))
    .flatMap(row => {
      const scheduled = calendarRecordDate(row, today);
      if (!scheduled) return [];
      const days = daysRemaining(scheduled, new Date(), data.profile.timezone);
      return days >= 0 && days <= 7 ? [{ row, days }] : [];
    }).sort((a, b) => a.days - b.days)[0];
  const planningRows = data.premium ? rows : rows.filter(isOilMaintenance);
  const maintenance = car
    ? upcomingMaintenance(planningRows, car.odometer, usage.dailyKm, data.profile.timezone)
    : [];
  const next = maintenance[0];
  const recordIds = new Set(rows.map(item => item.id));
  const reminders = data.notifications.filter(item => recordIds.has(item.recordId) && !item.readAt).length;
  const activity = rows.filter(item => item.date).sort((a,b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 4);
  const latest = currentHomeMaintenance(rows);
  const oil = latest.find(isOilMaintenance),
    timing = latest.find((r) => r.category === 'Distribuție');
  const docs = rows
    .filter((r) => r.kind === 'document')
    .sort((a, b) => (a.status.days ?? Infinity) - (b.status.days ?? Infinity));
  const care = vehicleCareScore(docs, maintenance);
  const attention = docs.filter((r) => r.status.days !== null && r.status.days <= 30);
  const recent = rows
    .filter((r) => r.kind === 'service')
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 4);
  const costRows = rows.filter(
    (r) => ['expense', 'service', 'document'].includes(r.kind) && r.amountKnown !== false && r.date,
  );
  const months = Array.from({ length: 6 }, (_, index) => {
    const [year, month] = today.split('-').map(Number);
    const d = new Date(Date.UTC(year, month - 6 + index, 1));
    const key = d.toISOString().slice(0, 7);
    return {
      key,
      label: d.toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' }),
      value: costRows
        .filter((r) => r.date?.slice(0, 7) === key)
        .reduce((sum, r) => sum + r.amountBani, 0),
    };
  });
  const monthlyTrip = data.monthlyTrips?.find(trip => trip.vehicleId === car?.id);
  const tripMonths = (data.annualTrips ?? []).filter(trip => trip.vehicleId === car?.id);
  const annualDistance = tripMonths.reduce((total, month) => total + month.meters, 0);
  const maxTripMonth = Math.max(1, ...tripMonths.map(month => month.meters));
  const totalCost = rows.reduce((sum, record) => sum + (record.amountKnown === false ? 0 : record.amountBani), 0);
  const monthCost = months.at(-1)?.value ?? 0,
    yearCost = costRows
      .filter((r) => r.date?.startsWith(today.slice(0, 4)))
      .reduce((sum, r) => sum + r.amountBani, 0);
  const maxCost = Math.max(1, ...months.map((m) => m.value));
  const costPoints = months.map((month, index) => [8 + index * 56, 67 - (month.value / maxCost) * 58]);
  const costLine = costPoints.map(point => point.join(',')).join(' ');
  const money = (bani: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 0 }).format(
      bani / (currency === 'EUR' ? 500 : 100),
    );
  const date = (value: string) =>
    new Date(value + 'T12:00:00Z').toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  const labels: Record<string, string> = en
    ? {
        overdue: 'Overdue',
        due: 'Due',
        soon: 'Due soon',
        valid: 'Within interval',
        unscheduled: 'Not scheduled',
      }
    : {
        overdue: 'Depășit',
        due: 'Scadent',
        soon: 'Se apropie',
        valid: 'În interval',
        unscheduled: 'Neprogramat',
      };
  const openForecast = (item: typeof next) => {
    const record = rows.find(
      (r) =>
        item.service.id === r.id ||
        item.service.id.startsWith(r.id + ':') ||
        item.service.id.startsWith(r.id + '-'),
    );
    if (record) onRecord(record);
    else navigate('Întreținere');
  };
  const progress = next?.status.progress;
  return (
    <div className="studio-home ac-cockpit-home" data-workspace-ui>
      <header className="studio-home-heading">
        <TitaniumWave />
        <div>
          <span className="studio-kicker">AUTOCARE · {t('PREZENTARE GENERALĂ', 'OVERVIEW')}</span>
          <h1 id="workspace-page-title" tabIndex={-1}>
            {t('Bună, ', 'Hello, ')}<span data-user-content>{name.trim().split(/\s+/)[0]}</span>
          </h1>
          <p>
            {t(
              'Aici găsești termenele, kilometrajul și cheltuielile.',
              'Review deadlines, mileage and expenses.',
            )}
          </p>
        </div>
        <div className="studio-heading-actions">
          <button type="button" className="primary" onClick={() => onCreate('vehicle')}>
            <Plus size={19} />
            {t('Adaugă mașină', 'Add vehicle')}
          </button>
          <button type="button" onClick={() => navigate('Plan întreținere')}>
            <Route size={18} />
            SmartDrive
          </button>
        </div>
      </header>
      {!car ? (
        <AppEmpty
          Icon={CarFront}
          title={t('Adaugă prima mașină', 'Add your first vehicle')}
          description={t(
            'Adaugă mașina pentru a organiza documentele, întreținerea și cheltuielile.',
            'Add a vehicle to organize documents, maintenance and costs.',
          )}
          action={t('Adaugă prima mașină', 'Add your first vehicle')}
          onAction={() => onCreate('vehicle')}
        />
      ) : (
        <>
          <div className="ac-cockpit-lead">
            <section className="ac-readiness-panel" aria-labelledby="ac-readiness-title">
              <TitaniumWave />
              <h2 id="ac-readiness-title">{t('Starea vehiculului', 'Vehicle status')}</h2>
              <div className="ac-care-content">
              <div className="ac-readiness-value">
                <div className="ac-care-ring" style={{ '--ac-care-score': (care.percent ?? 0) + '%' } as CSSProperties}>
                  <strong>{care.percent === null ? '—' : care.percent + '%'}</strong>
                </div>
                <span>{care.percent === null
                  ? t('Adaugă termene pentru a vedea scorul.', 'Add deadlines to see your score.')
                  : `${care.valid} / ${care.total} ${t('termene în regulă', 'deadlines in good standing')}`}</span>
              </div>
                <div className="ac-care-metrics">
                  {[
                    { Icon: Gauge, label: t('Kilometraj actual', 'Current mileage'), value: car.odometer.toLocaleString(locale) + ' km', tab: 'Kilometraj' },
                    { Icon: Wallet, label: t('Cheltuieli lunare', 'Monthly expenses'), value: money(monthCost), tab: 'Cheltuieli' },
                    { Icon: Route, label: t('Distanță GPS lunară', 'Monthly GPS distance'), value: monthlyTrip ? (monthlyTrip.meters / 1000).toLocaleString(locale, { maximumFractionDigits: 1 }) + ' km' : '—', tab: 'Plan întreținere' },
                    { Icon: Wrench, label: t('Ultima intervenție', 'Last service'), value: recent[0]?.date ? date(recent[0].date) : '—', tab: 'Întreținere' },
                  ].map(({ Icon, label, value, tab }) => (
                    <button type="button" key={label} onClick={() => navigate(tab)}>
                      <Icon size={18} aria-hidden="true" /><span>{label}<strong>{value}</strong></span>
                    </button>
                  ))}
                </div>
              </div>
              <p>{t('Scor din scadențele documentelor și intervalele de service înregistrate.', 'Score from recorded document deadlines and maintenance intervals.')}</p>
              <div className="ac-readiness-actions">
                <button type="button" onClick={() => navigate('Întreținere')}><Wrench size={16}/>{t('Întreținere', 'Maintenance')}<ArrowUpRight size={14}/></button>
                <button type="button" onClick={() => navigate('Notificări')}><Bell size={16}/>{t('Notificări', 'Notifications')}{reminders > 0 && <span>{reminders}</span>}<ArrowUpRight size={14}/></button>
              </div>
            </section>
          <div className="ac-titanium-action-deck">
            <section className="ac-titanium-reminder" aria-labelledby="ac-next-reminder">
              <TitaniumWave />
              <div className="ac-assistant-icon"><CalendarDays size={22} aria-hidden="true" /></div>
              <div>
                <h2 id="ac-next-reminder">{t('Următorul termen', 'Next deadline')}</h2>
                {attention[0] ? (
                  <>
                    <p><strong data-user-content>{attention[0].title}</strong> · {attention[0].status.label}</p>
                    <button type="button" className="studio-text-button" onClick={() => onRecord(attention[0])}>{t('Vezi documentul', 'View document')} <ArrowUpRight size={14}/></button>
                  </>
                ) : imminent ? (
                  <>
                    <p><strong data-user-content>{imminent.row.title}</strong> · {imminent.days === 0 ? t('Astăzi', 'Today') : imminent.days + ' ' + t('zile', 'days')}</p>
                    <button type="button" className="studio-text-button" onClick={() => navigate('Calendar')}>{t('Vezi calendarul', 'View calendar')} <ArrowUpRight size={14} /></button>
                  </>
                ) : next ? (
                  <>
                    <p><strong data-user-content>{next.service.title}</strong> · {labels[next.status.state]}</p>
                    <button type="button" className="studio-text-button" onClick={() => openForecast(next)}>{t('Vezi mentenanța', 'View maintenance')} <ArrowUpRight size={14}/></button>
                  </>
                ) : (
                  <>
                    <p>{t('Adaugă un document sau planifică o lucrare.', 'Add a document or schedule a service.')}</p>
                    <button type="button" className="studio-text-button" onClick={() => onCreate('document', car.id)}>{t('Adaugă document', 'Add document')} <ArrowUpRight size={14}/></button>
                  </>
                )}
              </div>
            </section>
            <AutoAssistant key={car.id} vehicleId={car.id} preview={preview} available={!preview && data.autoAssistantAvailable} premium={data.premium} en={en} onPremium={() => navigate('Premium')} onOpen={() => navigate('AutoCare AI')} />
          </div>
          </div>
          <div className="ac-cockpit-data">
            <section className="studio-panel studio-costs studio-telemetry-chart">
              <div className="studio-panel-head">
                <h2>{t('Costuri și evoluție', 'Costs & trends')}</h2>
                <button className="studio-text-button" onClick={() => navigate('Cheltuieli')}>
                  <ArrowUpRight size={18} />
                  <span className="sr-only">{t('Deschide cheltuielile', 'Open expenses')}</span>
                </button>
              </div>
              <div className="studio-cost-total">
                <strong>
                  {money(
                    selectedMonth
                      ? (months.find((m) => m.key === selectedMonth)?.value ?? 0)
                      : yearCost,
                  )}
                </strong>
                <span>
                  {selectedMonth ||
                    t('Anul curent · mașina selectată', 'Current year · selected vehicle')}
                </span>
              </div>
              {costRows.length ? (
                <div
                  className="studio-mini-chart"
                  role="group"
                  aria-label={t(
                    'Cheltuieli pe ultimele șase luni',
                    'Expenses over the last six months',
                  )}
                >
                  <svg viewBox="0 0 296 76" preserveAspectRatio="none" aria-hidden="true" className="ac-cost-line">
                    <path d="M0 20h296M0 40h296M0 60h296" className="ac-cost-gridlines" />
                    <polygon points={'8,76 ' + costLine + ' 288,76'} />
                    <polyline points={costLine} />
                    {costPoints.map(([x, y], index) => <circle key={x} cx={x} cy={y} r={selectedMonth === months[index].key ? 4 : 2.6} />)}
                  </svg>
                  {months.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setSelectedMonth((v) => (v === m.key ? null : m.key))}
                      aria-label={m.key + ': ' + money(m.value)}
                      aria-pressed={selectedMonth === m.key}
                      title={m.key + ': ' + money(m.value)}
                    >
                      <small>{m.label}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="studio-chart-empty">
                  {t(
                    'Graficul apare când înregistrezi primele costuri.',
                    'Your chart appears when you record your first costs.',
                  )}
                </p>
              )}
              {currency === 'EUR' && (
                <p className="studio-caption">
                  {t(
                    'Conversie orientativă: 1 EUR = 5 RON.',
                    'Indicative conversion: EUR 1 = RON 5.',
                  )}
                </p>
              )}
            </section>
            <section className="studio-panel ac-annual-drive">
              <div className="studio-panel-head">
                <h2>{t('Distanță GPS anuală', 'Annual GPS distance')}</h2>
                <button type="button" className="studio-text-button" onClick={() => navigate('Plan întreținere')}>SmartDrive <ArrowUpRight size={15}/></button>
              </div>
              {tripMonths.length ? (
                <>
                  <div className="studio-cost-total">
                    <strong>{(annualDistance / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km</strong>
                    <span>{today.slice(0, 4)} · {t('trasee salvate', 'saved trips')}</span>
                  </div>
                  <ul className="ac-drive-bars" aria-label={t('Distanță lunară GPS', 'Monthly GPS distance')}>
                    {Array.from({ length: Number(today.slice(5, 7)) }, (_, month) => {
                      const key = today.slice(0, 4) + '-' + String(month + 1).padStart(2, '0');
                      const meters = tripMonths.find(trip => trip.month === key)?.meters ?? 0;
                      const label = new Date(Date.UTC(2020, month, 1)).toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' });
                      const distance = (meters / 1000).toLocaleString(locale, { maximumFractionDigits: 1 }) + ' km';
                      return <li key={key} title={label + ' · ' + distance}>
                        <span className="sr-only">{label} · {distance}</span>
                        <span className="ac-drive-track" aria-hidden="true"><i style={{ height: (meters / maxTripMonth * 100) + '%' }} /></span>
                        <small aria-hidden="true">{label.slice(0, 3)}</small>
                      </li>;
                    })}
                  </ul>
                </>
              ) : <p className="studio-chart-empty">{t('Distanța apare după ce salvezi prima călătorie GPS.', 'Distance appears after your first saved GPS trip.')}</p>}
            </section>
            <section className="studio-panel studio-documents">
              <div className="studio-panel-head">
                <h2>{t('Documente și scadențe', 'Documents & deadlines')}</h2>
                <button
                  className="studio-text-button"
                  onClick={() => onCreate('document', car.id)}
                  aria-label={t('Adaugă document', 'Add document')}
                >
                  <Plus size={20} />
                </button>
              </div>
              {docs.length ? (
                <div className="studio-document-list">
                  {docs.slice(0, 4).map((r) => (
                    <button type="button" key={r.id} onClick={() => onRecord(r)}>
                      <Files size={20} />
                      <span>
                        <strong>{r.category}</strong>
                        <small>
                          {r.expiresAt
                            ? date(r.expiresAt)
                            : t('Fără dată de expirare', 'No expiry date')}
                        </small>
                      </span>
                      <AppStatus
                        state={
                          r.status.days == null
                            ? 'unscheduled'
                            : r.status.days < 0
                              ? 'overdue'
                              : r.status.days <= 30
                                ? 'soon'
                                : 'valid'
                        }
                      >
                        {r.status.days == null
                          ? '—'
                          : r.status.days < 0
                            ? t('Expirat', 'Expired')
                            : r.status.days + ' ' + t('zile', 'days')}
                      </AppStatus>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="studio-empty-inline">
                  <Files size={25} />
                  <p>
                    {t(
                      'Adaugă RCA, ITP și celelalte acte.',
                      'Add insurance, inspection and your other documents.',
                    )}
                  </p>
                  <button onClick={() => onCreate('document', car.id)}>
                    {t('Adaugă document', 'Add document')}
                  </button>
                </div>
              )}
              <button className="studio-text-button" onClick={() => navigate('Documente')}>
                {t('Deschide dosarul', 'Open document folder')}
                <ArrowRight size={17} />
              </button>
            </section>
            <section className="studio-priority">
              <div className="studio-panel-head">
                <h2>
                  <Wrench size={19} />
                  {t('Următoarea revizie', 'Next maintenance')}
                </h2>
                {next && (
                  <AppStatus state={next.status.state}>{labels[next.status.state]}</AppStatus>
                )}
              </div>
              {next ? (
                <>
                  <div className="studio-priority-main">
                    <div
                      className="studio-progress-ring"
                      style={
                        {
                          '--progress': Math.max(0, Math.min(100, progress ?? 0)) + '%',
                        } as CSSProperties
                      }
                      role={progress == null ? undefined : 'img'}
                      aria-label={
                        progress == null
                          ? undefined
                          : t('Interval parcurs: ', 'Interval used: ') + Math.round(progress) + '%'
                      }
                    >
                      <span>
                        <Wrench size={27} />
                      </span>
                    </div>
                    <div>
                      <h3 data-user-content>{next.service.title}</h3>
                      <p>
                        {next.service.nextKm != null
                          ? next.service.nextKm.toLocaleString(locale) + ' km'
                          : t('Termen calendaristic', 'Calendar deadline')}
                        {next.raw ? ' · ' + date(next.raw) : ''}
                      </p>
                    </div>
                  </div>
                  <div className="studio-deadline-metrics">
                    <div>
                      <strong>
                        {next.status.remainingKm != null
                          ? Math.abs(next.status.remainingKm).toLocaleString(locale)
                          : '—'}
                        {next.status.remainingKm != null && <small> km</small>}
                      </strong>
                      <span>
                        {next.status.remainingKm != null
                          ? next.status.remainingKm < 0
                            ? t('peste prag', 'overdue')
                            : t('rămași până la revizie', 'remaining to service')
                          : t('Prag km neconfigurat', 'Mileage interval not set')}
                      </span>
                    </div>
                    <div>
                      <strong>
                        {next.estimate?.days != null ? next.estimate.days : '—'}
                        {next.estimate?.days != null && <small> {t('zile', 'days')}</small>}
                      </strong>
                      <span>
                        {next.estimate?.days != null
                          ? t('estimare din datele disponibile', 'estimate from available data')
                          : t(
                              'Date insuficiente pentru estimare',
                              'More data needed for an estimate',
                            )}
                      </span>
                    </div>
                  </div>
                  <div className="studio-panel-footer">
                    <button
                      type="button"
                      className="studio-text-button"
                      onClick={() => openForecast(next)}
                    >
                      {t('Vezi intervenția', 'View maintenance')}
                      <ArrowRight size={17} />
                    </button>
                    <button
                      type="button"
                      className="studio-text-button"
                      aria-expanded={editingEstimate}
                      onClick={() => setEditingEstimate((v) => !v)}
                    >
                      <SlidersHorizontal size={16} />
                      {t('Estimare', 'Estimate')}
                    </button>
                  </div>
                  {editingEstimate && <DailyMileageInput usage={usage} />}
                </>
              ) : (
                <div className="studio-priority-empty">
                  <CalendarDays size={28} />
                  <h3>{t('Nicio revizie programată', 'No maintenance scheduled')}</h3>
                  <p>
                    {t(
                      'Configurează un interval pentru a vedea kilometrii și zilele rămase.',
                      'Set an interval to see remaining mileage and days.',
                    )}
                  </p>
                  <button type="button" onClick={() => onCreate('service', car.id)}>
                    <Plus size={18} />
                    {t('Configurează revizia', 'Set up maintenance')}
                  </button>
                </div>
              )}
            </section>
          </div>
          <div className="ac-cockpit-bottom">
            <section className="studio-vehicle-panel ac-vehicle-instrument" aria-labelledby="ac-instrument-title">
              <TitaniumWave />
              <div className="ac-instrument-heading">
                <div className="studio-vehicle-identity">
                  <span className="studio-kicker">{t('MAȘINA SELECTATĂ', 'SELECTED VEHICLE')}</span>
                  <h2 id="ac-instrument-title" data-user-content>{car.brand} {car.model}</h2>
                  <div className="ac-instrument-identity">
                    <span>{car.year} · <span data-user-content>{car.fuel}</span></span>
                    <span className="studio-plate" data-user-content>{car.plate}</span>
                  </div>
                  {cars.length > 1 && (
                    <select aria-label={t('Mașina selectată', 'Selected vehicle')} value={car.id} onChange={e => onSelectVehicle(e.target.value)}>
                      {cars.map(v => <option value={v.id} key={v.id}>{v.brand} {v.model} · {v.plate}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div className="ac-instrument-footer">
                <div className="studio-mileage">
                  <span>{t('Cost total înregistrat', 'Total recorded costs')}</span>
                  <strong>{money(totalCost)}</strong>
                  <InlineMileageEditor key={car.id} vehicleId={car.id} currentKm={car.odometer} preview={preview} onSaved={onRefresh}/>
                </div>
                <button type="button" className="ac-instrument-details" onClick={() => onVehicle(car.id)}>
                  {t('Fișa mașinii', 'Vehicle profile')} <ArrowUpRight size={16} aria-hidden="true"/>
                </button>
              </div>
            </section>
          <section className="studio-panel ac-cockpit-quick">
            <h2>{t('Funcții rapide', 'Quick actions')}</h2>
            <div>
              {[
                { Icon: Route, label: 'SmartDrive GPS', action: () => navigate('Plan întreținere') },
                { Icon: Wrench, label: t('Adaugă intervenție', 'Add service'), action: () => onCreate('service', car.id) },
                { Icon: Wallet, label: t('Adaugă cheltuială', 'Add expense'), action: () => onCreate('expense', car.id) },
                { Icon: Files, label: t('Adaugă document', 'Add document'), action: () => onCreate('document', car.id) },
                { Icon: CalendarDays, label: t('Raport anual', 'Annual report'), action: () => navigate('Rapoarte') },
              ].map(({ Icon, label, action }) => <button type="button" key={label} onClick={action}><Icon size={19} /><span>{label}</span></button>)}
            </div>
          </section>
            <section className="studio-panel ac-activity-panel">
              <div className="studio-panel-head"><h2>{t('Activitate recentă', 'Recent activity')}</h2><button type="button" className="studio-text-button" onClick={() => navigate('Istoric auto')}>{t('Istoric', 'History')}<ArrowUpRight size={16}/></button></div>
              {activity.length ? <ul>{activity.map(item => {
                const Icon = item.kind === 'expense' ? Wallet : item.kind === 'document' ? Files : Wrench;
                return <li key={item.id}><button type="button" onClick={() => onRecord(item)}><Icon size={18}/><span><strong data-user-content>{item.title}</strong><small>{item.date && date(item.date)}</small></span><ArrowUpRight size={15}/></button></li>;
              })}</ul> : <p>{t('Documentele, cheltuielile și intervențiile vor apărea aici după ce le înregistrezi.', 'Documents, expenses and maintenance appear here after you record them.')}</p>}
            </section>
          </div>
          <div className="studio-status-row">
            {[
              {
                Icon: Droplets,
                title: t('Schimb de ulei', 'Oil change'),
                record: oil,
                allowed: true,
              },
              {
                Icon: Settings2,
                title: t('Distribuție', 'Timing service'),
                record: timing,
                allowed: data.premium,
              },
            ].map((item) => {
              const forecast =
                item.record && item.allowed
                  ? upcomingMaintenance(
                      [item.record],
                      car.odometer,
                      usage.dailyKm,
                      data.profile.timezone,
                    )[0]
                  : null;
              return (
                <button
                  key={item.title}
                  type="button"
                  className="studio-maintenance-tile"
                  onClick={() =>
                    item.record ? onRecord(item.record) : onCreate('service', car.id)
                  }
                >
                  <span className="studio-tile-icon">
                    <item.Icon size={23} />
                  </span>
                  <span>
                    <span className="studio-tile-label">{item.title}</span>
                    <strong>
                      {forecast?.status.remainingKm != null
                        ? Math.abs(forecast.status.remainingKm).toLocaleString(locale) + ' km'
                        : item.record
                          ? t('Înregistrat', 'Recorded')
                          : t('De completat', 'Add service')}
                    </strong>
                    <small>
                      {forecast?.estimate?.days != null
                        ? forecastDuration(forecast.estimate.days, language)
                        : item.record?.date
                          ? date(item.record.date)
                          : t('Adaugă ultima intervenție', 'Add the last service')}
                    </small>
                  </span>
                  <ArrowUpRight size={17} />
                </button>
              );
            })}
            <button
              type="button"
              className={
                'studio-maintenance-tile ' + (attention.length ? 'studio-tile-warning' : '')
              }
              onClick={() => navigate('Documente')}
            >
              <span className="studio-tile-icon">
                <ShieldCheck size={23} />
              </span>
              <span>
                <span className="studio-tile-label">
                  {t('Documente în atenție', 'Documents to review')}
                </span>
                <strong>
                  {attention.length}{' '}
                  {attention.length === 1 ? t('document', 'document') : t('documente', 'documents')}
                </strong>
                <small>
                  {t('Expirate sau în următoarele 30 zile', 'Expired or due within 30 days')}
                </small>
              </span>
              <ArrowUpRight size={17} />
            </button>
            <button
              type="button"
              className="studio-maintenance-tile"
              onClick={() => navigate('Cheltuieli')}
            >
              <span className="studio-tile-icon">
                <Wallet size={23} />
              </span>
              <span>
                <span className="studio-tile-label">
                  {t('Cheltuieli luna aceasta', 'Costs this month')}
                </span>
                <strong>{money(monthCost)}</strong>
                <small>{t('Doar costurile înregistrate', 'Recorded costs only')}</small>
              </span>
              <ArrowUpRight size={17} />
            </button>
          </div>
            <section className="studio-panel studio-recent">
              <div className="studio-panel-head">
                <h2>{t('Ultimele intervenții', 'Recent maintenance')}</h2>
                <button className="studio-text-button" onClick={() => navigate('Întreținere')}>
                  {t('Toate', 'View all')}
                  <ArrowUpRight size={17} />
                </button>
              </div>
              {recent.length ? (
                <div className="studio-service-list">
                  {recent.map((r) => (
                    <button type="button" key={r.id} onClick={() => onRecord(r)}>
                      <span className="studio-row-icon">
                        <Wrench size={19} />
                      </span>
                      <span>
                        <strong data-user-content>{r.title || r.category}</strong>
                        <small>
                          {r.date ? date(r.date) : t('Dată necompletată', 'No date recorded')}
                          {r.odometer != null
                            ? ' · ' + r.odometer.toLocaleString(locale) + ' km'
                            : ''}
                        </small>
                      </span>
                      <span className="studio-row-cost">
                        {r.amountKnown !== false ? money(r.amountBani) : '—'}
                        <ArrowUpRight size={16} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="studio-empty-inline">
                  <Wrench size={26} />
                  <p>
                    {t(
                      'Istoricul apare după prima intervenție.',
                      'Your history starts with the first service.',
                    )}
                  </p>
                  <button onClick={() => onCreate('service', car.id)}>
                    {t('Adaugă intervenție', 'Add maintenance')}
                  </button>
                </div>
              )}
            </section>
        </>
      )}
    </div>
  );
}
