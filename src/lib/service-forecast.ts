export type ServiceForecast = {
  remainingKm: number | null;
  days: number | null;
  estimatedDate: string | null;
  basis: 'odometer' | 'time' | 'both';
};
const DAY = 86400000;
function day(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const t = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value ? t : null;
}
export function forecastService(input: {
  currentKm: number;
  nextKm: number | null;
  averageKmPerDay?: number | null;
  dueDate?: string | null;
  today?: Date;
  timezone?: string;
}): ServiceForecast | null {
  const {
    currentKm,
    nextKm,
    averageKmPerDay,
    dueDate,
    today = new Date(),
    timezone = 'UTC',
  } = input;
  if (
    !Number.isFinite(currentKm) ||
    currentKm < 0 ||
    (nextKm !== null && (!Number.isFinite(nextKm) || nextKm < 0)) ||
    !Number.isFinite(today.getTime())
  )
    return null;
  let todayText: string;
  try {
    todayText = today.toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    return null;
  }
  const todayDay = day(todayText);
  if (todayDay === null) return null;
  const remainingKm = nextKm === null ? null : Math.max(0, Math.round(nextKm - currentKm));
  const rate =
    averageKmPerDay != null &&
    Number.isFinite(averageKmPerDay) &&
    averageKmPerDay > 0 &&
    averageKmPerDay <= 2000
      ? averageKmPerDay
      : null;
  const kmDays =
    remainingKm === 0 ? 0 : remainingKm !== null && rate ? Math.ceil(remainingKm / rate) : null;
  const due = dueDate ? day(dueDate) : null;
  const dateDays = due === null ? null : Math.max(0, Math.ceil((due - todayDay) / DAY));
  const days = kmDays === null ? dateDays : dateDays === null ? kmDays : Math.min(kmDays, dateDays);
  const timestamp = days === null ? null : todayDay + days * DAY;
  const estimatedDate =
    timestamp === null || !Number.isFinite(timestamp) || Math.abs(timestamp) > 8640000000000000
      ? null
      : new Date(timestamp).toISOString().slice(0, 10);
  return {
    remainingKm,
    days,
    estimatedDate,
    basis: kmDays !== null && dateDays !== null ? 'both' : kmDays !== null ? 'odometer' : 'time',
  };
}
export function forecastDuration(days: number | null, language: 'ro' | 'en') {
  if (days === null)
    return language === 'en' ? 'More readings needed' : 'Sunt necesare mai multe citiri';
  if (days === 0) return language === 'en' ? 'Maintenance due' : 'Revizie scadentă';
  const locale = language === 'en' ? 'en-GB' : 'ro-RO';
  if (days >= 60) {
    const months = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
      days / 30.4375,
    );
    return language === 'en'
      ? `≈ ${months} months · ${days} days`
      : `≈ ${months} luni · ${days} zile`;
  }
  return language === 'en'
    ? `≈ ${days} ${days === 1 ? 'day' : 'days'}`
    : `≈ ${days} ${days === 1 ? 'zi' : 'zile'}`;
}
