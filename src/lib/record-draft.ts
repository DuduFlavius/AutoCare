import { serializeServiceDetails } from './service-details';
import { recordInput } from './validation';
export type RecordPayload = {
  kind: 'document' | 'service' | 'expense';
  vehicleId: string;
  category: string;
  title: string;
  date: string | null;
  expiresAt: string | null;
  nextKm: number | null;
  odometer: number | null;
  amountBani: number;
  amountKnown: boolean;
  provider: string;
  number: string;
  parts: string;
  notes: string;
};
export function prepareRecordDraft(
  f: FormData,
  options: {
    kind: 'document' | 'service' | 'expense';
    category: string;
    car: string;
    serviceKmInterval: string;
    costEdited: boolean;
    unknownCost: boolean;
    existingParts?: string;
    file?: Pick<File, 'size' | 'type'> | null;
  },
): RecordPayload {
  const { kind, category, car, serviceKmInterval, costEdited, unknownCost, existingParts, file } =
    options;
  const str = (k: string) => String(f.get(k) || '').trim();
  const num = (k: string) => (str(k) === '' ? null : Number(str(k)));
  const oilInterval =
    Number(serviceKmInterval) > 0 ? Number(serviceKmInterval) : Number(str('ac_intervalUlei'));
  const computedNextKm =
    kind === 'service' &&
    category === 'Schimb ulei' &&
    num('nextKm') === null &&
    num('odometer') !== null &&
    Number.isFinite(oilInterval) &&
    oilInterval > 0
      ? Number(num('odometer')) + oilInterval
      : num('nextKm');
  const categoryDate =
    category === 'ITP'
      ? str('ac_expirareITP')
      : category === 'Frâne'
        ? str('ac_verificareFrane')
        : category === 'Baterie'
          ? str('ac_verificareBaterie')
          : category === 'Distribuție'
            ? str('ac_urmatoareaDataDistributie')
            : str('ac_urmatoareaVerificare');
  const computedExpiry =
    kind === 'service' && !str('expiresAt') && categoryDate ? categoryDate : str('expiresAt');
  const partsTotal = ['ac_costPiese', 'ac_costLabor', 'ac_costOther'].reduce(
    (sum, k) => sum + (num(k) || 0),
    0,
  );
  const finalAmount = kind === 'service' && costEdited ? partsTotal : (num('amount') ?? 0);
  const hasCost =
    kind === 'service' && costEdited
      ? ['ac_costPiese', 'ac_costLabor', 'ac_costOther'].some((k) => str(k) !== '')
      : str('amount') !== '';
  const filterCost = ['Filtre', 'Schimb ulei'].includes(category)
    ? Array.from(f.entries())
        .filter(([key]) => /^ac_filtru\d+Cost$/.test(key))
        .reduce((total, [, value]) => total + (Number(value) || 0), 0)
    : 0;
  // Filter line-item prices are informational when a total or parts breakdown is supplied: never add them twice.
  const effectiveTotal =
    kind === 'service' && !hasCost && filterCost > 0 ? filterCost : finalAmount;
  const effectiveKnown = hasCost || (kind === 'service' && filterCost > 0);
  if (
    kind === 'service' &&
    ['Filtre', 'Schimb ulei'].includes(category) &&
    costEdited &&
    filterCost > 0 &&
    str('ac_costPiese') === '' &&
    Math.abs(partsTotal - filterCost) > 0.01
  ) {
    throw new Error('Introdu suma filtrelor la costul pieselor, pentru a păstra corect totalul.');
  }
  if (unknownCost && (hasCost || filterCost > 0)) {
    throw new Error('Pentru cost necunoscut, șterge mai întâi sumele introduse.');
  }
  if (
    kind === 'service' &&
    ['Filtre', 'Schimb ulei'].includes(category) &&
    costEdited &&
    filterCost > 0 &&
    str('ac_costPiese') !== '' &&
    Number(str('ac_costPiese')) + 0.01 < filterCost
  ) {
    throw new Error('Costul pieselor nu poate fi mai mic decât suma filtrelor introduse.');
  }
  if (
    !unknownCost &&
    (!Number.isFinite(effectiveTotal) || effectiveTotal < 0 || effectiveTotal > 1000000)
  ) {
    throw new Error('Costul trebuie să fie între 0 și 1.000.000 RON.');
  }
  if (
    num('odometer') !== null &&
    (!Number.isInteger(num('odometer')) || Number(num('odometer')) < 0)
  ) {
    throw new Error('Kilometrajul trebuie să fie un număr întreg pozitiv.');
  }
  if (
    computedNextKm !== null &&
    num('odometer') !== null &&
    computedNextKm < Number(num('odometer'))
  ) {
    throw new Error('Următorul kilometraj nu poate fi mai mic decât kilometrajul intervenției.');
  }
  if (!car) {
    throw new Error('Alege mașina căreia îi aparține înregistrarea.');
  }
  if (str('date') && computedExpiry && computedExpiry < str('date')) {
    throw new Error('Data expirării nu poate fi înaintea datei emiterii sau intervenției.');
  }
  if (
    file &&
    (file.size > 2097152 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type))
  ) {
    throw new Error('Atașează un PDF, JPEG sau PNG de maximum 2 MB.');
  }

  const payload: RecordPayload = {
    kind,
    vehicleId: car,
    category,
    title: str('title') || category,
    date: str('date') || null,
    expiresAt: computedExpiry || null,
    nextKm: computedNextKm,
    odometer: num('odometer'),
    amountBani: unknownCost ? 0 : Math.round(effectiveTotal * 100),
    amountKnown: !unknownCost && effectiveKnown,
    provider: str('provider'),
    number: str('number'),
    parts:
      kind === 'service'
        ? serializeServiceDetails(f.has('parts') ? str('parts') : existingParts || '', f)
        : str('parts'),
    notes: str('notes'),
  };
  if (['Alt document', 'Altă operațiune', 'Altele'].includes(category) && !str('title'))
    throw new Error('Completează denumirea înregistrării.');
  if (kind !== 'document' && !str('date')) throw new Error('Completează data înregistrării.');
  if (!recordInput.safeParse(payload).success)
    throw new Error('Verifică datele, kilometrajul și sumele introduse.');
  return payload;
}
