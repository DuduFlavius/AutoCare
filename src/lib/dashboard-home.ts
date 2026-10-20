import { localDate } from './config';
import type { dashboard } from './service';
type Data = Awaited<ReturnType<typeof dashboard>>;
export function dashboardHome(data: Data, now = new Date()) {
  const cars = data.vehicles.filter((v) => !v.archived),
    ids = new Set(cars.map((v) => v.id));
  const records = data.records.filter((r) => !r.cancelled && ids.has(r.vehicleId));
  const month = localDate(now, data.profile.timezone).slice(0, 7);
  const expenses = records.filter(
    (r) => ['expense', 'service'].includes(r.kind) && r.date?.startsWith(month),
  );
  const documents = records.filter((r) => r.kind === 'document');
  const upcoming = records
    .filter(
      (r) =>
        ['document', 'service'].includes(r.kind) &&
        r.expiresAt &&
        r.status.days !== null &&
        r.status.days >= 0,
    )
    .sort((a, b) => a.expiresAt!.localeCompare(b.expiresAt!));
  const attention = records
    .filter(
      (r) =>
        ['document', 'service'].includes(r.kind) &&
        ((r.status.days !== null && r.status.days <= 30) ||
          (r.nextKm !== null && cars.some((v) => v.id === r.vehicleId && v.odometer >= r.nextKm!))),
    )
    .sort((a, b) => (a.expiresAt || '9999').localeCompare(b.expiresAt || '9999'));
  return {
    cars,
    records,
    documents,
    upcoming,
    attention,
    services: records.filter((r) => r.kind === 'service'),
    monthBani: expenses
      .filter((r) => r.amountKnown !== false)
      .reduce((sum, r) => sum + r.amountBani, 0),
    expenseCount: expenses.length,
    unknownCosts: expenses.filter((r) => r.amountKnown === false).length,
    documentAttention: documents.filter((r) => r.status.days !== null && r.status.days <= 30)
      .length,
    validDocuments: documents.filter((r) => r.status.state === 'valid').length,
  };
}
