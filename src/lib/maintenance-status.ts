import { daysRemaining } from './config';
export function maintenanceStatus(input: {
  currentKm: number;
  nextKm: number | null;
  lastKm?: number | null;
  dueDate?: string | null;
  lastDate?: string | null;
  today?: Date;
  timezone?: string;
}) {
  const {
    currentKm,
    nextKm,
    lastKm,
    dueDate,
    lastDate,
    today = new Date(),
    timezone = 'Europe/Bucharest',
  } = input;
  const valid = (date: string | undefined | null) =>
    !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + 'T00:00:00Z'));
  const remainingKm = nextKm === null ? null : nextKm - currentKm;
  const calendarDays = valid(dueDate) ? daysRemaining(dueDate!, today, timezone) : null;
  const state =
    (remainingKm !== null && remainingKm < 0) || (calendarDays !== null && calendarDays < 0)
      ? 'overdue'
      : remainingKm === 0 || calendarDays === 0
        ? 'due'
        : (remainingKm !== null && remainingKm <= 1000) ||
            (calendarDays !== null && calendarDays <= 30)
          ? 'soon'
          : remainingKm !== null || calendarDays !== null
            ? 'valid'
            : 'unscheduled';
  let progress: number | null = null,
    progressBasis: 'km' | 'time' | null = null;
  if (lastKm != null && nextKm !== null && nextKm > lastKm) {
    progress = ((currentKm - lastKm) / (nextKm - lastKm)) * 100;
    progressBasis = 'km';
  } else if (valid(lastDate) && valid(dueDate) && dueDate! > lastDate!) {
    const span = (Date.parse(dueDate!) - Date.parse(lastDate!)) / 86400000;
    progress = ((span - calendarDays!) / span) * 100;
    progressBasis = 'time';
  }
  return {
    remainingKm,
    calendarDays,
    state,
    progress: progress === null ? null : Math.min(100, Math.max(0, Math.round(progress))),
    progressBasis,
  };
}
