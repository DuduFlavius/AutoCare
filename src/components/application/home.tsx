'use client';
import {
  CarFront,
  ShieldCheck,
  Gauge,
  Plus,
  Wrench,
  FileText,
  Wallet,
  ArrowRight,
  CalendarClock,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { useMileageUsage } from '../use-mileage-usage';
import DailyMileageInput from '../daily-mileage-input';
import InlineMileageEditor from '../inline-mileage-editor';
import VehicleVisual from './vehicle-visual';
import MaintenanceHighlights from './maintenance-highlights';
import { selectActiveVehicle, upcomingMaintenance, isOilMaintenance } from '@/lib/application-home';
import { forecastDuration } from '@/lib/service-forecast';
import { AppEmpty, AppSection, AppStatus } from './ui';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
type RecordItem = Data['records'][number];
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
}: {
  data: Data;
  name: string;
  selectedVehicle: string;
  onSelectVehicle: (id: string) => void;
  navigate: (tab: string) => void;
  onVehicle: (id: string) => void;
  onCreate: (kind: 'vehicle' | 'service' | 'document' | 'expense', vehicleId?: string) => void;
  onRecord: (record: RecordItem) => void;
  onRefresh: () => Promise<void>;
  currency: 'RON' | 'EUR';
  preview: boolean;
}) {
  const language = useApplicationLanguage(),
    en = language === 'en',
    locale = useApplicationLocale();
  const t = (ro: string, english: string) => (en ? english : ro);
  const car = selectActiveVehicle(data.vehicles, selectedVehicle);
  const cars = data.vehicles.filter((v) => !v.archived);
  const usage = useMileageUsage(car?.id ?? '', car?.odometer ?? 0, preview);
  const rows = data.records.filter((r) => r.vehicleId === car?.id && !r.cancelled);
  const planningRows = data.premium ? rows : rows.filter(isOilMaintenance);
  const upcoming = car
    ? upcomingMaintenance(planningRows, car.odometer, usage.dailyKm, data.profile.timezone)
    : [];
  const next = upcoming[0];
  const documents = rows
    .filter((r) => r.kind === 'document' && r.status.days !== null && r.status.days <= 30)
    .sort((a, b) => a.status.days! - b.status.days!);
  const recent = rows
    .filter((r) => r.kind === 'service')
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
    .slice(0, 3);
  const today = new Date().toLocaleDateString('en-CA', { timeZone: data.profile.timezone });
  const costs = rows
    .filter(
      (r) =>
        ['expense', 'service'].includes(r.kind) &&
        r.amountKnown !== false &&
        r.date?.slice(0, 7) === today.slice(0, 7),
    )
    .reduce((sum, r) => sum + r.amountBani, 0);
  const money = (bani: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
      bani / (currency === 'EUR' ? 500 : 100),
    );
  const date = (raw: string) =>
    new Date(raw + 'T12:00:00Z').toLocaleDateString(locale, {
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
        overdue: 'Întârziat',
        due: 'Scadent',
        soon: 'Se apropie',
        valid: 'În regulă',
        unscheduled: 'Neprogramat',
      };
  labels.overdue = t('Întârziat', 'Overdue');
  return (
    <div className="app-home" data-workspace-ui>
      <div className="app-home-welcome">
        <div>
          <span className="app-editorial-eyebrow">
            AUTOCARE · {t('GARAJUL TĂU DIGITAL', 'YOUR DIGITAL GARAGE')}
          </span>
          <p>
            {t('Bună', 'Hello')}, <span data-user-content>{name.split(' ')[0]}</span>
          </p>
          <h1 id="workspace-page-title" tabIndex={-1}>
            {t('Mașina ta, sub control.', 'Your car, under control.')}
          </h1>
        </div>
        <ShieldCheck size={26} />
      </div>
      {!car ? (
        <AppEmpty
          Icon={CarFront}
          title={t('Începe cu prima ta mașină.', 'Start with your first car.')}
          description={t(
            'Documentele, reviziile și cheltuielile ei vor fi organizate aici.',
            'Its documents, maintenance and costs will be organized here.',
          )}
          action={t('Adaugă prima mașină', 'Add your first car')}
          onAction={() => onCreate('vehicle')}
        />
      ) : (
        <>
          {cars.length > 1 && (
            <label className="app-vehicle-picker">
              <CarFront size={18} />
              <span className="sr-only">{t('Mașina activă', 'Active vehicle')}</span>
              <select
                aria-label={t('Mașina activă', 'Active vehicle')}
                value={car.id}
                onChange={(e) => onSelectVehicle(e.target.value)}
              >
                {cars.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.brand} {v.model} · {v.plate}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </label>
          )}
          <div className="app-home-primary">
            <section className="app-vehicle-hero">
              <VehicleVisual />
              <div className="app-vehicle-content">
                <div className="app-vehicle-top">
                  <span>{t('MAȘINA ACTIVĂ', 'ACTIVE VEHICLE')}</span>
                  <ShieldCheck size={38} />
                </div>
                <button className="app-vehicle-title" onClick={() => onVehicle(car.id)}>
                  <h2 data-user-content>
                    {car.brand} {car.model}
                  </h2>
                  <ArrowRight size={22} />
                </button>
                <p data-user-content>
                  {car.year} · {car.fuel}
                </p>
                <span className="app-plate" data-user-content>
                  {car.plate}
                </span>
                <div className="app-vehicle-distance">
                  <Gauge size={20} />
                  <div>
                    <small>{t('Kilometraj confirmat', 'Confirmed mileage')}</small>
                    <strong>
                      {car.odometer.toLocaleString(locale)} <span>km</span>
                    </strong>
                  </div>
                </div>
                <InlineMileageEditor
                  key={car.id}
                  vehicleId={car.id}
                  currentKm={car.odometer}
                  preview={preview}
                  onSaved={onRefresh}
                />
                <button
                  type="button"
                  className="app-vehicle-details"
                  onClick={() => onVehicle(car.id)}
                >
                  {t('Deschide garajul', 'Open garage')}
                  <ArrowRight size={16} />
                </button>
              </div>
            </section>
            <AppSection
              title={t('Următoarea lucrare', 'Next maintenance')}
              action={t('Planul complet', 'Full schedule')}
              onAction={() => navigate('Întreținere')}
              className="app-next-maintenance"
            >
              {next ? (
                <>
                  <div className="app-maintenance-heading">
                    <span className="app-icon">
                      <Wrench size={21} />
                    </span>
                    <AppStatus state={next.status.state}>{labels[next.status.state]}</AppStatus>
                  </div>
                  <h3 data-user-content>{next.service.title}</h3>
                  <div className="app-maintenance-metrics">
                    <div>
                      <strong>{forecastDuration(next.estimate?.days ?? null, language)}</strong>
                      <small>{t('Termen estimat', 'Estimated timing')}</small>
                    </div>
                    {next.status.remainingKm !== null && (
                      <div>
                        <strong>
                          {Math.abs(next.status.remainingKm).toLocaleString(locale)} km
                        </strong>
                        <small>
                          {next.status.remainingKm < 0
                            ? t('peste prag', 'over the limit')
                            : t('până la prag', 'to the limit')}
                        </small>
                      </div>
                    )}
                  </div>
                  {next.status.progress !== null && (
                    <progress
                      max={100}
                      value={next.status.progress}
                      aria-label={t('Interval parcurs', 'Interval used')}
                    />
                  )}
                  <p className="app-caption">
                    <CalendarClock size={15} />
                    {next.estimate?.estimatedDate
                      ? date(next.estimate.estimatedDate)
                      : t(
                          'Completează media zilnică pentru estimarea datei.',
                          'Set your daily average to estimate a date.',
                        )}
                    {next.service.nextKm !== null
                      ? ` · ${next.service.nextKm.toLocaleString(locale)} km`
                      : ''}
                  </p>
                  {next.raw && (
                    <p className="app-caption">
                      {t('Limită calendaristică: ', 'Calendar limit: ')}
                      {date(next.raw)}
                    </p>
                  )}
                  <DailyMileageInput key={car.id} usage={usage} />
                  <p className="app-caption">
                    {t(
                      'Se aplică primul prag atins: timp sau kilometraj. Estimarea folosește kilometrajul confirmat și media zilnică.',
                      'Whichever comes first: time or mileage. Estimates use confirmed mileage and daily usage.',
                    )}
                  </p>
                  <button
                    className="app-text-action"
                    onClick={() => {
                      const source = rows.find(
                        (r) =>
                          next.service.id === r.id ||
                          next.service.id.startsWith(r.id + ':') ||
                          next.service.id.startsWith(r.id + '-'),
                      );
                      if (source) onRecord(source);
                      else navigate('Întreținere');
                    }}
                  >
                    {t('Vezi intervenția', 'View maintenance')}
                    <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <div className="app-quiet-empty">
                  <Wrench size={24} />
                  <h3>{t('Nicio lucrare programată', 'No maintenance scheduled')}</h3>
                  <p>
                    {t(
                      'Adaugă o intervenție și configurează intervalul de timp sau kilometraj.',
                      'Add maintenance and set a time or mileage interval.',
                    )}
                  </p>
                  <button onClick={() => onCreate('service', car.id)}>
                    <Plus size={16} />
                    {t('Adaugă intervenție', 'Add maintenance')}
                  </button>
                </div>
              )}
            </AppSection>
          </div>
          <MaintenanceHighlights
            rows={rows}
            currentKm={car.odometer}
            dailyKm={usage.dailyKm}
            timezone={data.profile.timezone}
            premium={data.premium}
            onRecord={onRecord}
            onCreate={() => onCreate('service', car.id)}
          />
          <AppSection
            className="app-home-documents"
            title={t('Documente în atenție', 'Documents to review')}
            action={t('Toate documentele', 'All documents')}
            onAction={() => navigate('Documente')}
          >
            {documents.length ? (
              <div className="app-document-list">
                {documents.slice(0, 3).map((r) => (
                  <button className="app-record-row" key={r.id} onClick={() => onRecord(r)}>
                    <span className="app-icon">
                      <FileText size={20} />
                    </span>
                    <span>
                      <strong data-user-content>{r.category}</strong>
                      <small>{r.expiresAt ? date(r.expiresAt) : ''}</small>
                    </span>
                    <AppStatus state={r.status.days! < 0 ? 'overdue' : 'soon'}>
                      {r.status.days! < 0
                        ? t('Expirat', 'Expired')
                        : r.status.days === 0
                          ? t('Astăzi', 'Today')
                          : `${r.status.days} ${t('zile', 'days')}`}
                    </AppStatus>
                  </button>
                ))}
              </div>
            ) : (
              <div className="app-inline-empty">
                <Check size={18} />
                <p>
                  {t(
                    'Niciun document care expiră în următoarele 30 de zile.',
                    'No documents expiring in the next 30 days.',
                  )}
                </p>
                <button className="app-text-action" onClick={() => onCreate('document', car.id)}>
                  {t('Adaugă', 'Add')}
                  <Plus size={15} />
                </button>
              </div>
            )}
          </AppSection>
          <AppSection className="app-home-actions" title={t('Adaugă rapid', 'Quick add')}>
            <div className="app-quick-actions">
              {(
                [
                  { kind: 'service', Icon: Wrench, ro: 'Intervenție', en: 'Maintenance' },
                  { kind: 'document', Icon: FileText, ro: 'Document', en: 'Document' },
                  { kind: 'expense', Icon: Wallet, ro: 'Cheltuială', en: 'Expense' },
                ] as const
              ).map((a) => (
                <button key={a.kind} onClick={() => onCreate(a.kind, car.id)}>
                  <a.Icon size={21} />
                  <span>{a[language]}</span>
                  <Plus size={15} />
                </button>
              ))}
            </div>
          </AppSection>
          <div className="app-home-secondary">
            <AppSection
              title={t('Luna aceasta', 'This month')}
              action={t('Cheltuieli', 'Expenses')}
              onAction={() => navigate('Cheltuieli')}
            >
              <div className="app-month-cost">
                <Wallet size={23} />
                <strong>{money(costs)}</strong>
              </div>
              <p className="app-caption">
                {t(
                  'Costuri înregistrate pentru mașina selectată.',
                  'Recorded costs for the selected vehicle.',
                )}
                {currency === 'EUR'
                  ? t(
                      ' Conversie orientativă: 1 EUR = 5 RON.',
                      ' Indicative conversion: 1 EUR = 5 RON.',
                    )
                  : ''}
              </p>
            </AppSection>
            <AppSection
              title={t('Ultimele intervenții', 'Recent maintenance')}
              action={t('Istoric', 'History')}
              onAction={() => navigate('Istoric auto')}
            >
              {recent.length ? (
                recent.map((r) => (
                  <button key={r.id} className="app-record-row" onClick={() => onRecord(r)}>
                    <Wrench size={18} />
                    <span>
                      <strong data-user-content>{r.title || r.category}</strong>
                      <small>
                        {r.date ? date(r.date) : t('Dată necompletată', 'No date recorded')}
                      </small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                ))
              ) : (
                <p className="app-caption">
                  {t(
                    'Istoricul va apărea aici după prima intervenție.',
                    'Your history will appear after the first maintenance entry.',
                  )}
                </p>
              )}
            </AppSection>
          </div>
          {upcoming.length > 1 && (
            <details className="app-upcoming">
              <summary>
                {t('Următoarele lucrări', 'Upcoming maintenance')}{' '}
                <span>{upcoming.length - 1}</span>
              </summary>
              {upcoming.slice(1, 5).map(({ service, estimate, status }) => (
                <div key={service.id} className="app-record-row">
                  <Wrench size={18} />
                  <span>
                    <strong data-user-content>{service.title}</strong>
                    <small>{forecastDuration(estimate?.days ?? null, language)}</small>
                  </span>
                  <AppStatus state={status.state}>{labels[status.state]}</AppStatus>
                </div>
              ))}
              <button onClick={() => navigate('Întreținere')}>
                {t('Vezi planul complet', 'View full schedule')}
              </button>
            </details>
          )}
        </>
      )}
    </div>
  );
}
