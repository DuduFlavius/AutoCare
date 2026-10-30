import { parseServiceDetails } from './service-details';
export function operationAlerts(parts: string | null) {
  const data = parseServiceDetails(parts || '');
  const list = (value: string | undefined, max: number) =>
    value === undefined
      ? null
      : value.trim() === '' || value === 'none'
        ? []
        : value
            .split(',')
            .map((x) => Number(x.trim()))
            .filter((n, i, a) => Number.isInteger(n) && n >= 0 && n <= max && a.indexOf(n) === i)
            .sort((a, b) => b - a);
  return { days: list(data.alertDays, 365), kilometers: list(data.alertKm, 100000) };
}
export function reminderOffsets(input: {
  parts: string | null;
  paid: boolean;
  defaults: number[];
  days: number | null;
  nextKm: number | null;
  odometer: number;
  afterExpiry: boolean;
}) {
  const { parts, paid, defaults, days, nextKm, odometer, afterExpiry } = input;
  if (parseServiceDetails(parts || '').completedBy) return [];
  const configured = operationAlerts(parts);
  const selected = paid
    ? (configured.days ?? defaults)
    : defaults.filter((n) => [30, 7, 1, 0].includes(n));
  const due: string[] = [];
  if (days !== null && selected.includes(days)) due.push(String(days));
  if (days !== null && days < 0 && paid && afterExpiry) due.push('overdue');
  if (paid && nextKm !== null) {
    const left = nextKm - odometer;
    if (left <= 0) due.push('km');
    else {
      const nearest = (configured.kilometers || [])
        .filter((km) => km > 0 && left <= km)
        .sort((a, b) => a - b)[0];
      if (nearest !== undefined) due.push('km-before-' + nearest);
    }
  }
  return due;
}
export function alertOffsetAllowed(
  offset: string,
  parts: string | null,
  paid: boolean,
  defaults: number[],
  afterExpiry: boolean,
) {
  const configured = operationAlerts(parts);
  if (offset === 'km') return paid;
  if (offset === 'overdue') return paid && afterExpiry;
  if (/^km-before-\d+$/.test(offset))
    return paid && !!configured.kilometers?.includes(Number(offset.slice(10)));
  return (
    paid ? (configured.days ?? defaults) : defaults.filter((n) => [30, 7, 1, 0].includes(n))
  ).includes(Number(offset));
}
