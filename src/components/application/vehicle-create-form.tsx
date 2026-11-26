'use client';

import {CarFront,FileCheck,Settings2} from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { vehicleDocumentCategories } from '@/lib/validation';
import { FilterSelect } from '../filter-select';
import { PremiumDateInput } from '../premium-date-input';
import { SignatureActions, SignatureGroup, SignatureFold } from '../signature-form';
import { useApplicationLanguage } from '../application-locale';

type VehicleFields = {
  brand: string; model: string; plate: string; vin: string | null; year: number;
  odometer: number; fuel: string; capacity: number | null; engine: string | null;
  purchasedAt: string | null; notes: string | null;
};

function useCatalog(query: string) {
  const [result, setResult] = useState<{ items: string[]; loading: boolean }>({ items: [], loading: false });
  useEffect(() => {
    if (!query) { setResult({ items: [], loading: false }); return; }
    const controller = new AbortController();
    setResult({ items: [], loading: true });
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/v1/vehicles/catalog?type=' + query, { signal: controller.signal });
        if (!response.ok) throw new Error('Catalogue unavailable');
        const { items } = await response.json();
        if (!controller.signal.aborted) setResult({ items: Array.isArray(items) ? items : [], loading: false });
      } catch {
        if (!controller.signal.aborted) setResult({ items: [], loading: false });
      }
    }, 450);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  return result;
}

export function VehicleForm({ vehicle, vehicles, busy, error, onDirty, onCancel, onSave }: {
  vehicle?: VehicleFields;
  vehicles: ReadonlyArray<Pick<VehicleFields, 'brand'>>;
  busy: boolean;
  error: string;
  onDirty: () => void;
  onCancel: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  const en = useApplicationLanguage() === 'en';
  const body = useRef<HTMLDivElement>(null);
  const t = (ro: string, english: string) => en ? english : ro;
  const suggestions = useId();
  const [make, setMake] = useState(vehicle?.brand ?? '');
  const [model, setModel] = useState(vehicle?.model ?? '');
  const [year, setYear] = useState(String(vehicle?.year ?? new Date().getFullYear()));
  const makes = useCatalog('makes');
  const models = useCatalog(make.trim().length >= 2 ? 'models&make=' + encodeURIComponent(make.trim()) : '');
  const engines = useCatalog(make.trim() && model.trim() && /^\d{4}$/.test(year) && Number(year) >= 1984
    ? 'engines&make=' + encodeURIComponent(make.trim()) + '&model=' + encodeURIComponent(model.trim()) + '&year=' + year : '');
  const brands = [...new Set([...vehicles.map(other => other.brand), ...makes.items])];

  return <form className="sf-form" aria-busy={busy} onSubmit={async event => {
    event.preventDefault();
    if (busy) return;
    await onSave(event);
    body.current?.scrollTo({ top: 0 });
  }} onChange={onDirty} onInvalid={event => {
    const details = (event.target as HTMLElement).closest('details');
    if (details) details.open = true;
  }}>
    <div className="sf-body" ref={body} inert={busy}>
      <div className="sf-vehicle-content">
        {error && <p className="sf-error" role="alert">{en && error.includes('acest VIN') ? 'A vehicle with this VIN already exists in your account.' : en && error.includes('acest număr') ? 'A vehicle with this registration plate already exists in your account.' : error}</p>}
        <div className="sf2-identity"><span className="sf-category-icon"><CarFront size={22}/></span><div className="sf2-identity-copy"><h3>{[make,model].filter(Boolean).join(' ')||t('Vehicul nou','New vehicle')}</h3>{vehicle?.plate&&<p><code>{vehicle.plate}</code></p>}</div></div>
        <SignatureGroup icon={CarFront} title={t('Identitate și utilizare','Vehicle identity and usage')}>
        <div className="form-grid">
          <label>{t('Marcă', 'Make')}<input name="brand" required list={suggestions+'-makes'} value={make} onChange={event=>setMake(event.target.value)} /></label>
          <datalist id={suggestions+'-makes'}>{brands.map(brand => <option key={brand} value={brand} />)}</datalist>
          <label>{t('Model', 'Model')}<input name="model" required list={suggestions+'-models'} value={model} onChange={event=>setModel(event.target.value)} /></label>
          <datalist id={suggestions+'-models'}>{models.items.map(value => <option key={value} value={value} />)}</datalist>
          <label>{t('An', 'Year')}<input name="year" type="number" inputMode="numeric" required min={1886} max={new Date().getFullYear()+1} value={year} onChange={event=>setYear(event.target.value)} /></label>
          <label>{t('Număr de înmatriculare', 'Registration plate')}<input name="plate" required minLength={2} maxLength={20} defaultValue={vehicle?.plate} /></label>
          <p className="full micro" role="status">{models.loading || makes.loading ? t('Se încarcă sugestiile…', 'Loading suggestions…')
            : t('Poți introduce manual orice marcă sau model care lipsește.', 'You can enter any missing make or model manually.')}</p>
          <h3 className="sf-group-title">{t('Date tehnice și kilometraj', 'Technical details and mileage')}</h3>
          <label>{t('Kilometraj actual · km', 'Current odometer · km')}<input name="odometer" type="number" inputMode="numeric" required min={0} max={10000000} defaultValue={vehicle?.odometer ?? 0} /></label>
          <label>{t('Combustibil', 'Fuel')}<FilterSelect name="fuel" defaultValue={vehicle?.fuel || 'Benzină'}>
            {(['Benzină', 'Diesel', 'Hibrid', 'Electric', 'GPL', 'Altul'] as const).map((fuel, index) => <option key={fuel} value={fuel}>{en ? ['Petrol', 'Diesel', 'Hybrid', 'Electric', 'LPG', 'Other'][index] : fuel}</option>)}
          </FilterSelect></label>
        </div>
        </SignatureGroup>
        <SignatureFold icon={Settings2} title={t('Identificare și observații','Identification and notes')} summary={vehicle?.engine||vehicle?.vin||undefined}>
          <div className="form-grid">
            <label>VIN<input name="vin" maxLength={17} pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" title={t('17 caractere, fără I, O sau Q', '17 characters, excluding I, O and Q')} defaultValue={vehicle?.vin ?? ''} /></label>
            <label>{t('Motorizare', 'Engine')}<input name="engine" defaultValue={vehicle?.engine ?? ''} list={suggestions+'-engines'} maxLength={250} />
              <small>{engines.loading ? t('Se caută motorizări…','Looking up powertrains…') : t('Sugestii unde există date pentru model și an. Poți scrie motorizarea manual.', 'Suggestions where model and year data exist. You can enter a powertrain manually.')}</small>
            </label>
            <datalist id={suggestions+'-engines'}>{engines.items.map(value => <option key={value} value={value} />)}</datalist>
            <label>{t('Capacitate · cm³', 'Displacement · cm³')}<input name="capacity" type="number" inputMode="numeric" min={0} max={30000} defaultValue={vehicle?.capacity ?? ''} /></label>
            <label>{t('Data achiziției', 'Purchase date')}<PremiumDateInput name="purchasedAt" defaultValue={vehicle?.purchasedAt ?? ''} /></label>
            <label className="full">{t('Observații', 'Notes')}<textarea name="notes" maxLength={4000} defaultValue={vehicle?.notes ?? ''} /></label>
          </div>
        </SignatureFold>
        {!vehicle && <SignatureFold icon={FileCheck} title={t('Expirarea documentelor','Document expiry')}>
          <div className="form-grid">
            {vehicleDocumentCategories.map(category => <label key={category}>{category}<PremiumDateInput name={'document-'+category} /></label>)}
          </div>
        </SignatureFold>}
      </div>
    </div>
    <SignatureActions onCancel={onCancel} busy={busy} label={vehicle ? t('Salvează modificările', 'Save changes') : t('Salvează vehiculul', 'Save vehicle')} />
  </form>;
}
