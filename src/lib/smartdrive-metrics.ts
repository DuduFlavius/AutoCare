export type OdometerReading = { odometer: number; recordedAt: string };
const DAY = 86400000;
export function recentMileageUsage(readings: readonly OdometerReading[], asOf?: Date) {
  const blank = {
    dailyKm: null as number | null,
    deltaKm: null as number | null,
    sampleDays: 0,
    samples: 0,
    confidence: 'unavailable' as 'unavailable' | 'limited' | 'good' | 'stale',
  };
  const sorted = readings
    .filter(
      (r) =>
        Number.isSafeInteger(r.odometer) &&
        r.odometer >= 0 &&
        Number.isFinite(Date.parse(r.recordedAt)),
    )
    .sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  if (sorted.length < 2) return blank;
  const last = sorted[sorted.length - 1],
    lastTime = Date.parse(last.recordedAt);
  if (asOf && (asOf.getTime() - lastTime) / DAY > 90)
    return { ...blank, confidence: 'stale' as const };
  // Use the last 90 days, retaining one boundary sample when readings are sparse.
  const cutoff = lastTime - 90 * DAY;
  let start = sorted.findIndex((r) => Date.parse(r.recordedAt) >= cutoff);
  if (start < 0) start = 0;
  if (start > 0 && (lastTime - Date.parse(sorted[start - 1].recordedAt)) / DAY <= 180) start--;
  const rows = sorted.slice(start);
  const first = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const days = (Date.parse(rows[i].recordedAt) - Date.parse(rows[i - 1].recordedAt)) / DAY;
    const delta = rows[i].odometer - rows[i - 1].odometer;
    if (delta < 0 || (days === 0 && delta !== 0) || (days > 0 && delta / Math.max(1, days) > 2000))
      return blank;
  }
  const sampleDays = (lastTime - Date.parse(first.recordedAt)) / DAY;
  if (sampleDays < 1) return blank;
  const deltaKm = last.odometer - first.odometer;
  return {
    dailyKm: deltaKm / sampleDays,
    deltaKm,
    sampleDays,
    samples: rows.length,
    confidence: rows.length >= 4 && sampleDays >= 14 ? ('good' as const) : ('limited' as const),
  };
}
export function mileageMetrics(readings: readonly OdometerReading[]) {
  const m = recentMileageUsage(readings);
  return {
    deltaKm: m.deltaKm,
    dailyKm: m.dailyKm,
    monthlyKm: m.dailyKm === null ? null : m.dailyKm * 30,
  };
}
