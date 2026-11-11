'use client';
import VehicleSymbol from '../vehicle-symbol';
import { translateApplicationCopy } from '@/lib/application-language';

import {
  Archive, ArrowUpRight, CalendarDays, CarFront, Check, FileText, Gauge, Layers3,
  Pencil, Plus, Search, Sparkles, Wallet, Wrench,
} from 'lucide-react';
import type { dashboard } from '@/lib/service';
import { garageOverview, garageVehicleSummary } from '@/lib/garage-overview';
import { TitaniumWave } from '../titanium-wave';
import InlineMileageEditor from '../inline-mileage-editor';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import './garage.css';

type Data = Awaited<ReturnType<typeof dashboard>>;
type Vehicle = Data['vehicles'][number];

type Props = {
  data: Data;
  vehicles: Vehicle[];
  primaryId: string;
  today: string;
  query: string;
  showArchived: boolean;
  busy: boolean;
  preview: boolean;
  money: (bani: number) => string;
  onQuery: (query: string) => void;
  onShowArchived: (show: boolean) => void;
  onAdd: () => void;
  onDetails: (id: string) => void;
  onAi: (id: string) => void;
  onEdit: (vehicle: Vehicle) => void;
  onDocuments: (id: string) => void;
  onArchive: (vehicle: Vehicle) => void;
  onSelect: (id: string) => void;
  onRefresh: () => Promise<void>;
};

export function ApplicationGarage({
  data, vehicles, primaryId, today, query, showArchived, busy, preview, money,
  onQuery, onShowArchived, onAdd, onDetails, onAi, onEdit, onDocuments, onArchive, onSelect, onRefresh,
}: Props) {
  const english = useApplicationLanguage() === 'en';
  const locale = useApplicationLocale();
  const t = (ro: string, en: string) => english ? en : ro;
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' });
  const { records, totals } = garageOverview(data, today);
  const maintenanceLabels: Record<string, string> = {
    valid: t('În termen', 'Within interval'),
    soon: t('Se apropie', 'Due soon'),
    due: t('La termen', 'Due'),
    overdue: t('Depășită', 'Overdue'),
    unscheduled: t('Neplanificată', 'Not scheduled'),
  };
  return (
    <div className="ac-garage-page" data-workspace-ui>
      <section aria-labelledby="ac-garage-vehicles-title" className="ac-garage-inventory">
        <header className="ac-garage-bar">
          <div>
            <h2 id="ac-garage-vehicles-title">{t('Vehiculele tale', 'Your vehicles')}</h2>
            <p>{number.format(totals.active)} {totals.active === 1 ? t('vehicul activ', 'active vehicle') : t('vehicule active', 'active vehicles')}</p>
          </div>
          <div className="ac-garage-filters">
            {data.vehicles.length > 1 && (
              <label className="ac-garage-search">
                <Search size={17} aria-hidden="true" />
                <input type="search" aria-label={t('Caută un vehicul', 'Find a vehicle')} placeholder={t('Marcă, model sau număr…', 'Make, model or plate…')} value={query} onChange={event => onQuery(event.target.value)} />
              </label>
            )}
            {data.vehicles.some(vehicle => vehicle.archived) && (
              <label className="check"><input type="checkbox" checked={showArchived} onChange={event => onShowArchived(event.target.checked)} />{t('Arată și vehiculele arhivate', 'Include archived vehicles')}</label>
            )}
          </div>
        </header>
        <div className="ac-garage-vehicles">
          {vehicles.map(vehicle => {
            const primary = !vehicle.archived && primaryId === vehicle.id;
            const { activeDocuments, maintenance, deadline } = garageVehicleSummary(records.get(vehicle.id) ?? [], vehicle.odometer, data.profile.timezone);
            const deadlineText = deadline
              ? date.format(new Date(deadline.date + 'T12:00:00Z'))
              : maintenance?.service.nextKm != null ? number.format(maintenance.service.nextKm) + ' km' : '—';
            return (
              <article key={vehicle.id} className="ac-garage-vehicle" data-primary={primary || undefined} aria-labelledby={'ac-garage-vehicle-' + vehicle.id}>
                <div className="ac-garage-identity">
                  <TitaniumWave />
                  <VehicleSymbol compact/>
                  <div className="ac-garage-identity-main">
                    <span className="ac-garage-plate" data-user-content>{vehicle.plate}</span>
                    <span className="ac-garage-badge" data-status={vehicle.archived ? 'archived' : primary ? 'primary' : 'active'}>
                      {primary && <Check size={13} aria-hidden="true" />}
                      {vehicle.archived ? t('Arhivat', 'Archived') : primary ? t('Vehicul principal', 'Primary vehicle') : t('Activ', 'Active')}
                    </span>
                  </div>
                  <h3 id={'ac-garage-vehicle-' + vehicle.id} data-user-content>{vehicle.brand} {vehicle.model}</h3>
                  <p>{vehicle.year} · <span data-user-content>{translateApplicationCopy(vehicle.fuel,english?'en':'ro')}{vehicle.engine ? ' · ' + vehicle.engine : ''}{vehicle.capacity ? ' · ' + number.format(vehicle.capacity) + ' cm³' : ''}</span></p>
                </div>
                <div className="ac-garage-mileage">
                  <Gauge size={21} aria-hidden="true" />
                  <div><span>{t('Kilometraj înregistrat', 'Recorded odometer')}</span><strong>{number.format(vehicle.odometer)} <small>km</small></strong></div>
                </div>
                <dl className="ac-garage-metrics">
                  <div><dt><FileText size={14} />{t('Documente active', 'Active documents')}</dt><dd>{number.format(activeDocuments)}</dd></div>
                  <div><dt><CalendarDays size={14} />{deadline?.overdue ? t('Scadență depășită', 'Overdue deadline') : t('Următoarea scadență', 'Next deadline')}</dt><dd data-status={deadline?.overdue ? 'overdue' : undefined}>{deadlineText}</dd>{(deadline || maintenance?.service.nextKm != null) && <small data-user-content>{deadline?.title ?? maintenance?.service.title}</small>}</div>
                  <div><dt><Wrench size={14} />{t('Mentenanță', 'Maintenance')}</dt><dd data-status={maintenance?.status.state}>{maintenanceLabels[maintenance?.status.state ?? 'unscheduled'] ?? maintenanceLabels.unscheduled}</dd></div>
                </dl>
                <div className="ac-garage-document-strip">{['ITP','RCA','Rovinietă'].map(kind=>{const doc=(records.get(vehicle.id)??[]).find(r=>r.kind==='document'&&r.category===kind);return <button type="button" key={kind} onClick={()=>onDocuments(vehicle.id)}><FileText size={13}/><span>{kind==='Rovinietă'?t('Rovinietă','Vignette'):kind}</span><small>{!doc?t('Lipsește','Missing'):doc.status.days==null?'—':doc.status.days<0?t('Expirat','Expired'):doc.status.days+' '+t('zile','days')}</small></button>})}</div>
                <div className="ac-garage-actions">
                  <button type="button" className="primary" onClick={() => onDetails(vehicle.id)}>{t('Vezi detalii', 'View details')} <ArrowUpRight size={15} /></button>
                  <button type="button" disabled={busy || vehicle.archived} onClick={() => onEdit(vehicle)}><Pencil size={15} />{t('Editează', 'Edit')}</button>
                  <button type="button" onClick={() => onDocuments(vehicle.id)}><FileText size={15} />{t('Documente', 'Documents')}</button>
                  {!vehicle.archived && <button type="button" className="ac-garage-archive" disabled={busy} onClick={() => onArchive(vehicle)}><Archive size={15} />{t('Arhivează', 'Archive')}</button>}
                </div>
                {!vehicle.archived && (
                  <div className="ac-garage-secondary">
                    <button type="button" onClick={() => onAi(vehicle.id)}><Sparkles size={15} />{t('Analizează cu AI', 'Analyze with AI')}</button>
                    <InlineMileageEditor vehicleId={vehicle.id} currentKm={vehicle.odometer} preview={preview} onSaved={onRefresh} />
                    <button type="button" aria-pressed={primary} disabled={busy} onClick={() => onSelect(vehicle.id)}>
                      {primary ? t('Selectat pentru Acasă', 'Selected for Home') : t('Setează ca principal', 'Set as primary')}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
          {!vehicles.length && data.vehicles.length > 0 && <p className="ac-garage-no-results" role="status">{t('Niciun vehicul nu corespunde filtrelor active.', 'No vehicles match the current filters.')}</p>}
          <article className="ac-garage-add">
            <span className="ac-garage-icon"><CarFront size={25} aria-hidden="true" /></span>
            <div><h3>{t('Adaugă un vehicul', 'Add a vehicle')}</h3><p>{t('Extinde-ți garajul digital', 'Expand your digital garage')}</p></div>
            <button type="button" className="primary" disabled={busy} onClick={onAdd}><Plus size={17} />{t('Adaugă mașină', 'Add vehicle')}</button>
          </article>
        </div>
      </section>
      <section className="ac-garage-numbers" aria-labelledby="ac-garage-numbers-title">
        <header><h2 id="ac-garage-numbers-title">{t('Garajul tău în cifre', 'Your garage in numbers')}</h2><p>{t('Totalurile istorice includ vehiculele arhivate. Documentele active sunt cele valabile sau fără expirare, de pe vehiculele active.', 'Historical totals include archived vehicles. Active documents are valid or non-expiring documents for active vehicles.')}</p></header>
        <dl>
          {[
            { Icon: Layers3, label: t('Total vehicule', 'Total vehicles'), value: number.format(totals.vehicles) },
            { Icon: Gauge, label: t('Kilometri înregistrați', 'Recorded kilometers'), value: number.format(totals.kilometers) + ' km' },
            { Icon: Wallet, label: t('Cheltuieli totale', 'Total expenses'), value: money(totals.costs) },
            { Icon: Wrench, label: t('Intervenții efectuate', 'Completed services'), value: number.format(totals.services) },
            { Icon: FileText, label: t('Documente active', 'Active documents'), value: number.format(totals.documents) },
          ].map(({ Icon, label, value }) => <div key={label}><dt><span className="ac-garage-icon"><Icon size={17} aria-hidden="true" /></span>{label}</dt><dd>{value}</dd></div>)}
        </dl>
      </section>
    </div>
  );
}
