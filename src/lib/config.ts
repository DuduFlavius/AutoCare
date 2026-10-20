export const appName = process.env.NEXT_PUBLIC_APP_NAME || 'AutoCare';
export function origin() {
  return process.env.APP_URL || 'http://localhost:3000';
}
export const offsets = [30, 14, 7, 6, 5, 4, 3, 2, 1, 0];
export function isPremium(
  s: { status: string; periodEnd: Date | null } | undefined,
  now = new Date(),
) {
  return !!s && ['active'].includes(s.status) && !!s.periodEnd && s.periodEnd > now;
}
export function localDate(now: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
export function daysRemaining(date: string, now: Date, timezone = 'Europe/Bucharest') {
  return Math.round(
    (Date.parse(date + 'T00:00:00Z') - Date.parse(localDate(now, timezone) + 'T00:00:00Z')) /
      86400000,
  );
}
export function documentStatus(date: string | null, now = new Date(), tz = 'Europe/Bucharest') {
  if (!date) return { label: 'Date incomplete', state: 'incomplete', days: null };
  const days = daysRemaining(date, now, tz);
  return {
    label: days < 0 ? 'Expirat' : days <= 30 ? 'Expiră în curând' : 'Valabil',
    state: days < 0 ? 'expired' : days <= 30 ? 'soon' : 'valid',
    days,
  };
}
