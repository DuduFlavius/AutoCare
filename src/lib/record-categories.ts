export type RecordKind = 'document' | 'service' | 'expense';
export type RecordCategory = {
  value: string;
  ro: string;
  en: string;
  description: string;
  descriptionEn: string;
  icon: string;
  group?: string;
};
const c = (
  value: string,
  ro: string,
  en: string,
  description: string,
  descriptionEn: string,
  icon: string,
  group?: string,
): RecordCategory => ({ value, ro, en, description, descriptionEn, icon, group });
export const serviceCategories: RecordCategory[] = [
  c(
    'Revizie generală',
    'Revizie generală',
    'General service',
    'Verificări periodice și consumabile.',
    'Routine checks and consumables.',
    'clipboard',
    'periodic',
  ),
  c(
    'Schimb ulei',
    'Schimb ulei și filtre',
    'Oil & filter change',
    'Ulei, filtre, costuri și următorul schimb.',
    'Oil, filters, costs and next replacement.',
    'oil',
    'periodic',
  ),
  c(
    'Filtre',
    'Filtre',
    'Filters',
    'Ulei, aer, combustibil și habitaclu.',
    'Oil, air, fuel and cabin filters.',
    'filter',
    'periodic',
  ),
  c(
    'Frâne',
    'Frâne',
    'Brakes',
    'Plăcuțe, discuri și lichid de frână.',
    'Pads, discs and brake fluid.',
    'disc',
    'safety',
  ),
  c(
    'Anvelope',
    'Anvelope și roți',
    'Tires & wheels',
    'Schimb sezonier, montaj și echilibrare.',
    'Seasonal changes, fitting and balancing.',
    'wheel',
    'safety',
  ),
  c(
    'Baterie',
    'Baterie',
    'Battery',
    'Înlocuire, testare și garanție.',
    'Replacement, testing and warranty.',
    'battery',
    'systems',
  ),
  c(
    'Distribuție',
    'Distribuție',
    'Timing system',
    'Curea sau lanț, interval și piese.',
    'Belt or chain, interval and parts.',
    'settings',
    'systems',
  ),
  c(
    'Reparație',
    'Reparații',
    'Repairs',
    'Problemă, diagnostic și piese schimbate.',
    'Symptoms, diagnosis and replaced parts.',
    'wrench',
    'systems',
  ),
  c(
    'Motor',
    'Motor',
    'Engine',
    'Diagnostic, componente și lucrarea efectuată.',
    'Diagnosis, components and work performed.',
    'engine',
    'systems',
  ),
  c(
    'Cutie de viteze și transmisie',
    'Cutie de viteze și transmisie',
    'Gearbox & transmission',
    'Ulei, cutie de viteze și transmisie.',
    'Fluid, gearbox and drivetrain.',
    'settings',
    'systems',
  ),
  c(
    'Suspensie și direcție',
    'Suspensie și direcție',
    'Suspension & steering',
    'Amortizoare, articulații și geometrie.',
    'Shock absorbers, joints and alignment.',
    'steering',
    'safety',
  ),
  c(
    'Sistem electric',
    'Sistem electric',
    'Electrical system',
    'Diagnostic, alternator și instalație.',
    'Diagnostics, alternator and wiring.',
    'electric',
    'systems',
  ),
  c(
    'Sistem de răcire',
    'Sistem de răcire',
    'Cooling system',
    'Antigel, radiator și pompă de apă.',
    'Coolant, radiator and water pump.',
    'cooling',
    'systems',
  ),
  c(
    'Aer condiționat',
    'Aer condiționat',
    'Air conditioning',
    'Climatizare, agent frigorific și igienizare.',
    'Climate control, refrigerant and cleaning.',
    'cooling',
    'systems',
  ),
  c(
    'Ambreiaj',
    'Ambreiaj',
    'Clutch',
    'Kit ambreiaj, volantă și rulmenți.',
    'Clutch kit, flywheel and bearings.',
    'disc',
    'systems',
  ),
  c(
    'Evacuare',
    'Evacuare',
    'Exhaust',
    'Tobă, catalizator și filtru de particule.',
    'Silencer, catalytic converter and particulate filter.',
    'engine',
    'systems',
  ),
  c(
    'Caroserie și vopsitorie',
    'Caroserie și vopsitorie',
    'Bodywork & paint',
    'Elemente reparate, culoare și garanție.',
    'Repaired panels, paint and warranty.',
    'body',
    'systems',
  ),
  c(
    'ITP',
    'ITP',
    'Technical inspection (ITP)',
    'Rezultat, stație și următoarea inspecție.',
    'Result, station and next inspection.',
    'shield',
    'periodic',
  ),
  c(
    'Altă operațiune',
    'Alte operațiuni',
    'Other maintenance',
    'Denumire și detalii pentru orice altă lucrare.',
    'A title and details for any other work.',
    'plus',
    'other',
  ),
];
export const documentCategories: RecordCategory[] = [
  c(
    'RCA',
    'RCA',
    'Liability insurance (RCA)',
    'Poliță, emitent și data expirării.',
    'Policy, issuer and expiry date.',
    'shield',
  ),
  c(
    'ITP',
    'ITP',
    'Technical inspection (ITP)',
    'Inspecție tehnică și valabilitate.',
    'Technical inspection and validity.',
    'clipboard',
  ),
  c(
    'Rovinietă',
    'Rovinietă',
    'Road vignette',
    'Taxă de drum și perioada de valabilitate.',
    'Road vignette and validity period.',
    'road',
  ),
  c(
    'CASCO',
    'CASCO',
    'Comprehensive insurance (CASCO)',
    'Asigurare facultativă și valabilitate.',
    'Optional insurance and validity.',
    'shield',
  ),
  c(
    'Permis',
    'Permis de conducere',
    'Driving licence',
    'Număr, emitere și expirare.',
    'Number, issue and expiry dates.',
    'card',
  ),
  c(
    'Înmatriculare',
    'Certificat de înmatriculare',
    'Registration certificate',
    'Datele și seria certificatului.',
    'Certificate details and number.',
    'file',
  ),
  c(
    'Impozit auto',
    'Impozit auto',
    'Vehicle tax',
    'Decizie, plată și termen, dacă există.',
    'Assessment, payment and any deadline.',
    'wallet',
  ),
  c(
    'Alt document',
    'Alte documente',
    'Other documents',
    'Document personalizat și atașament.',
    'Custom document and attachment.',
    'plus',
  ),
];
const expenseDefinitions = [
  ['Combustibil', 'Combustibil', 'Fuel', 'fuel'],
  ['Revizii', 'Revizie', 'Servicing', 'clipboard'],
  ['Schimb ulei', 'Schimb ulei și filtre', 'Oil & filters', 'oil'],
  ['Reparații', 'Reparații', 'Repairs', 'wrench'],
  ['Frâne', 'Frâne', 'Brakes', 'disc'],
  ['Anvelope', 'Anvelope', 'Tires', 'wheel'],
  ['Baterie', 'Baterie', 'Battery', 'battery'],
  ['Distribuție', 'Distribuție', 'Timing system', 'settings'],
  ['ITP', 'ITP', 'Technical inspection', 'shield'],
  ['RCA', 'RCA', 'Liability insurance', 'shield'],
  ['CASCO', 'CASCO', 'Comprehensive insurance', 'shield'],
  ['Rovinietă', 'Rovinietă', 'Road vignette', 'road'],
  ['Impozit', 'Impozit', 'Vehicle tax', 'wallet'],
  ['Spălătorie', 'Spălătorie și detailing', 'Car wash & detailing', 'body'],
  ['Parcare', 'Parcare', 'Parking', 'parking'],
  ['Taxe de drum', 'Taxe de drum', 'Road tolls', 'road'],
  ['Altele', 'Alte cheltuieli', 'Other expenses', 'plus'],
  // Existing broad categories remain available for editing and historical records.
  ['Taxe', 'Taxe generale', 'General fees', 'wallet'],
  ['Asigurări', 'Alte asigurări', 'Other insurance', 'shield'],
];
export const expenseCategories: RecordCategory[] = expenseDefinitions.map(([value, ro, en, icon]) =>
  c(
    value,
    ro,
    en,
    ro === 'Alte cheltuieli'
      ? 'Descrie cheltuiala și salvează suma.'
      : 'Sumă, dată și document justificativ opțional.',
    en === 'Other expenses'
      ? 'Describe the expense and record its cost.'
      : 'Amount, date and optional receipt.',
    icon,
  ),
);
export const categoriesFor = (kind: RecordKind) =>
  kind === 'service'
    ? serviceCategories
    : kind === 'document'
      ? documentCategories
      : expenseCategories;
export function recordCategory(kind: RecordKind, value: string) {
  return categoriesFor(kind).find((c) => c.value === value);
}
export const repairCategories = new Set([
  'Reparație',
  'Motor',
  'Cutie de viteze și transmisie',
  'Suspensie și direcție',
  'Sistem electric',
  'Sistem de răcire',
  'Aer condiționat',
  'Ambreiaj',
  'Evacuare',
  'Caroserie și vopsitorie',
]);
