'use client';
import { useApplicationLanguage, useApplicationLocale } from './application-locale';
import DailyMileageInput from './daily-mileage-input';
import { rankMaintenanceForecasts } from '@/lib/maintenance-schedule';
import { CalendarClock, TrendingUp } from 'lucide-react';
import { useMileageUsage } from './use-mileage-usage';
import { forecastDuration } from '@/lib/service-forecast';
type Due = {
  id: string;
  title: string;
  nextKm: number | null;
  lastKm?: number | null;
  lastDate?: string | null;
  expiresAt?: string | Date | null;
};
export default function ServiceForecastCards({
  vehicleId,
  currentKm,
  services,
  preview,
  timezone = 'Europe/Bucharest',
  onUpdateMileage,
}: {
  vehicleId: string;
  currentKm: number;
  services: Due[];
  preview: boolean;
  timezone?: string;
  onUpdateMileage?: () => void;
}) {
  const language = useApplicationLanguage(),
    locale = useApplicationLocale(),
    en = language === 'en';
  const usage = useMileageUsage(vehicleId, currentKm, preview);
  const { confirmed, loading, lastReadingAt, dailyKm, manualDailyKm } = usage;
  if (!services.length) return null;
  return (
    <section
      className="ac-forecast-list"
      data-workspace-ui
      aria-label={en ? 'Maintenance estimates' : 'Estimări revizii'}
    >
      <header>
        <CalendarClock size={20} />
        <div>
          <h4>{en ? 'When is the next service due?' : 'Când urmează întreținerea?'}</h4>
          <p>
            {en
              ? 'The earlier of your mileage threshold and calendar deadline.'
              : 'Primul termen atins: kilometrajul sau data calendaristică.'}
          </p>
        </div>
      </header>
      <div className="forecast-reading-stamp">
        <p>
          {en ? 'Confirmed odometer: ' : 'Kilometraj confirmat: '}
          {new Intl.NumberFormat(locale).format(currentKm)} km
          <br />
          {lastReadingAt
            ? (en ? 'Latest reading: ' : 'Ultima citire: ') +
              new Date(lastReadingAt).toLocaleString(locale, { timeZone: timezone })
            : en
              ? 'No dated reading available. Update the odometer for a current estimate.'
              : 'Nu există o citire datată disponibilă. Actualizează kilometrajul pentru o estimare curentă.'}
        </p>
        {onUpdateMileage && (
          <button type="button" onClick={onUpdateMileage}>
            {en ? 'Update mileage' : 'Actualizează kilometrajul'}
          </button>
        )}
      </div>
      <DailyMileageInput key={vehicleId} usage={usage} />
      {rankMaintenanceForecasts(services, currentKm, dailyKm, timezone).map(
        ({ service, estimate, status, raw }) => {
          if (!estimate) return null;
          const { remainingKm: kmLeft, calendarDays, progress } = status;
          const overdue = status.state === 'overdue',
            due = status.state === 'due';
          const soon =
            status.state === 'soon' ||
            (estimate.days !== null && estimate.days > 0 && estimate.days <= 30);
          const state = overdue
            ? en
              ? 'Overdue'
              : 'Depășit'
            : due
              ? en
                ? 'Due'
                : 'Scadent'
              : soon
                ? en
                  ? 'Due soon'
                  : 'Se apropie'
                : en
                  ? 'Within interval'
                  : 'În termen';
          return (
            <article className="forecast-service-card" key={service.id}>
              <strong data-user-content>
                {service.title || (en ? 'Scheduled maintenance' : 'Revizie programată')}
              </strong>
              <span
                className={
                  'forecast-maintenance-state ' +
                  (overdue || due ? 'is-due' : soon ? 'is-soon' : 'is-valid')
                }
              >
                {state}
              </span>
              <div className="forecast-result">
                <span>
                  {loading && manualDailyKm === null
                    ? en
                      ? 'Updating estimate…'
                      : 'Se actualizează estimarea…'
                    : forecastDuration(estimate.days, language)}
                </span>
                {estimate.remainingKm !== null && (
                  <small>
                    {new Intl.NumberFormat(locale).format(estimate.remainingKm)}{' '}
                    {en ? 'km remaining' : 'km rămași'}
                  </small>
                )}
              </div>
              <div className="forecast-thresholds">
                {calendarDays !== null && (
                  <small>
                    {en ? 'Calendar limit: ' : 'Limită de timp: '}
                    {Math.abs(calendarDays)} {en ? 'days' : 'zile'}
                    {calendarDays < 0
                      ? en
                        ? ' overdue'
                        : ' depășite'
                      : en
                        ? ' remaining'
                        : ' rămase'}{' '}
                    · {raw}
                  </small>
                )}
                {service.nextKm !== null && (
                  <small>
                    {en ? 'Mileage limit: ' : 'Prag kilometraj: '}
                    {new Intl.NumberFormat(locale).format(service.nextKm)} km
                    {kmLeft !== null && kmLeft < 0
                      ? ' · ' +
                        new Intl.NumberFormat(locale).format(Math.abs(kmLeft)) +
                        (en ? ' km overdue' : ' km depășiți')
                      : ''}
                  </small>
                )}
                {progress !== null && (
                  <label>
                    {status.progressBasis === 'time'
                      ? en
                        ? 'Time interval used'
                        : 'Interval de timp parcurs'
                      : en
                        ? 'Mileage interval used'
                        : 'Interval parcurs'}{' '}
                    · {progress}%
                    <progress max={100} value={progress} />
                  </label>
                )}
              </div>
              {estimate.estimatedDate && (
                <p>
                  {en ? 'Estimated date: ' : 'Dată estimată: '}
                  {new Date(estimate.estimatedDate + 'T12:00:00Z').toLocaleDateString(locale, {
                    timeZone: 'UTC',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              )}
              <small>
                {estimate.days === null
                  ? en
                    ? 'No reliable date yet.'
                    : 'Data nu poate fi estimată încă.'
                  : estimate.basis === 'both'
                    ? en
                      ? 'Based on the earlier mileage or calendar deadline.'
                      : 'Se ia în calcul termenul care apare primul: kilometraj sau dată.'
                    : estimate.basis === 'time'
                      ? en
                        ? 'Based on the saved calendar deadline.'
                        : 'Pe baza datei calendaristice salvate.'
                      : en
                        ? 'Based on confirmed mileage and daily usage.'
                        : 'Pe baza kilometrilor confirmați și a utilizării zilnice.'}
              </small>
            </article>
          );
        },
      )}
      <p className="forecast-source">
        <TrendingUp size={14} />
        {manualDailyKm !== null
          ? en
            ? `Using your saved average: ${manualDailyKm} km/day, for all maintenance on this vehicle.`
            : `Se folosește media salvată de tine: ${manualDailyKm} km/zi, pentru toată întreținerea acestei mașini.`
          : confirmed?.dailyKm != null
            ? en
              ? `Based on ${confirmed.samples} readings over ${Math.round(confirmed.sampleDays)} days.`
              : `Pe baza a ${confirmed.samples} citiri, pe ${Math.round(confirmed.sampleDays)} zile.`
            : en
              ? 'Two consistent readings at least a day apart are needed. You can enter your own daily average.'
              : 'Sunt necesare două citiri coerente, la cel puțin o zi distanță. Poți introduce propria medie zilnică.'}
      </p>
      <p className="micro">
        {en
          ? 'Approximate planning only. Follow the manufacturer’s schedule and any calendar deadline. GPS never changes your odometer.'
          : 'Estimare pentru planificare. Respectă recomandările producătorului și termenul calendaristic. GPS-ul nu modifică kilometrajul de bord.'}
      </p>
    </section>
  );
}
