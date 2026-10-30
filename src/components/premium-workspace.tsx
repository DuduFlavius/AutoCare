'use client';
import {
  CarFront,
  CalendarClock,
  Files,
  Wallet,
  History,
  BellRing,
  Gauge,
  Route,
  ArrowUpRight,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { premiumPriorities } from '@/lib/premium-priorities';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
const tools = [
  [
    'Garaj',
    CarFront,
    'Garajul meu',
    'My garage',
    'Toate mașinile, într-un singur loc.',
    'All your vehicles in one place.',
  ],
  [
    'Întreținere',
    CalendarClock,
    'Planificare întreținere',
    'Maintenance planning',
    'Intervenții și praguri după kilometraj.',
    'Service records and mileage thresholds.',
  ],
  [
    'Kilometraj',
    Gauge,
    'Estimări inteligente',
    'Mileage estimates',
    'Următorul schimb, estimat din citirile tale.',
    'Estimate your next service from your readings.',
  ],
  [
    'Documente',
    Files,
    'Documente și scadențe',
    'Documents & deadlines',
    'Acte, atașamente și date de expirare.',
    'Documents, attachments and expiry dates.',
  ],
  [
    'Cheltuieli',
    Wallet,
    'Costuri și exporturi',
    'Costs & exports',
    'Analizează cheltuielile și exportă istoricul.',
    'Review expenses and export your history.',
  ],
  [
    'Istoric auto',
    History,
    'Istoricul mașinii',
    'Vehicle history',
    'Urmărește lucrările și modificările înregistrate.',
    'Review recorded work and changes.',
  ],
  [
    'Notificări',
    BellRing,
    'Alerte și mementouri',
    'Alerts & reminders',
    'Vezi alertele și configurează preferințele.',
    'View alerts and configure your preferences.',
  ],
  [
    'Plan întreținere',
    Route,
    'SmartDrive GPS',
    'SmartDrive GPS',
    'Trasee și kilometraj confirmat separat.',
    'Trips alongside separately confirmed mileage.',
  ],
] as const;
export default function PremiumWorkspace({
  data,
  language,
  navigate,
  onRecord,
}: {
  data: Data;
  language: 'ro' | 'en';
  navigate: (tab: string) => void;
  onRecord: (record: Data['records'][number]) => void;
}) {
  const en = language === 'en',
    locale = en ? 'en-GB' : 'ro-RO';
  const priorities = data.premium ? premiumPriorities(data.records, data.vehicles) : [];
  return (
    <section className="ac-premium-tools" data-workspace-ui>
      <header>
        <span className="ac-premium-tools-mark">
          <ShieldCheck size={23} />
        </span>
        <div>
          <p>{en ? 'YOUR PREMIUM WORKSPACE' : 'SPAȚIUL TĂU PREMIUM'}</p>
          <h2>{en ? 'Useful tools. One place.' : 'Instrumente utile. Un singur loc.'}</h2>
        </div>
      </header>
      <p>
        {en
          ? 'The same tools are available with a paid subscription or access granted by the Founder.'
          : 'Aceleași instrumente sunt disponibile prin abonament plătit sau acces oferit de Fondator.'}
      </p>
      <div className="ac-premium-tools-grid">
        {tools.map(([tab, Icon, ro, eng, description, descriptionEn]) =>
          data.premium ? (
            <button type="button" key={tab} onClick={() => navigate(tab)}>
              <Icon size={21} />
              <strong>{en ? eng : ro}</strong>
              <span>{en ? descriptionEn : description}</span>
              <ArrowUpRight size={15} />
            </button>
          ) : (
            <article key={tab}>
              <Icon size={21} />
              <strong>{en ? eng : ro}</strong>
              <span>{en ? descriptionEn : description}</span>
            </article>
          ),
        )}
      </div>
      {data.premium && (
        <div className="ac-premium-priorities">
          <header>
            <AlertTriangle size={19} />
            <h3>{en ? 'Your next priorities' : 'Prioritățile tale'}</h3>
            <span>{priorities.length}</span>
          </header>
          <p>
            {en
              ? 'Saved deadlines within 30 days and service thresholds within 1,000 km.'
              : 'Termene salvate în următoarele 30 de zile și intervenții la cel mult 1.000 km distanță.'}
          </p>
          {priorities.length ? (
            priorities.slice(0, 6).map(({ record, days, remainingKm, overdue }) => {
              const car = data.vehicles.find((v) => v.id === record.vehicleId);
              return (
                <button
                  type="button"
                  className={overdue ? 'is-due' : ''}
                  key={record.id}
                  onClick={() => onRecord(record)}
                >
                  <span>
                    <strong data-user-content>{record.title || record.category}</strong>
                    <small data-user-content>
                      {car?.brand} {car?.model} · {car?.plate}
                    </small>
                  </span>
                  <span>
                    {days !== null && (
                      <small>
                        {days < 0
                          ? en
                            ? 'Expired'
                            : 'Termen depășit'
                          : days === 0
                            ? en
                              ? 'Due today'
                              : 'Scadent azi'
                            : en
                              ? 'In ' + days + ' days'
                              : 'În ' + days + ' zile'}
                      </small>
                    )}
                    {remainingKm !== null && (
                      <small>
                        {new Intl.NumberFormat(locale).format(Math.abs(remainingKm))}{' '}
                        {remainingKm < 0
                          ? en
                            ? 'km overdue'
                            : 'km depășiți'
                          : en
                            ? 'km remaining'
                            : 'km rămași'}
                      </small>
                    )}
                  </span>
                  <ArrowUpRight size={16} />
                </button>
              );
            })
          ) : (
            <div className="ac-premium-clear">
              <ShieldCheck size={20} />
              {en
                ? 'No upcoming deadlines among your saved records.'
                : 'Nu există termene apropiate în înregistrările salvate.'}
            </div>
          )}
          {priorities.length > 6 && (
            <button type="button" onClick={() => navigate('Calendar')}>
              {en ? 'Open the full calendar' : 'Deschide calendarul complet'}{' '}
              <ArrowUpRight size={15} />
            </button>
          )}
        </div>
      )}
    </section>
  );
}
