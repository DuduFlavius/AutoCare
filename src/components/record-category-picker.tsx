'use client';
import { useState } from 'react';
import {
  Search,
  Check,
  ArrowRight,
  Droplets,
  ListFilter,
  Disc3,
  BatteryCharging,
  Settings2,
  ClipboardCheck,
  ShieldCheck,
  FileText,
  Wallet,
  CarFront,
  Zap,
  Thermometer,
  Plus,
  Route,
  Fuel,
  ParkingCircle,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { categoriesFor, recordCategory, type RecordKind } from '@/lib/record-categories';
import { normalizeWorkspaceSearch } from '@/lib/workspace';
import { useApplicationLanguage } from './application-locale';
const icons: Record<string, LucideIcon> = {
  oil: Droplets,
  filter: ListFilter,
  disc: Disc3,
  wheel: Disc3,
  battery: BatteryCharging,
  settings: Settings2,
  clipboard: ClipboardCheck,
  shield: ShieldCheck,
  file: FileText,
  card: FileText,
  wallet: Wallet,
  body: CarFront,
  electric: Zap,
  cooling: Thermometer,
  plus: Plus,
  road: Route,
  fuel: Fuel,
  parking: ParkingCircle,
  wrench: Wrench,
  engine: Settings2,
  steering: Settings2,
};
export default function RecordCategoryPicker({
  kind,
  selected,
  onSelect,
  onCancel,
}: {
  kind: RecordKind;
  selected: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState('');
  const en = useApplicationLanguage() === 'en';
  const options = categoriesFor(kind).filter((c) =>
    normalizeWorkspaceSearch([c.ro, c.en, c.description, c.descriptionEn].join(' ')).includes(
      normalizeWorkspaceSearch(query),
    ),
  );
  return (
    <section className="record-category-browser" data-workspace-ui>
      <header>
        <span className="record-step">
          {en ? '01 · CHOOSE A CATEGORY' : '01 · ALEGE CATEGORIA'}
        </span>
        <h3>{en ? 'What would you like to add?' : 'Ce vrei să înregistrezi?'}</h3>
        <p>
          {en
            ? 'Choose a category. The form will show only the details relevant to your record.'
            : 'Alege categoria. Formularul va afișa detaliile relevante pentru înregistrarea ta.'}
        </p>
      </header>
      <label className="record-category-search">
        <Search size={19} />
        <span className="sr-only">{en ? 'Search categories' : 'Caută categorii'}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.preventDefault();
          }}
          placeholder={en ? 'Search oil, brakes, insurance…' : 'Caută ulei, frâne, asigurare…'}
        />
      </label>
      <div className="record-category-grid">
        {options.map((c) => {
          const Icon = icons[c.icon] || Wrench;
          return (
            <button
              type="button"
              key={c.value}
              aria-pressed={selected === c.value}
              onClick={() => onSelect(c.value)}
            >
              <span className="record-category-icon">
                <Icon size={22} />
              </span>
              <span>
                <strong>{en ? c.en : c.ro}</strong>
                <small>{en ? c.descriptionEn : c.description}</small>
              </span>
              {selected === c.value ? (
                <Check className="record-category-arrow" size={18} />
              ) : (
                <ArrowRight className="record-category-arrow" size={17} />
              )}
            </button>
          );
        })}
      </div>
      {!options.length && (
        <p role="status">
          {en
            ? 'No categories found. Try a different search.'
            : 'Nicio categorie găsită. Încearcă altă căutare.'}
        </p>
      )}
      {!recordCategory(kind, selected) && selected && (
        <button type="button" className="record-legacy-category" onClick={() => onSelect(selected)}>
          {en ? 'Keep existing category: ' : 'Păstrează categoria existentă: '}
          {selected}
        </button>
      )}
      <footer>
        <button type="button" onClick={onCancel}>
          {en ? 'Cancel' : 'Anulează'}
        </button>
        <span>
          {en
            ? 'Your existing records remain unchanged.'
            : 'Înregistrările existente rămân neschimbate.'}
        </span>
      </footer>
    </section>
  );
}
