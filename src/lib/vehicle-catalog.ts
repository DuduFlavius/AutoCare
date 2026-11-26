import { z } from 'zod';

const label = z.string().trim().min(1).max(75).regex(/^[\p{L}\p{N} .,+&'()/_-]+$/u);
const requestSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('makes') }),
  z.object({ type: z.literal('models'), make: label }),
  z.object({ type: z.literal('engines'), make: label, model: label, year: z.coerce.number().int().min(1984).max(new Date().getFullYear() + 1) }),
]);
const regional: Record<string, string[]> = {
  Dacia: ['Bigster', 'Dokker', 'Duster', 'Jogger', 'Lodgy', 'Logan', 'Logan MCV', 'Sandero', 'Sandero Stepway', 'Spring'],
  'Škoda': ['Citigo', 'Enyaq', 'Fabia', 'Kamiq', 'Karoq', 'Kodiaq', 'Octavia', 'Rapid', 'Roomster', 'Scala', 'Superb', 'Yeti'],
  Renault: ['Austral', 'Captur', 'Clio', 'Espace', 'Kangoo', 'Kadjar', 'Laguna', 'Megane', 'Modus', 'Scenic', 'Talisman', 'Twingo', 'Zoe'],
  Volkswagen: ['Arteon', 'Caddy', 'Golf', 'ID.3', 'ID.4', 'Jetta', 'Passat', 'Polo', 'T-Cross', 'T-Roc', 'Tiguan', 'Touran', 'Transporter'],
  SEAT: ['Alhambra', 'Arona', 'Ateca', 'Ibiza', 'Leon', 'Tarraco', 'Toledo'],
  Peugeot: ['108', '208', '2008', '308', '3008', '408', '508', '5008', 'Partner', 'Rifter'],
  Citroën: ['C1', 'C3', 'C3 Aircross', 'C4', 'C4 Cactus', 'C5 Aircross', 'Berlingo'],
  Opel: ['Astra', 'Combo', 'Corsa', 'Crossland', 'Grandland', 'Insignia', 'Meriva', 'Mokka', 'Vectra', 'Zafira'],
  Fiat: ['500', '500X', 'Doblo', 'Grande Panda', 'Panda', 'Punto', 'Tipo'],
  Ford: ['EcoSport', 'Fiesta', 'Focus', 'Galaxy', 'Kuga', 'Mondeo', 'Puma', 'Ranger', 'S-Max', 'Transit'],
};
const commonMakes = ['Alfa Romeo','Audi','BMW','Cupra','Honda','Hyundai','Jaguar','Jeep','Kia','Land Rover','Lexus','Mazda','Mercedes-Benz','Mitsubishi','Nissan','Porsche','Subaru','Suzuki','Tesla','Toyota','Volvo'];
const normalize = (value: string) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
function combine(values: unknown[]) {
  const names = new Map<string,string>();
  for (const value of values) if (typeof value === 'string' && value.trim()) {
    const name = value.trim();
    if (!names.has(normalize(name))) names.set(normalize(name), name);
  }
  return [...names.values()].sort((a,b) => a.localeCompare(b));
}
async function provider(url: URL) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(9000) });
  if (!response.ok) throw new Error('Vehicle catalogue unavailable');
  return response.json();
}
export async function vehicleCatalog(params: URLSearchParams) {
  const input = requestSchema.parse(Object.fromEntries(params));
  if (input.type === 'engines') {
    const url = new URL('https://www.fueleconomy.gov/ws/rest/vehicle/menu/options');
    url.search = new URLSearchParams({ year: String(input.year), make: input.make, model: input.model }).toString();
    try {
      const result = await provider(url);
      const items = result?.menuItem;
      return { items: combine((Array.isArray(items) ? items : items ? [items] : []).map(item => item.text)).slice(0, 100), degraded: false };
    } catch { return { items: [], degraded: true }; }
  }
  const url = new URL(input.type === 'makes' ? 'https://vpic.nhtsa.dot.gov/api/vehicles/GetMakesForVehicleType/car'
    : 'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/' + encodeURIComponent(input.make));
  url.searchParams.set('format','json');
  const fallback = input.type === 'makes' ? [...Object.keys(regional), ...commonMakes] : Object.entries(regional).find(([key]) => normalize(key) === normalize(input.make))?.[1] ?? [];
  try {
    const result = await provider(url);
    const entries = Array.isArray(result.Results) ? result.Results as { MakeName?: string; Model_Name?: string }[] : [];
    return { items: combine([...fallback, ...entries.map(entry => input.type === 'makes' ? entry.MakeName : entry.Model_Name)]).slice(0, 3500), degraded: false };
  } catch { return { items: combine(fallback), degraded: true }; }
}
