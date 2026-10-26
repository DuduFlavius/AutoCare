export type OdometerReading = { odometer: number; recordedAt: string };
export function mileageMetrics(readings: readonly OdometerReading[]) {
  if (readings.length < 2) return { deltaKm: null, dailyKm: null, monthlyKm: null };
  const sorted = [...readings].sort((a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt));
  const first = sorted[0], last = sorted[sorted.length - 1];
  const elapsedDays = (Date.parse(last.recordedAt) - Date.parse(first.recordedAt)) / 86400000;
  if (!Number.isFinite(elapsedDays) || elapsedDays < 1 || !Number.isInteger(first.odometer) || !Number.isInteger(last.odometer) || last.odometer < first.odometer)
    return { deltaKm: null, dailyKm: null, monthlyKm: null };
  const deltaKm = last.odometer - first.odometer;
  const dailyKm = deltaKm / elapsedDays;
  return { deltaKm, dailyKm, monthlyKm: dailyKm * 30 };
}
