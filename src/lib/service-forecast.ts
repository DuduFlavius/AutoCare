export type ServiceForecast = { remainingKm: number; days: number | null; estimatedDate: string | null; basis: 'odometer' | 'time' | 'both' };
export function forecastService(input: { currentKm: number; nextKm: number; averageKmPerDay?: number | null; dueDate?: string | null; today?: Date }): ServiceForecast | null {
 const { currentKm, nextKm, averageKmPerDay, dueDate, today = new Date() } = input;
 if (![currentKm,nextKm].every(Number.isFinite) || currentKm < 0 || nextKm < 0) return null;
 const remainingKm = Math.max(0, Math.round(nextKm-currentKm));
 const rate = averageKmPerDay != null && Number.isFinite(averageKmPerDay) && averageKmPerDay > 0 ? averageKmPerDay : null;
 const kmDays = remainingKm === 0 ? 0 : rate ? Math.ceil(remainingKm/rate) : null;
 const dateDays = dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && !Number.isNaN(Date.parse(dueDate)) ? Math.max(0,Math.ceil((Date.parse(dueDate+'T00:00:00Z')-Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()))/86400000)) : null;
 const days = kmDays == null ? dateDays : dateDays == null ? kmDays : Math.min(kmDays,dateDays);
 const estimatedDate = days == null ? null : new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),today.getUTCDate()+days)).toISOString().slice(0,10);
 return { remainingKm, days, estimatedDate, basis: kmDays != null && dateDays != null ? 'both' : kmDays != null ? 'odometer' : 'time' };
}
