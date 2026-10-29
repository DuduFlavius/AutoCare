'use client';
import { useApplicationLanguage, useApplicationLocale } from './application-locale';
import { useEffect, useState } from 'react';
import { CalendarClock, TrendingUp } from 'lucide-react';
import { recentMileageUsage, type OdometerReading } from '@/lib/smartdrive-metrics';
import { forecastService, forecastDuration } from '@/lib/service-forecast';
type Due = { id: string; title: string; nextKm: number | null; expiresAt?: string | Date | null };
export default function ServiceForecastCards({
  vehicleId,
  currentKm,
  services,
  preview,
  timezone = 'Europe/Bucharest',
}: {
  vehicleId: string;
  currentKm: number;
  services: Due[];
  preview: boolean;
  timezone?: string;
}) {
  const language = useApplicationLanguage(),
    locale = useApplicationLocale(),
    en = language === 'en';
  const key = vehicleId + ':' + currentKm;
  const [usage, setUsage] = useState<{
    key: string;
    value: ReturnType<typeof recentMileageUsage>;
  } | null>(null);
  const [settled, setSettled] = useState('');
  const [manual, setManual] = useState({ vehicleId, value: '' });
  useEffect(() => {
    if (preview) {
      setSettled(key);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    fetch('/api/v1/smartdrive/vehicles/' + encodeURIComponent(vehicleId) + '/readings', {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw Error('Readings unavailable');
        return r.json() as Promise<OdometerReading[]>;
      })
      .then((rows) => {
        if (!cancelled) setUsage({ key, value: recentMileageUsage(rows, new Date()) });
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      })
      .finally(() => {
        clearTimeout(timer);
        if (!cancelled) setSettled(key);
      });
    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [key, vehicleId, preview]);
  const value = manual.vehicleId === vehicleId ? manual.value : '';
  const parsed = Number(value.replace(',', '.'));
  const invalid = value !== '' && (!Number.isFinite(parsed) || parsed <= 0 || parsed > 2000);
  const confirmed = usage?.key === key ? usage.value : null;
  const dailyKm = value !== '' && !invalid ? parsed : (confirmed?.dailyKm ?? null);
  const loading = !preview && settled !== key;
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
      <label className="forecast-daily-input">
        {en
          ? 'Typical kilometers per day · optional'
          : 'Kilometri parcurși într-o zi obișnuită · opțional'}
        <input
          type="number"
          min="1"
          max="2000"
          value={value}
          onChange={(e) => setManual({ vehicleId, value: e.target.value })}
          aria-invalid={invalid || undefined}
          placeholder={confirmed?.dailyKm ? Math.round(confirmed.dailyKm).toString() : '40'}
        />
      </label>
      {invalid && (
        <p role="alert">
          {en
            ? 'Enter a daily average between 1 and 2,000 km.'
            : 'Introdu o medie zilnică între 1 și 2.000 km.'}
        </p>
      )}
      {services.map((service) => {
        const raw =
          service.expiresAt instanceof Date
            ? service.expiresAt.toISOString().slice(0, 10)
            : service.expiresAt;
        const estimate = forecastService({
          currentKm,
          nextKm: service.nextKm,
          averageKmPerDay: invalid ? null : dailyKm,
          dueDate: raw,
          timezone,
        });
        if (!estimate) return null;
        return (
          <article className="forecast-service-card" key={service.id}>
            <strong data-user-content>
              {service.title || (en ? 'Scheduled maintenance' : 'Revizie programată')}
            </strong>
            <div className="forecast-result">
              <span>
                {loading && value === ''
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
      })}
      <p className="forecast-source">
        <TrendingUp size={14} />
        {value !== '' && !invalid
          ? en
            ? 'Using your daily average.'
            : 'Se folosește media introdusă de tine.'
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
