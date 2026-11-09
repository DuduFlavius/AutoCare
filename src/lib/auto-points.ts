export const autoPointCategories = {
  service: {
    tag: 'shop',
    value: 'car_repair',
    label: 'Service',
    english: 'Repair shop',
    color: '#b8c4d2',
  },
  tyres: { tag: 'shop', value: 'tyres', label: 'Vulcanizare', english: 'Tyre shop', color: '#a4bbd4' },
  wash: { tag: 'amenity', value: 'car_wash', label: 'Spălătorie', english: 'Car wash', color: '#56d6e8' },
  parts: { tag: 'shop', value: 'car_parts', label: 'Piese auto', english: 'Car parts', color: '#b8c4d2' },
  fuel: {
    tag: 'amenity',
    value: 'fuel',
    label: 'Benzinărie',
    english: 'Fuel station',
    color: '#b1aaff',
  },
  parking: {
    tag: 'amenity',
    value: 'parking',
    label: 'Parcare',
    english: 'Parking',
    color: '#9fb9ff',
  },
  charging: {
    tag: 'amenity',
    value: 'charging_station',
    label: 'Încărcare electrică',
    english: 'EV charging',
    color: '#79dbc1',
  },
} as const;

export type AutoPointCategory = keyof typeof autoPointCategories;
export type MapArea = { latitude: number; longitude: number; zoom: number };
export type AutoPoint = {
  id: string;
  latitude: number;
  longitude: number;
  category: AutoPointCategory;
  name: string | null;
  address?: string;
  hours?: string;
  phone?: string;
};

export const defaultAutoPointsArea: MapArea = { latitude: 45.75, longitude: 21.23, zoom: 13 };

export function autoPointQuery(latitude: number, longitude: number, category: AutoPointCategory) {
  const { tag, value } = autoPointCategories[category];
  return `[out:json][timeout:8];nwr(around:4000,${latitude.toFixed(2)},${longitude.toFixed(2)})["${tag}"="${value}"];out center 120;`;
}

export function parseAutoPoints(data: unknown, category: AutoPointCategory): AutoPoint[] {
  if (!data || typeof data !== 'object' || !('elements' in data) || !Array.isArray(data.elements))
    throw new Error('Invalid OpenStreetMap response');
  return data.elements.slice(0, 120).flatMap((row) => {
    const latitude = row?.lat ?? row?.center?.lat;
    const longitude = row?.lon ?? row?.center?.lon;
    if (
      !Number.isFinite(latitude) ||
      Math.abs(latitude) > 90 ||
      !Number.isFinite(longitude) ||
      Math.abs(longitude) > 180 ||
      !Number.isSafeInteger(row?.id) ||
      !['node', 'way', 'relation'].includes(row.type)
    )
      return [];
    const tags = row.tags;
    const clean = (value: unknown) => typeof value === 'string' ? value.trim().slice(0, 240) || undefined : undefined;
    const name = tags?.name ?? tags?.brand ?? tags?.operator;
    const street = [clean(tags?.['addr:street']), clean(tags?.['addr:housenumber'])].filter(Boolean).join(' ');
    const phone = clean(tags?.['contact:phone'] ?? tags?.phone);
    return [
      {
        id: row.type + '/' + row.id,
        latitude,
        longitude,
        category,
        address: clean(tags?.['addr:full']) ?? ([street, clean(tags?.['addr:city'])].filter(Boolean).join(', ') || undefined),
        hours: clean(tags?.opening_hours),
        phone: phone && /^\+?[\d ().-]{5,25}$/.test(phone) ? phone : undefined,
        name: typeof name === 'string' ? name.trim().slice(0, 160) || null : null,
      },
    ];
  });
}
