'use client';
import { useState, useDeferredValue } from 'react';
import {
  LayoutDashboard,
  CarFront,
  Files,
  History,
  Wrench,
  CalendarDays,
  Route,
  Gauge,
  Wallet,
  BellRing,
  Star,
  MessageSquare,
  Settings,
  ArrowUpRight,
  Search,
  Plus,
  ArrowRight,
} from 'lucide-react';
import {
  workspaceSections,
  workspaceGroups,
  workspaceHref,
  normalizeWorkspaceSearch,
} from '@/lib/workspace';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
type Language = 'ro' | 'en';
const icons = {
  home: LayoutDashboard,
  car: CarFront,
  files: Files,
  history: History,
  wrench: Wrench,
  calendar: CalendarDays,
  route: Route,
  gauge: Gauge,
  wallet: Wallet,
  bell: BellRing,
  premium: Star,
  support: MessageSquare,
  settings: Settings,
};
export function WorkspaceNavigation({
  tab,
  language,
  navigate,
  notifications = 0,
  support = 0,
  path = '/cont',
}: {
  tab: string;
  language: Language;
  navigate: (tab: string) => boolean;
  notifications?: number;
  support?: number;
  path?: string;
}) {
  return (
    <nav
      className="ws-navigation"
      aria-label={language === 'en' ? 'Application sections' : 'Secțiunile aplicației'}
      data-workspace-ui
    >
      {workspaceGroups.map((group) => (
        <div className="ws-nav-group" key={group.id}>
          <p>{group[language]}</p>
          {workspaceSections
            .filter((s) => s.group === group.id)
            .map((section) => {
              const Icon = icons[section.icon];
              const count =
                section.id === 'Notificări'
                  ? notifications
                  : section.id === 'Centru de suport'
                    ? support
                    : 0;
              return (
                <a
                  href={workspaceHref(path, section.id)}
                  key={section.id}
                  aria-current={tab === section.id ? 'page' : undefined}
                  className={tab === section.id ? 'active' : ''}
                  onClick={(e) => {
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                    e.preventDefault();
                    navigate(section.id);
                  }}
                >
                  <Icon size={18} />
                  <span>{section[language]}</span>
                  {count > 0 && <span className="ws-nav-count">{count}</span>}
                </a>
              );
            })}
        </div>
      ))}
    </nav>
  );
}
export function WorkspaceLauncher({
  data,
  language,
  navigate,
  onRecord,
  onVehicle,
  onCreate,
}: {
  data: Data | null;
  language: Language;
  navigate: (tab: string) => void;
  onRecord: (record: Data['records'][number]) => void;
  onVehicle: (id: string) => void;
  onCreate: (kind: 'vehicle' | 'document' | 'service' | 'expense') => void;
}) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const terms = normalizeWorkspaceSearch(deferred).split(/\s+/).filter(Boolean);
  const match = (text: string) => terms.every((t) => normalizeWorkspaceSearch(text).includes(t));
  const sections = workspaceSections.filter((s) => match(`${s.ro} ${s.en} ${s.id}`));
  const cars = data?.vehicles.filter((v) => !v.archived) || [];
  const records = terms.length
    ? data?.records.filter(
        (r) =>
          !r.cancelled &&
          cars.some((v) => v.id === r.vehicleId) &&
          match(
            `${r.title} ${r.category} ${r.provider || ''} ${cars.find((v) => v.id === r.vehicleId)?.plate || ''}`,
          ),
      ) || []
    : [];
  const carResults = terms.length
    ? cars.filter((v) => match(`${v.brand} ${v.model} ${v.plate}`))
    : [];
  const t = (ro: string, en: string) => (language === 'en' ? en : ro);
  return (
    <div className="ws-launcher" data-workspace-ui>
      <label className="ws-search-field">
        <Search size={20} />
        <span className="sr-only">{t('Caută în aplicație', 'Search the application')}</span>
        <input
          autoFocus
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t(
            'Secțiuni, mașini, documente, intervenții…',
            'Sections, vehicles, documents, maintenance…',
          )}
        />
        <kbd>ESC</kbd>
      </label>
      {!query && (
        <div className="ws-launch-actions">
          {(
            [
              ['vehicle', 'Mașină', 'Vehicle'],
              ['document', 'Document', 'Document'],
              ['service', 'Intervenție', 'Maintenance'],
              ['expense', 'Cheltuială', 'Expense'],
            ] as const
          ).map(([kind, ro, en]) => (
            <button
              type="button"
              key={kind}
              disabled={!data || (kind !== 'vehicle' && !cars.length)}
              onClick={() => onCreate(kind)}
            >
              <Plus size={16} />
              {t(ro, en)}
            </button>
          ))}
        </div>
      )}
      <div className="ws-launch-results" aria-live="polite">
        {!!sections.length && (
          <>
            <h3>{t('Navigare rapidă', 'Quick navigation')}</h3>
            {sections.map((s) => {
              const Icon = icons[s.icon];
              return (
                <button type="button" key={s.id} onClick={() => navigate(s.id)}>
                  <Icon size={19} />
                  <strong>{s[language]}</strong>
                  <ArrowRight size={16} />
                </button>
              );
            })}
          </>
        )}
        {!!carResults.length && (
          <>
            <h3>{t('Mașini', 'Vehicles')}</h3>
            {carResults.slice(0, 8).map((v) => (
              <button type="button" key={v.id} onClick={() => onVehicle(v.id)}>
                <CarFront size={19} />
                <span>
                  <strong data-user-content>
                    {v.brand} {v.model}
                  </strong>
                  <small>{v.plate}</small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </>
        )}
        {!!records.length && (
          <>
            <h3>
              {t('Înregistrări din garaj', 'Garage records')} · {records.length}
            </h3>
            {records.slice(0, 20).map((r) => (
              <button type="button" key={r.id} onClick={() => onRecord(r)}>
                <Files size={19} />
                <span>
                  <strong data-user-content>{r.title}</strong>
                  <small>
                    {r.category} · {cars.find((v) => v.id === r.vehicleId)?.plate}
                  </small>
                </span>
                <ArrowUpRight size={16} />
              </button>
            ))}
          </>
        )}
        {!sections.length && !carResults.length && !records.length && (
          <p className="ws-search-empty">
            {t(
              'Niciun rezultat. Încearcă numărul mașinii sau numele unei secțiuni.',
              'No results. Try a vehicle plate or a section name.',
            )}
          </p>
        )}
        {records.length > 20 && (
          <p>
            {t(
              'Rafinează căutarea pentru mai multe rezultate.',
              'Refine your search to see more results.',
            )}
          </p>
        )}
      </div>
    </div>
  );
}
export function WorkspaceContext({
  tab,
  language,
  navigate,
}: {
  tab: string;
  language: Language;
  navigate: (tab: string) => boolean;
}) {
  const section = workspaceSections.find((s) => s.id === tab);
  if (!section || ['overview', 'help', 'account'].includes(section.group)) return null;
  return (
    <nav
      className="ws-context-nav"
      aria-label={language === 'en' ? 'Related sections' : 'Secțiuni asociate'}
      data-workspace-ui
    >
      {workspaceSections
        .filter((s) => s.group === section.group)
        .map((s) => (
          <button
            type="button"
            key={s.id}
            aria-current={s.id === tab ? 'page' : undefined}
            onClick={() => navigate(s.id)}
          >
            {s[language]}
          </button>
        ))}
    </nav>
  );
}
export function WorkspaceOverview({
  data,
  language,
  currency,
  navigate,
}: {
  data: Data;
  language: Language;
  currency: 'RON' | 'EUR';
  navigate: (tab: string) => boolean;
}) {
  const active = data.vehicles.filter((v) => !v.archived);
  const docs = data.records.filter(
    (r) => r.kind === 'document' && !r.cancelled && active.some((v) => v.id === r.vehicleId),
  );
  const attention = docs.filter((r) => r.status.days !== null && r.status.days <= 30).length;
  const cost = new Intl.NumberFormat(language === 'en' ? 'en-IE' : 'ro-RO', {
    style: 'currency',
    currency,
  }).format(data.summary.monthBani / (currency === 'EUR' ? 500 : 100));
  const stats = [
    {
      tab: 'Garaj',
      ro: 'Mașini active',
      en: 'Active vehicles',
      value: active.length,
      info: language === 'en' ? 'Your personal fleet' : 'Garajul tău personal',
      Icon: CarFront,
    },
    {
      tab: 'Documente',
      ro: 'Acte în atenție',
      en: 'Documents to review',
      value: attention,
      info:
        language === 'en'
          ? 'Overdue or due within 30 days'
          : 'Expirate sau în următoarele 30 de zile',
      Icon: Files,
    },
    {
      tab: 'Cheltuieli',
      ro: 'Costuri luna aceasta',
      en: 'Costs this month',
      value: cost,
      info:
        currency === 'EUR'
          ? language === 'en'
            ? 'Indicative conversion · 1 EUR = 5 RON'
            : 'Conversie orientativă · 1 EUR = 5 RON'
          : language === 'en'
            ? 'Recorded in your account'
            : 'Înregistrate în contul tău',
      Icon: Wallet,
    },
  ];
  return (
    <div className="ws-overview" data-workspace-ui>
      {stats.map((s) => (
        <button key={s.tab} type="button" onClick={() => navigate(s.tab)}>
          <span className="ws-stat-label">
            <s.Icon size={18} />
            {s[language]}
            <ArrowUpRight size={14} />
          </span>
          <strong>{s.value}</strong>
          <small>{s.info}</small>
        </button>
      ))}
    </div>
  );
}
export function WorkspacePreferences({
  language,
  currency,
  onLanguage,
  onCurrency,
}: {
  language: Language;
  currency: 'RON' | 'EUR';
  onLanguage: (v: Language) => void;
  onCurrency: (v: 'RON' | 'EUR') => void;
}) {
  return (
    <div className="ws-device-preferences" data-workspace-ui>
      <h3>{language === 'en' ? 'Language & display' : 'Limbă și afișare'}</h3>
      <label>
        {language === 'en' ? 'Application language' : 'Limba aplicației'}
        <select
          value={language}
          onChange={(e) => onLanguage(e.target.value === 'en' ? 'en' : 'ro')}
        >
          <option value="ro">Română</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        {language === 'en' ? 'Display currency' : 'Moneda de afișare'}
        <select
          value={currency}
          onChange={(e) => onCurrency(e.target.value === 'EUR' ? 'EUR' : 'RON')}
        >
          <option>RON</option>
          <option>EUR</option>
        </select>
      </label>
      <p>
        {language === 'en'
          ? 'EUR is an indicative display conversion at 1 EUR = 5 RON. Saved values and subscription billing remain in RON.'
          : 'EUR este o conversie orientativă la 1 EUR = 5 RON. Valorile salvate și facturarea abonamentelor rămân în RON.'}
      </p>
    </div>
  );
}
