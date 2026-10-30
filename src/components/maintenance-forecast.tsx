'use client';
import { useState } from 'react';
import ServiceForecastCards from './service-forecast-cards';
import { maintenanceTargets } from '@/lib/maintenance-schedule';
import { useApplicationLanguage } from './application-locale';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
export default function MaintenanceForecast({
  data,
  records,
  preview,
  onUpdateMileage,
  onUpgrade,
}: {
  data: Data;
  records: Data['records'];
  preview: boolean;
  onUpdateMileage?: () => void;
  onUpgrade?: () => void;
}) {
  const en = useApplicationLanguage() === 'en',
    [selected, setSelected] = useState('');
  const cars = data.vehicles.filter((v) => !v.archived);
  const car = cars.find((v) => v.id === selected) || cars[0];
  if (!data.premium)
    return (
      <section className="card ac-premium-locked" data-workspace-ui>
        <h3>
          {en ? 'Keep your next service in sight.' : 'Nu pierde din vedere următoarea revizie.'}
        </h3>
        <p>
          {en
            ? 'Premium combines time and mileage intervals, remaining days and kilometers, and configurable reminders in one workspace.'
            : 'Premium reunește intervalele după timp și kilometraj, zilele și kilometrii rămași și mementourile configurabile într-un singur spațiu.'}
        </p>
        {onUpgrade && (
          <button type="button" onClick={onUpgrade}>
            {en ? 'Discover Premium' : 'Descoperă Premium'}
          </button>
        )}
      </section>
    );
  if (!car) return null;
  const services = records
    .filter((r) => r.kind === 'service' && !r.cancelled && r.vehicleId === car.id)
    .flatMap(maintenanceTargets);
  return (
    <section className="card ac-all-maintenance-forecast" data-workspace-ui>
      <header>
        <h3>{en ? 'Maintenance · days & mileage' : 'Întreținere · zile și kilometri'}</h3>
        <p className="micro">
          {en
            ? 'For every saved service threshold, using confirmed mileage.'
            : 'Pentru fiecare prag salvat, pe baza kilometrajului confirmat.'}
        </p>
      </header>
      {cars.length > 1 && (
        <label>
          {en ? 'Vehicle' : 'Mașină'}
          <select value={car.id} onChange={(event) => setSelected(event.target.value)}>
            {cars.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model} · {v.plate}
              </option>
            ))}
          </select>
        </label>
      )}
      {services.length ? (
        <ServiceForecastCards
          vehicleId={car.id}
          currentKm={car.odometer}
          services={services}
          preview={preview}
          timezone={data.profile.timezone}
          onUpdateMileage={onUpdateMileage}
        />
      ) : (
        <p className="micro">
          {en
            ? 'Add a next mileage, a kilometer interval or a calendar deadline when editing a service record.'
            : 'Completează următorul kilometraj, un interval în kilometri sau un termen calendaristic la editarea intervenției.'}
        </p>
      )}
      <p className="micro">
        {en
          ? 'Intervals depend on the exact engine and maintenance schedule. For brakes and other wear parts, follow inspection results.'
          : 'Intervalele depind de motorul exact și de planul de service. Pentru frâne și alte piese de uzură, respectă rezultatul verificărilor.'}{' '}
        <a
          href="https://www.ford.ro/service/service-si-intretinere/accidente-si-reparatii/intervale"
          target="_blank"
          rel="noopener noreferrer"
        >
          {en ? 'Manufacturer guidance' : 'Recomandări producător'}
        </a>
      </p>
    </section>
  );
}
