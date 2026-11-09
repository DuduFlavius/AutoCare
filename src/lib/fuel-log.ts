const prefix = 'AutoCareFuel:';
type Fill = { liters: number; full: boolean };

export function readFuelFill(parts: string | null | undefined): Fill | null {
  const entry = parts?.split('\n').find(line => line.startsWith(prefix));
  if (!entry) return null;
  try {
    const value = JSON.parse(entry.slice(prefix.length));
    return Number.isFinite(value?.liters) && value.liters > 0 && value.liters <= 2500 && typeof value.full === 'boolean' ? value : null;
  } catch {
    return null;
  }
}

export function writeFuelFill(parts: string, fill: Fill | null) {
  const original = parts.split('\n').filter(line => !line.startsWith(prefix)).join('\n').trim();
  return [original, fill ? prefix + JSON.stringify(fill) : ''].filter(Boolean).join('\n');
}

export function fuelConsumption(records: { kind: string; category: string; cancelled: boolean; date: string | null; odometer: number | null; parts?: string | null }[]) {
  const fills = records.filter(record => !record.cancelled && record.kind === 'expense' && record.category === 'Combustibil')
    .sort((a,b) => (a.date || '').localeCompare(b.date || '') || (a.odometer ?? -1) - (b.odometer ?? -1));
  let anchor: number | null = null;
  let previous: number | null = null;
  let intervalLiters = 0;
  let distance = 0;
  let liters = 0;
  for (const record of fills) {
    const fill = readFuelFill(record.parts);
    const km = record.odometer;
    if (!fill || km === null || !record.date || (previous !== null && km < previous)) {
      anchor = null;
      previous = null;
      intervalLiters = 0;
      continue;
    }
    previous = km;
    if (anchor !== null) intervalLiters += fill.liters;
    if (!fill.full) continue;
    if (anchor !== null && km > anchor) {
      distance += km - anchor;
      liters += intervalLiters;
    }
    anchor = km;
    intervalLiters = 0;
  }
  return distance ? { litersPer100Km: liters / distance * 100, distance } : null;
}
