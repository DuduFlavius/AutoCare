'use client';
import { useState } from 'react';
import MaintenanceForecast from './maintenance-forecast';
import { maintenanceTargets } from '@/lib/maintenance-schedule';
import { useApplicationLocale } from './application-locale';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
export default function PremiumOverview({
  data,
  language,
  preview,
  navigate,
}: {
  data: Data;
  language: 'ro' | 'en';
  preview: boolean;
  navigate: (tab: string) => void;
}) {
  const en = language === 'en',
    locale = useApplicationLocale(),
    [selected, setSelected] = useState('');
  const cars = data.vehicles.filter((v) => !v.archived),
    car = cars.find((v) => v.id === selected) || cars[0];
  const rows = data.records
    .filter((r) => !r.cancelled && r.kind === 'service' && r.vehicleId === car?.id)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const money = (bani: number) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: en ? 'EUR' : 'RON' }).format(
      bani / (en ? 500 : 100),
    );
  return (
    <section className="ac-premium-overview-dashboard" data-workspace-ui>
      <header>
        <p>{en ? 'PREMIUM ACTIVE · YOUR GARAGE' : 'PREMIUM ACTIV · GARAJUL TĂU'}</p>
        <h2>{en ? 'Your next journey starts here.' : 'Următorul drum începe aici.'}</h2>
        <span>
          {en
            ? 'Your tools, maintenance and downloads, without purchase offers.'
            : 'Instrumentele, întreținerea și descărcările tale, fără oferte de cumpărare.'}
        </span>
      </header>
      <div className="ac-premium-summary-grid">
        <article>
          <span>{en ? 'This month · all vehicles' : 'Luna aceasta · toate mașinile'}</span>
          <strong>{money(data.summary.monthBani)}</strong>
        </article>
        <article>
          <span>{en ? 'This year · recorded costs' : 'Anul curent · costuri înregistrate'}</span>
          <strong>{money(data.summary.annualBani)}</strong>
        </article>
        <article>
          <span>
            {en
              ? 'Cost per km · sufficient data required'
              : 'Cost per km · necesită date suficiente'}
          </span>
          <strong>
            {data.summary.costPerKm === null
              ? '—'
              : money(Math.round(data.summary.costPerKm * 100)) + '/km'}
          </strong>
        </article>
        <article>
          <span>{en ? 'Vehicles in your garage' : 'Mașini în garaj'}</span>
          <strong>
            {cars.length} <small>{en ? 'Unlimited with Premium' : 'Nelimitate cu Premium'}</small>
          </strong>
        </article>
      </div>
      {en && (
        <p className="micro">
          EUR amounts are indicative at EUR 1 ≈ RON 5. Saved costs remain in RON.
        </p>
      )}
      {car && (
        <>
          <label>
            {en ? 'Vehicle summary' : 'Rezumat mașină'}
            <select value={car.id} onChange={(e) => setSelected(e.target.value)}>
              {cars.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.brand} {v.model} · {v.plate}
                </option>
              ))}
            </select>
          </label>
          <p className="micro" data-user-content>
            {car.brand} {car.model} · {car.odometer.toLocaleString(locale)} km
          </p>
          <div className="ac-premium-target-grid">
            {[
              ['ulei', en ? 'Oil change' : 'Schimb ulei'],
              ['Distribuție', en ? 'Timing belt / chain' : 'Distribuție'],
              ['revizie', en ? 'General service' : 'Revizie generală'],
            ].map(([match, title]) => {
              const r = rows.find((r) =>
                  (r.category + ' ' + r.title)
                    .toLocaleLowerCase('ro-RO')
                    .includes(match.toLocaleLowerCase('ro-RO')),
                ),
                next = r ? maintenanceTargets(r)[0] : null;
              return (
                <article key={match}>
                  <span>{title}</span>
                  <strong>
                    {next?.nextKm != null
                      ? Math.max(0, next.nextKm - car.odometer).toLocaleString(locale) + ' km'
                      : en
                        ? 'Not scheduled'
                        : 'Neconfigurat'}
                  </strong>
                  <small>
                    {next?.expiresAt ||
                      (en
                        ? 'Set a deadline in the service record'
                        : 'Configurează termenul la intervenție')}
                  </small>
                  <button type="button" onClick={() => navigate('Întreținere')}>
                    {en ? 'Manage' : 'Gestionează'}
                  </button>
                </article>
              );
            })}
          </div>
        </>
      )}
      <MaintenanceForecast
        data={data}
        records={data.records}
        preview={preview}
        onUpdateMileage={() => navigate('Kilometraj')}
      />
      <div className="ac-premium-recent">
        <h3>{en ? 'Latest maintenance' : 'Ultimele intervenții'}</h3>
        {rows.slice(0, 3).map((r) => (
          <p key={r.id}>
            <strong data-user-content>{r.title}</strong>
            <span>
              {r.date} ·{' '}
              {r.amountKnown ? money(r.amountBani) : en ? 'Unknown cost' : 'Cost necunoscut'}
            </span>
          </p>
        ))}
        {!rows.length && (
          <p>
            {en
              ? 'Your saved service history will appear here.'
              : 'Istoricul intervențiilor salvate va apărea aici.'}
          </p>
        )}
      </div>
    </section>
  );
}
