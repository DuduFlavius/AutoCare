'use client';
import { useMileageUsage } from './use-mileage-usage';
import { useApplicationLanguage, useApplicationLocale } from './application-locale';
import { forecastService } from '@/lib/service-forecast';
export default function OilChangeCountdown({
  vehicleId,
  currentKm,
  nextKm,
  dueDate,
  timezone,
  preview,
  onReadings,
}: {
  vehicleId: string;
  currentKm: number;
  nextKm: number | null;
  dueDate?: string | null;
  timezone: string;
  preview: boolean;
  onReadings: () => void;
}) {
  const language = useApplicationLanguage(),
    locale = useApplicationLocale(),
    en = language === 'en';
  const { confirmed, loading } = useMileageUsage(vehicleId, currentKm, preview);
  const estimate = forecastService({
    currentKm,
    nextKm,
    averageKmPerDay: confirmed?.dailyKm,
    dueDate,
    timezone,
  });
  const days = estimate?.days;
  if (loading && days !== 0)
    return (
      <span className="oil-countdown" data-workspace-ui>
        {en ? 'Calculating…' : 'Se calculează…'}
      </span>
    );
  if (days === 0)
    return (
      <span className="oil-countdown oil-countdown-due" data-workspace-ui>
        {en ? 'Oil change due' : 'Schimb scadent'}
        <small>
          {en
            ? 'Mileage or calendar deadline reached'
            : 'Prag de kilometraj sau termen calendaristic atins'}
        </small>
      </span>
    );
  if (days == null)
    return (
      <span className="oil-countdown" data-workspace-ui>
        {nextKm === null && !dueDate
          ? en
            ? 'Not scheduled'
            : 'Neconfigurat'
          : en
            ? 'Insufficient readings'
            : 'Citiri insuficiente'}
        <button type="button" onClick={onReadings}>
          {en ? 'Update mileage' : 'Actualizează kilometrajul'}
        </button>
      </span>
    );
  return (
    <span className="oil-countdown" data-workspace-ui aria-live="polite">
      ≈ {new Intl.NumberFormat(locale).format(days)}{' '}
      {en ? (days === 1 ? 'day' : 'days') : days === 1 ? 'zi' : 'zile'}
      <small>
        {days >= 60
          ? en
            ? '≈ ' +
              new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(days / 30.4375) +
              ' months · '
            : '≈ ' +
              new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(days / 30.4375) +
              ' luni · '
          : ''}
        {estimate?.estimatedDate
          ? new Date(estimate.estimatedDate + 'T12:00:00Z').toLocaleDateString(locale, {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
              timeZone: 'UTC',
            })
          : ''}
      </small>
      <small>
        {estimate?.basis === 'both'
          ? en
            ? 'Earlier mileage or calendar deadline'
            : 'Primul termen: kilometraj sau dată'
          : estimate?.basis === 'time'
            ? en
              ? 'Calendar deadline'
              : 'Termen calendaristic'
            : en
              ? 'Estimate from confirmed mileage'
              : 'Estimare din kilometrajul confirmat'}
      </small>
    </span>
  );
}
