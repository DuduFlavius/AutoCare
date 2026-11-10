'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { ArrowUpRight, BarChart3, CalendarDays, Download, Gauge, Paperclip, Sparkles, Wallet } from 'lucide-react';
import { budgetState, financeGroup, financeOverview, financialChange, type FinanceGroup } from '@/lib/finance-overview';
import { filterRecords } from '@/lib/record-filters';
import type { dashboard } from '@/lib/service';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { TitaniumWave } from '../titanium-wave';
import './finance-center.css';

type Data = Awaited<ReturnType<typeof dashboard>>;
type Entry = Data['records'][number];
type Sample = { bani: number; count: number; known: number };
const pageSize = 10;

export function FinanceCenter({ data, today, primaryId, preview, money, onEdit, onArchive, onAi, onRefresh }: {
  data: Data; today: string; primaryId: string; preview: boolean; money: (bani: number) => string;
  onEdit: (row: Entry) => void; onArchive: (row: Entry) => void; onAi: (vehicleId: string) => void;
  onRefresh: () => Promise<void>;
}) {
  const en = useApplicationLanguage() === 'en';
  const locale = useApplicationLocale();
  const t = (ro: string, english: string) => en ? english : ro;
  const groups: Record<FinanceGroup, string> = {
    Combustibil: t('Combustibil', 'Fuel'), Service: 'Service', Frâne: t('Frâne', 'Brakes'), RCA: 'RCA', ITP: 'ITP',
    Anvelope: t('Anvelope', 'Tyres'), Distribuție: t('Distribuție', 'Timing system'), 'Alte cheltuieli': t('Alte cheltuieli', 'Other expenses'),
  };
  const [vehicle, setVehicle] = useState('');
  const [view, setView] = useState<'month' | 'year'>('year');
  const [group, setGroup] = useState('');
  const [query, setQuery] = useState('');
  const [range, setRange] = useState('all');
  const [archived, setArchived] = useState(false);
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(0);
  const [point, setPoint] = useState<number | null>(null);
  const report = useMemo(() => financeOverview(data.records, today, vehicle), [data.records, today, vehicle]);
  const active = data.vehicles.filter(car => !car.archived);
  const budgetCar = vehicle ? active.find(car => car.id === vehicle) : active.find(car => car.id === primaryId) ?? active[0];
  const budgetUsage = budgetCar ? (vehicle ? report.monthBani : financeOverview(data.records, today, budgetCar.id).monthBani) : 0;
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const [y, m] = month.split('-').map(Number);
  const prevMonth = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  const sample = (day: string): Sample => {
    const rows = report.entries.filter(row => !row.cancelled && row.date === day && day <= today);
    const known = rows.filter(row => row.amountKnown !== false);
    return { count: rows.length, known: known.length, bani: known.reduce((sum, row) => sum + row.amountBani, 0) };
  };
  const chart = view === 'year' ? report.series.map(row => ({
    ...row,
    label: new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(row.month + '-01T12:00:00Z')),
  })) : Array.from({ length: Math.max(new Date(Date.UTC(y, m, 0)).getUTCDate(), new Date(Date.UTC(y, m - 1, 0)).getUTCDate()) }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return { label: day, current: sample(month + '-' + day), previous: sample(prevMonth + '-' + day) };
  });
  const scale = Math.max(1, ...chart.flatMap(row => [row.current.bani, row.previous.bani]));
  const shown = point != null && chart[point] ? chart[point] : chart[view === 'year' ? m - 1 : Number(today.slice(-2)) - 1];
  const details = (row: Sample) => row.known ? money(row.bani) : row.count ? t('Cost necunoscut', 'Cost unknown') : t('Fără înregistrări', 'No entries');
  const changeText = (value: number | null) => value == null ? '—' : new Intl.NumberFormat(locale, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value) + '%';
  const from = range === 'month' ? month + '-01' : range === 'year' ? year + '-01-01' : undefined;
  const filters = { q: query.trim(), archived: archived ? 'all' : 'active', from, to: from ? today : undefined } as const;
  const rows = filterRecords(report.entries.filter(row => !group || financeGroup(row) === group), filters)
    .sort((a, b) => sort === 'amount' ? Number(a.amountKnown === false) - Number(b.amountKnown === false) || b.amountBani - a.amountBani :
      sort === 'old' ? (a.date || '9999').localeCompare(b.date || '9999') : (b.date || '').localeCompare(a.date || ''));
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visiblePage = Math.min(page, pages - 1);
  const vehicleNames = new Map(data.vehicles.map(car => [car.id, car.brand + ' ' + car.model]));
  const byRecord = new Map<string, Data['attachments']>();
  for (const file of data.attachments) {
    const existing = byRecord.get(file.recordId) ?? [];
    existing.push(file);
    byRecord.set(file.recordId, existing);
  }
  const exportUrl = (format: string) => '/api/v1/export?' + new URLSearchParams({
    finance: '1', format, archived: filters.archived, ...(vehicle ? { vehicleId: vehicle } : {}),
    ...(group ? { financeCategory: group } : {}), ...(filters.q ? { q: filters.q } : {}),
    ...(from ? { from, to: today } : {}),
  });
  const date = (value: string | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value + 'T12:00:00Z')) : '—';

  return <div className="ac-finance" data-workspace-ui>
    <section className="ac-finance-hero"><TitaniumWave />
      <div><span className="studio-kicker">AUTOCARE · FINANCE</span><h2>{t('Centrul financiar auto', 'Vehicle finance center')}</h2><p>{t('Costuri reale din cheltuieli, intervenții și documente, o singură dată per înregistrare.', 'Actual costs from expenses, service and documents, counted once per record.')}</p></div>
      <label>{t('Vehicul', 'Vehicle')}<select value={vehicle} onChange={e => { setVehicle(e.target.value); setPage(0); setPoint(null); }}>
        <option value="">{t('Toate vehiculele', 'All vehicles')}</option>{data.vehicles.map(car => <option key={car.id} value={car.id}>{car.brand} {car.model} · {car.plate}</option>)}
      </select></label>
    </section>
    <section className="ac-finance-kpis" aria-label={t('Rezumat financiar', 'Financial overview')}>
      {[
        [Wallet, t('Luna curentă', 'Current month'), report.monthKnown ? money(report.monthBani) : '—', t('Costuri înregistrate', 'Recorded costs')],
        [CalendarDays, t('Anul curent', 'Current year'), report.yearKnown ? money(report.yearBani) : '—', year],
        [BarChart3, t('Față de luna precedentă', 'Versus previous month'), report.monthKnown ? changeText(financialChange(report.monthBani, report.previousMonthBani)) : '—', report.previousMonthKnown ? money(report.previousMonthBani) : t('Fără înregistrări anterioare', 'No previous entries')],
        [Gauge, t('Cost mediu/km', 'Average cost/km'), data.premium && report.costPerKm != null ? money(report.costPerKm * 100) : '—', !data.premium ? 'Premium' : report.costPerKm == null ? t('Citiri insuficiente', 'Insufficient readings') : t('Estimare din citirile disponibile', 'Estimate from available readings')],
      ].map(([Icon, label, value, detail]) => {
        const MetricIcon = Icon as typeof Wallet;
        return <article key={String(label)} className="ac-finance-card"><MetricIcon size={18} aria-hidden="true" /><span>{String(label)}</span><strong>{String(value)}</strong><small>{String(detail)}</small></article>;
      })}
    </section>
    <div className="ac-finance-insights">
      <section className="ac-finance-card ac-finance-chart">
        <header><div><h3>{t('Evoluția cheltuielilor', 'Expense trends')}</h3><p>{view === 'year' ? year + ' / ' + (y - 1) : month + ' / ' + prevMonth}</p></div>
          <div className="ac-finance-toggle">{(['month', 'year'] as const).map(value => <button key={value} type="button" aria-pressed={view === value} onClick={() => { setView(value); setPoint(null); }}>{value === 'month' ? t('Lunar', 'Monthly') : t('Anual', 'Annual')}</button>)}</div>
        </header>
        {data.premium ? <>
          <div className="ac-finance-bars" data-daily={view === 'month' || undefined}>
            {chart.map((row, index) => <button type="button" key={row.label} className="ac-finance-bar" aria-label={row.label + ' · ' + details(row.current) + ' / ' + details(row.previous)} aria-pressed={point === index} onMouseEnter={() => setPoint(index)} onFocus={() => setPoint(index)} onClick={() => setPoint(index)}>
              <span aria-hidden="true" className="ac-finance-bar-pair">{[row.current, row.previous].map((value, series) => <i key={series} data-series={series} data-empty={!value.count || undefined} data-unknown={!!value.count && !value.known || undefined} style={{ height: value.known ? Math.max(3, value.bani / scale * 100) + '%' : '4%' }} />)}</span>
              <small>{row.label}</small>
            </button>)}
          </div>
          <p className="ac-finance-legend"><span>{t('Perioada curentă', 'Current period')}</span><span>{t('Perioada comparată', 'Comparison period')}</span></p>
          <p className="ac-finance-point"><strong>{shown.label}</strong> · {details(shown.current)} / {details(shown.previous)}</p>
        </> : <p>{t('Graficele comparative sunt disponibile în Premium.', 'Comparison charts are available in Premium.')}</p>}
      </section>
      <div className="ac-finance-side">
        <FinanceBudget key={budgetCar?.id ?? 'empty'} vehicle={budgetCar} amount={budgetCar ? data.financeBudgets[budgetCar.id] ?? null : null} used={budgetUsage} premium={data.premium} preview={preview} money={money} onRefresh={onRefresh} />
        <section className="ac-finance-card ac-finance-ai"><Sparkles size={22} /><h3>AutoCare AI Finance</h3><p>{t('Compară perioade, verifică unde se duc costurile și explorează sugestii pentru vehiculul ales.', 'Compare periods, review spending and explore suggestions for the selected vehicle.')}</p>
          <button type="button" className="primary" disabled={!budgetCar} onClick={() => budgetCar && onAi(budgetCar.id)}>{t('Deschide analiza', 'Open analysis')} <ArrowUpRight size={15} /></button>
        </section>
      </div>
    </div>
    {data.premium && <section className="ac-finance-categories" aria-label={t('Categorii financiare', 'Expense categories')}>
      {report.categories(view).map(item => <button key={item.group} type="button" className="ac-finance-card" aria-pressed={group === item.group} onClick={() => { setGroup(group === item.group ? '' : item.group); setRange(group === item.group ? 'all' : view); setPage(0); }}>
        <span>{groups[item.group]}</span><strong>{money(item.bani)}</strong>
        <progress max={100} value={item.share} aria-label={t('Pondere în total', 'Share of total')} />
        <small>{item.share.toLocaleString(locale, { maximumFractionDigits: 1 })}% · {changeText(item.change)}</small>
      </button>)}
    </section>}
    <section className="ac-finance-card ac-finance-history" aria-labelledby="ac-finance-history">
      <header><h3 id="ac-finance-history">{t('Istoric cheltuieli', 'Expense history')}</h3>
        <div className="ac-finance-toggle">{data.premium ? ['csv', 'pdf'].map(format => <a className="button" href={exportUrl(format)} key={format}><Download size={15} /> {format.toUpperCase()}</a>) : <a className="button" href="/cont?tab=Premium">{t('Export Premium', 'Premium export')}</a>}</div>
      </header>
      <div className="ac-finance-filters">
        <input type="search" maxLength={250} placeholder={t('Caută în cheltuieli…', 'Search expenses…')} aria-label={t('Caută cheltuieli', 'Search expenses')} value={query} onChange={e => { setQuery(e.target.value); setPage(0); }} />
        <select aria-label={t('Categorie', 'Category')} value={group} onChange={e => { setGroup(e.target.value); setPage(0); }}><option value="">{t('Toate categoriile', 'All categories')}</option>{Object.entries(groups).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
        <select aria-label={t('Perioadă', 'Period')} value={range} onChange={e => { setRange(e.target.value); setPage(0); }}><option value="all">{t('Tot istoricul', 'All history')}</option><option value="month">{t('Luna curentă', 'Current month')}</option><option value="year">{t('Anul curent', 'Current year')}</option></select>
        <select aria-label={t('Sortare', 'Sort order')} value={sort} onChange={e => { setSort(e.target.value); setPage(0); }}><option value="recent">{t('Cele mai recente', 'Newest first')}</option><option value="old">{t('Cele mai vechi', 'Oldest first')}</option><option value="amount">{t('Valoare descrescătoare', 'Highest value')}</option></select>
        <label className="check"><input type="checkbox" checked={archived} onChange={e => { setArchived(e.target.checked); setPage(0); }} /> {t('Include arhivate', 'Include archived')}</label>
      </div>
      {rows.length ? <table className="ac-finance-table"><thead><tr>{[
        t('Data', 'Date'), t('Vehicul', 'Vehicle'), t('Categorie', 'Category'), t('Descriere', 'Description'),
        t('Valoare', 'Amount'), t('Kilometraj', 'Mileage'), t('Documente', 'Documents'), t('Acțiuni', 'Actions'),
      ].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>
        {rows.slice(visiblePage * pageSize, (visiblePage + 1) * pageSize).map(row => <tr key={row.id}>
          <td data-label={t('Data', 'Date')}>{date(row.date)}</td>
          <td data-label={t('Vehicul', 'Vehicle')} data-user-content>{vehicleNames.get(row.vehicleId) ?? '—'}</td>
          <td data-label={t('Categorie', 'Category')}>{groups[financeGroup(row)]}</td>
          <td data-label={t('Descriere', 'Description')} data-user-content>{row.title}{row.cancelled && <small> · {t('Arhivată', 'Archived')}</small>}</td>
          <td data-label={t('Valoare', 'Amount')}><strong>{row.amountKnown === false ? '—' : money(row.amountBani)}</strong></td>
          <td data-label={t('Kilometraj', 'Mileage')}>{row.odometer == null ? '—' : row.odometer.toLocaleString(locale) + ' km'}</td>
          <td data-label={t('Documente', 'Documents')}>{byRecord.has(row.id) ? byRecord.get(row.id)!.map(file => <a href={'/api/v1/files/' + file.id + '?view=1'} key={file.id} target="_blank" rel="noopener noreferrer"><Paperclip size={13} />{file.name}</a>) : '—'}</td>
          <td data-label={t('Acțiuni', 'Actions')}><div className="ac-finance-toggle"><button type="button" onClick={() => onEdit(row)}>{t('Editează', 'Edit')}</button>{!row.cancelled && <button type="button" onClick={() => onArchive(row)}>{t('Arhivează', 'Archive')}</button>}</div></td>
        </tr>)}
      </tbody></table> : <p role="status">{t('Nu există cheltuieli care să corespundă selecției.', 'No expenses match the selection.')}</p>}
      {pages > 1 && <nav className="ac-finance-toggle" aria-label={t('Pagini istoric', 'Expense history pages')}><button type="button" disabled={!visiblePage} onClick={() => setPage(visiblePage - 1)}>{t('Anterior', 'Previous')}</button><span>{visiblePage + 1} / {pages}</span><button type="button" disabled={visiblePage + 1 >= pages} onClick={() => setPage(visiblePage + 1)}>{t('Următor', 'Next')}</button></nav>}
    </section>
  </div>;
}

function FinanceBudget({ vehicle, amount, used, premium, preview, money, onRefresh }: {
  vehicle?: Data['vehicles'][number]; amount: number | null; used: number; premium: boolean; preview: boolean;
  money: (bani: number) => string; onRefresh: () => Promise<void>;
}) {
  const en = useApplicationLanguage() === 'en';
  const t = (ro: string, english: string) => en ? english : ro;
  const [value, setValue] = useState(amount == null ? '' : (amount / 100).toFixed(2));
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState(false);
  const state = amount ? budgetState(amount, used) : null;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!vehicle || preview || pending) return;
    setPending(true); setMessage(''); setError(false);
    try {
      const response = await fetch('/api/v1/finance/budget', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleId: vehicle.id, amountBani: value === '' ? null : Math.round(Number(value) * 100) }),
      });
      if (!response.ok) throw Error((await response.json()).error);
      await onRefresh();
      setMessage(t('Bugetul a fost actualizat.', 'Budget updated.'));
    } catch (cause) { setError(true); setMessage((cause as Error).message); }
    finally { setPending(false); }
  }
  return <section className="ac-finance-card ac-finance-budget">
    <h3>{t('Buget lunar', 'Monthly budget')}</h3>
    {vehicle && <p data-user-content>{vehicle.brand} {vehicle.model} · {vehicle.plate}</p>}
    {!premium ? <p>{t('Bugetele pe vehicul sunt disponibile în Premium.', 'Vehicle budgets are available in Premium.')}</p> : vehicle && <>
      {state && <><strong>{money(used)} / {money(amount!)}</strong>
        <progress max={100} value={Math.min(100, state.percent)} aria-label={t('Buget consumat', 'Budget used')} />
        <p>{state.remaining < 0 ? t('Depășit cu ', 'Over by ') : t('Rămas ', 'Remaining ')}{money(Math.abs(state.remaining))} · {state.percent.toFixed(0)}%</p>
        {!!state.threshold && <p className="ac-finance-budget-alert" role="status">{t('Prag atins', 'Threshold reached')} · {state.threshold}%</p>}
      </>}
      <form onSubmit={save}><label>{t('Limită lunară (RON)', 'Monthly limit (RON)')}<input type="number" min=".01" max="1000000" step=".01" value={value} onChange={e => setValue(e.target.value)} placeholder="—" /></label>
        <button type="submit" disabled={pending || preview}>{value ? t('Salvează bugetul', 'Save budget') : t('Elimină limita', 'Remove limit')}</button></form>
      {message && <p role={error ? 'alert' : 'status'}>{message}</p>}
    </>}
  </section>;
}
