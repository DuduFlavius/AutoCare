'use client';
import { useState } from 'react';
import { dashboardHome } from '@/lib/dashboard-home';
import {
  ArrowUpRight,
  CarFront,
  Gauge,
  Files,
  Wrench,
  Wallet,
  CalendarDays,
  ArrowRight,
  Plus,
  CheckCircle2,
  AlertTriangle,
  FileText,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
type Entry = Data['records'][number];
const money = (value: number) =>
  new Intl.NumberFormat('ro-RO', { style: 'currency', currency: 'RON' }).format(value / 100);
const date = (value: string | null) =>
  value
    ? new Date(value + 'T12:00:00').toLocaleDateString('ro-RO', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : 'Dată necompletată';
const kindNames: Record<string, string> = {
  document: 'Document',
  service: 'Întreținere',
  expense: 'Cheltuială',
};
export function GarageHome({
  data,
  navigate,
  add,
  open,
}: {
  data: Data;
  name: string;
  navigate: (tab: string) => void;
  add: (kind: 'vehicle' | 'document' | 'service' | 'expense') => void;
  open: (record: Entry) => void;
}) {
  const home = dashboardHome(data);
  const { cars, records, attention: due } = home;
  const [selectedCar, setSelectedCar] = useState('');
  const car = cars.find((v) => v.id === selectedCar) || cars[0];
  const carDocuments = home.documents.filter((r) => r.vehicleId === car?.id);
  const nextRecords = home.upcoming;
  // Keep dashboard in sync with existing service records, including oil intervals
  // entered in the detailed intervention form before nextKm was persisted.
  const oilChanges = home.services.filter((r) => {
    if (r.vehicleId !== car?.id) return false;
    const label = [r.category, r.title].filter(Boolean).join(' ').toLocaleLowerCase('ro-RO');
    return /ulei/.test(label) && /(schimb|motor|revizie)/.test(label);
  }).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.odometer ?? 0) - (a.odometer ?? 0));
  const lastOil = oilChanges[0];
  const savedOilInterval = lastOil?.parts?.match(/(?:^|\\n)\\[ac:intervalUlei\\]:\\s*(\\d+(?:[.,]\\d+)?)/)?.[1];
  const parsedOilInterval = savedOilInterval ? Number(savedOilInterval.replace(',', '.')) : null;
  const nextOilKm = lastOil?.nextKm ?? (
    lastOil?.odometer != null && parsedOilInterval !== null && Number.isFinite(parsedOilInterval) && parsedOilInterval > 0
      ? lastOil.odometer + parsedOilInterval
      : null
  );
  const oilKmRemaining = nextOilKm === null || !car ? null : nextOilKm - car.odometer;


  const documentSoon = carDocuments.filter((r) => r.status.days !== null && r.status.days >= 0 && r.status.days <= 30).length;
  const documentExpired = carDocuments.filter((r) => r.status.days !== null && r.status.days < 0).length;
  const vehicle = (id: string) => {
    const v = cars.find((v) => v.id === id);
    return v ? `${v.brand} ${v.model} · ${v.plate}` : 'Mașină';
  };
  // Premium dashboard: all values are sourced from the signed-in user's records.
  // The existing detailed overview remains below for compatibility.
  return (
    <div className="ac-premium-dashboard">
      {cars.length > 1 && (
        <label className="ac-premium-car-selector">Mașina afișată
          <select value={car?.id || ''} onChange={(e) => setSelectedCar(e.target.value)}>
            {cars.map((v) => <option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}
          </select>
        </label>
      )}
      <div className="ac-premium-overview">
        <section className="ac-premium-vehicle ac-premium-panel">
          <div className="ac-premium-vehicle-top">
            <span className="ac-premium-kicker"><CarFront size={17}/> MAȘINA TA</span>
            <span className="ac-premium-status">{car ? 'Activă' : 'Garaj gol'}</span>
          </div>
          <div className="ac-premium-vehicle-content">
            <div className="ac-premium-car-visual ac-lux-car-visual">
              <div className="ac-lux-car-glow" aria-hidden="true"/>
              <div className="ac-lux-car-emblem"><CarFront size={84} strokeWidth={1.25}/></div>
              <div className="ac-lux-car-floor" aria-hidden="true"/>
              <span className="ac-lux-car-label"><Sparkles size={13}/> AUTOCARE GARAGE</span>
            </div>
            <div className="ac-premium-car-description">
              <span className="ac-lux-car-eyebrow">GARAJ PERSONAL · VEHICUL SELECTAT</span>
              <h2>{car ? `${car.brand} ${car.model}` : 'Bine ai venit în AutoCare'}</h2>
              <p>{car ? [car.year,car.fuel].filter(Boolean).join(' · ') : 'Adaugă prima mașină pentru a începe.'}</p>
              {car && <span className="ac-premium-plate">{car.plate}</span>}
              <button type="button" onClick={() => car ? navigate('Garaj') : add('vehicle')}>
                {car ? 'Deschide garajul' : 'Adaugă prima mașină'} <ArrowRight size={16}/>
              </button>
            </div>
          </div>
          <div className="ac-premium-vehicle-footer">
            <div><span>Kilometraj actual</span><strong>{car ? `${car.odometer.toLocaleString('ro-RO')} km` : '—'}</strong></div>
            <div><span>Documente înregistrate</span><strong>{carDocuments.length}</strong></div>
            <button type="button" onClick={() => navigate('Garaj')}>Vezi detalii <ArrowRight size={15}/></button>
          </div>
        </section>
        <section className="ac-premium-odometer ac-premium-panel">
          <span className="ac-premium-kicker"><Gauge size={18}/> URMĂTORUL SCHIMB DE ULEI</span>
          <div className="ac-oil-hero">
            <div className="ac-oil-bottle" aria-hidden="true"><span>OIL</span><strong>5W-30</strong></div>
            <div className="ac-oil-info">
              <strong className="ac-oil-next">{nextOilKm === null ? 'Neconfigurat' : `La ${nextOilKm.toLocaleString('ro-RO')} km`}</strong>
              <span>{oilKmRemaining === null ? 'Setează intervalul de schimb' : oilKmRemaining < 0 ? `Depășit cu ${Math.abs(oilKmRemaining).toLocaleString('ro-RO')} km` : `${oilKmRemaining.toLocaleString('ro-RO')} km rămași`}</span>
              <div className="ac-oil-progress" role="progressbar" aria-label="Progres până la schimbul de ulei" aria-valuemin={0} aria-valuemax={100} aria-valuenow={lastOil?.odometer != null && nextOilKm != null && nextOilKm > lastOil.odometer ? Math.min(100, Math.max(0, Math.round((car!.odometer - lastOil.odometer) / (nextOilKm - lastOil.odometer) * 100))) : 0}>
                <i style={{width: `${lastOil?.odometer != null && nextOilKm != null && nextOilKm > lastOil.odometer ? Math.min(100, Math.max(0, (car!.odometer - lastOil.odometer) / (nextOilKm - lastOil.odometer) * 100)) : 0}%`}}/>
              </div>
            </div>
          </div>
          <div className="ac-oil-detail"><span>Ultimul schimb</span><strong>{lastOil?.odometer != null ? `${lastOil.odometer.toLocaleString('ro-RO')} km` : 'Neconfigurat'}</strong></div>
          <div className="ac-oil-detail"><span>Interval setat</span><strong>{lastOil?.odometer != null && nextOilKm !== null ? `${(nextOilKm - lastOil.odometer).toLocaleString('ro-RO')} km` : 'Neconfigurat'}</strong></div>
          <div className="ac-oil-detail"><span>Kilometraj actual</span><strong>{car ? `${car.odometer.toLocaleString('ro-RO')} km` : '—'}</strong></div>
          <button type="button" className="ac-premium-primary" onClick={() => navigate('Întreținere')}>Vezi istoricul intervențiilor <ArrowRight size={16}/></button>
        </section>
        <section className="ac-premium-next ac-premium-panel">
          <span className="ac-premium-kicker"><Wrench size={17}/> URMĂTORUL TERMEN</span>
          {(() => {
            const next = nextRecords.find(r => r.vehicleId === car?.id);
            return next ? <button className="ac-premium-next-record" type="button" onClick={() => open(next)}>
              <strong>{next.category || next.title}</strong>
              <span>{date(next.expiresAt)}</span>
              <small>Deschide înregistrarea <ArrowRight size={13}/></small>
            </button> : <p className="ac-premium-empty">Nu există un termen viitor înregistrat pentru această mașină.</p>;
          })()}
          <div className="ac-premium-metric-strip"><span>Documente în atenție <strong>{documentSoon + documentExpired}</strong></span><span>Termene prioritare <strong>{due.length}</strong></span></div>
          <button type="button" onClick={() => navigate('Calendar')}>Vezi calendarul <ArrowRight size={16}/></button>
        </section>
      </div>
      <div className="ac-premium-bottom-grid">
        <section className="ac-premium-panel ac-premium-list">
          <div className="ac-premium-section-heading"><h3>Documente care expiră</h3><button type="button" onClick={() => navigate('Documente')}>Vezi toate <ArrowRight size={15}/></button></div>
          {home.documents.filter(r => r.status.days !== null && r.status.days <= 30).slice(0,3).map(r =>
            <button type="button" className="ac-premium-list-row" key={r.id} onClick={() => open(r)}><Files size={19}/><span><strong>{r.category || r.title}</strong><small>{vehicle(r.vehicleId)}</small></span><em>{r.status.days !== null && r.status.days < 0 ? 'Expirat' : `În ${r.status.days} zile`}</em></button>
          )}
          {!home.documentAttention && <p className="ac-premium-empty">Niciun document care necesită atenție.</p>}
        </section>
        <section className="ac-premium-panel ac-premium-list">
          <div className="ac-premium-section-heading"><h3>Ultimele intervenții</h3><button type="button" onClick={() => navigate('Întreținere')}>Vezi toate <ArrowRight size={15}/></button></div>
          {[...home.services].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,3).map(r =>
            <button type="button" className="ac-premium-list-row" key={r.id} onClick={() => open(r)}><Wrench size={19}/><span><strong>{r.category || r.title}</strong><small>{date(r.date)}</small></span><em>{r.odometer === null ? '—' : `${r.odometer.toLocaleString('ro-RO')} km`}</em></button>
          )}
          {!home.services.length && <p className="ac-premium-empty">Nu ai înregistrat încă intervenții.</p>}
        </section>
        <section className="ac-premium-panel ac-premium-list">
          <div className="ac-premium-section-heading"><h3>Cheltuieli recente</h3><button type="button" onClick={() => navigate('Cheltuieli')}>Vezi toate <ArrowRight size={15}/></button></div>
          {[...records].filter(r => ['expense','service'].includes(r.kind)).sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,3).map(r =>
            <button type="button" className="ac-premium-list-row" key={r.id} onClick={() => open(r)}><Wallet size={19}/><span><strong>{r.category || r.title}</strong><small>{date(r.date)}</small></span><em>{r.amountKnown === false ? 'Necunoscut' : money(r.amountBani)}</em></button>
          )}
          {!records.some(r => ['expense','service'].includes(r.kind)) && <p className="ac-premium-empty">Nu există cheltuieli înregistrate.</p>}
          <div className="ac-premium-month-total">Total luna curentă <strong>{money(home.monthBani)}</strong>{home.unknownCosts > 0 && <small> + {home.unknownCosts} costuri necunoscute</small>}</div>
        </section>
        <section className="ac-premium-panel ac-premium-quick">
          <h3>Acțiuni rapide</h3>
          <button type="button" onClick={() => add(cars.length ? 'service' : 'vehicle')}><Wrench size={19}/> Adaugă intervenție <Plus size={16}/></button>
          <button type="button" onClick={() => add(cars.length ? 'document' : 'vehicle')}><Files size={19}/> Adaugă document <Plus size={16}/></button>
          <button type="button" onClick={() => add(cars.length ? 'expense' : 'vehicle')}><Wallet size={19}/> Adaugă cheltuială <Plus size={16}/></button>
          <button type="button" onClick={() => navigate('Notificări')}><CalendarDays size={19}/> Notificări <ArrowRight size={16}/></button>
        </section>
      </div>
    </div>
  );
  return (
    <div className="overview-stack">
      {cars.length > 1 && (
        <label className="dashboard-car-select">
          Mașina selectată
          <select value={car?.id || ''} onChange={(e) => setSelectedCar(e.target.value)}>
            {cars.map((v) => (
              <option key={v.id} value={v.id}>
                {v.brand} {v.model} · {v.plate}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="autocare-dashboard-feature">
        <section className="autocare-digital-garage" aria-label="Mașina selectată">
          <div className="autocare-garage-art" aria-hidden="true">
            <div className="autocare-garage-art-ring autocare-garage-art-ring-outer" />
            <div className="autocare-garage-art-ring autocare-garage-art-ring-inner" />
            <div className="autocare-garage-art-core">
              <span className="autocare-garage-art-top">AUTOCARE</span>
              <Gauge size={60} strokeWidth={1.2} />
              <span className="autocare-garage-art-bottom">DIGITAL GARAGE</span>
            </div>
            <span className="autocare-garage-art-spark spark-one" />
            <span className="autocare-garage-art-spark spark-two" />
          </div>
          <div className="autocare-garage-kicker"><span className="autocare-status-dot"/> GARAJUL TĂU DIGITAL</div>
          <div className="autocare-garage-body">
            <div className="autocare-garage-symbol"><CarFront size={35} strokeWidth={1.7}/></div>
            <span className="autocare-garage-overline">{car ? [car.year,car.fuel].filter(Boolean).join(' · ') : 'BUN VENIT ÎN AUTOCARE'}</span>
            <h2>{car ? `${car.brand} ${car.model}` : 'Garajul tău începe aici'}</h2>
            <p>{car ? 'Toate informațiile importante despre mașina ta, într-un singur loc.' : 'Adaugă prima mașină și urmărește documentele, reviziile și cheltuielile.'}</p>
            {car && <div className="autocare-garage-plate"><span>RO</span><strong>{car.plate}</strong></div>}
          </div>
          <div className="autocare-garage-bottom">
            <div className="autocare-garage-metrics">
              {car ? <><span><strong>{car.odometer.toLocaleString('ro-RO')} km</strong><small>Kilometraj</small></span><span><strong>{car.fuel || '—'}</strong><small>Combustibil</small></span></> : <span><strong>Totul pregătit</strong><small>Adaugă prima mașină</small></span>}
            </div>
            <button onClick={() => car ? navigate('Garaj') : add('vehicle')}>{car ? 'Deschide garajul' : 'Adaugă mașină'} <ArrowUpRight size={16}/></button>
          </div>
        </section>
        <div className="autocare-dashboard-aside">
          <div className="autocare-upcoming-panel">
            <div className="autocare-panel-heading"><h3>Următoarele activități</h3><button onClick={() => navigate('Calendar')}>Vezi calendarul <ArrowUpRight size={16}/></button></div>
            {nextRecords.length ? (
              <div className="autocare-upcoming-list">
                {nextRecords.map((record) => {
                  const linkedCar = cars.find((v) => v.id === record.vehicleId);
                  return (
                    <button className="autocare-next-record" key={record.id} onClick={() => open(record)}>
                      <span className="autocare-next-icon"><CalendarDays size={20}/></span>
                      <span className="autocare-next-description">
                        <strong>{record.category || record.title}</strong>
                        <small>{linkedCar ? `${linkedCar.brand} ${linkedCar.model} · ${linkedCar.plate}` : 'Mașină'} · {record.kind === 'document' ? 'Document' : 'Întreținere'}</small>
                      </span>
                      <time>{date(record.expiresAt)}</time><ArrowRight size={17}/>
                    </button>
                  );
                })}
              </div>
            ) : <p className="autocare-no-activity">Nu ai termene viitoare înregistrate. Adaugă RCA, ITP sau o revizie pentru a le urmări aici.</p>}
          </div>
          <div className="autocare-document-stats">
            <button onClick={() => navigate('Documente')}><FileText size={23}/><strong>{carDocuments.length}</strong><span>Total documente</span></button>
            <button onClick={() => navigate('Documente')}><CheckCircle2 size={23}/><strong>{carDocuments.filter((r) => r.status.state === 'valid').length}</strong><span>În termen</span></button>
            <button onClick={() => navigate('Documente')}><AlertTriangle size={23}/><strong>{documentSoon}</strong><span>Expiră în 30 zile</span></button>
            <button onClick={() => navigate('Documente')}><ShieldAlert size={23}/><strong>{documentExpired}</strong><span>Expirate</span></button>
          </div>
        </div>
      </div>
      <div className="autocare-quick-actions">
        <button onClick={() => add('document')}><Files size={23}/><span><strong>Document nou</strong><small>Adaugă un document auto</small></span><ArrowRight size={21}/></button>
        <button onClick={() => add('service')}><Wrench size={23}/><span><strong>Lucrare de service</strong><small>Înregistrează o revizie sau reparație</small></span><ArrowRight size={21}/></button>
        <button onClick={() => add('expense')}><Wallet size={23}/><span><strong>Cheltuială nouă</strong><small>Adaugă o cheltuială</small></span><ArrowRight size={21}/></button>
      </div>
      <section className="for-you-section" aria-labelledby="for-you-title">
        <div className="section-title">
          <div>
            <p className="eyebrow">ESENȚIALUL, LA ÎNDEMÂNĂ</p>
            <h2 id="for-you-title">Pentru tine</h2>
          </div>
          <span className="micro">Din datele înregistrate în cont</span>
        </div>
        <div className="for-you-grid">
          <button
            className="card for-you-card"
            onClick={() => (home.upcoming[0] ? open(home.upcoming[0]) : navigate('Calendar'))}
          >
            <CalendarDays size={22} />
            <span>{home.upcoming[0]?.category || 'Următorul termen'}</span>
            <strong>
              {home.upcoming[0] ? date(home.upcoming[0].expiresAt) : 'Niciun termen planificat'}
            </strong>
            <p>{home.upcoming[0]?.title || 'Adaugă un document sau planifică o intervenție.'}</p>
            <ArrowUpRight size={16} />
          </button>
          <button className="card for-you-card" onClick={() => navigate('Documente')}>
            <Files size={22} />
            <span>Documente</span>
            <strong>
              {home.documents.length
                ? home.documentAttention + ' necesită atenție'
                : 'Primul document'}
            </strong>
            <p>
              {home.documents.length
                ? 'Consultă actele și datele lor de expirare.'
                : 'Adaugă primul document pentru a urmări data expirării.'}
            </p>
            <ArrowUpRight size={16} />
          </button>
          <button className="card for-you-card" onClick={() => navigate('Întreținere')}>
            <Wrench size={22} />
            <span>Întreținere</span>
            <strong>
              {home.services.length
                ? home.services.length + ' operațiuni în jurnal'
                : 'Istoricul începe cu tine'}
            </strong>
            <p>
              {home.services.length
                ? 'Revizii, reparații și detaliile intervențiilor.'
                : 'Înregistrează prima revizie pentru a-ți construi istoricul de service.'}
            </p>
            <ArrowUpRight size={16} />
          </button>
          <button className="card for-you-card" onClick={() => navigate('Cheltuieli')}>
            <Wallet size={22} />
            <span>Cheltuieli · luna curentă</span>
            <strong>
              {home.expenseCount ? money(home.monthBani) : 'Nicio cheltuială înregistrată'}
            </strong>
            <p>
              {home.unknownCosts
                ? home.unknownCosts + ' costuri necunoscute, excluse din total.'
                : home.expenseCount
                  ? 'Costuri cunoscute de service și cheltuieli.'
                  : 'Adaugă cheltuielile pentru a vedea cât te costă mașina.'}
            </p>
            <ArrowUpRight size={16} />
          </button>
        </div>
      </section>
      <section className="next-step card">
        <div>
          <p className="eyebrow">DE REȚINUT</p>
          <h3>{due.length ? 'Prioritățile tale' : 'Următorul pas'}</h3>
        </div>
        <div className="next-step-items">
          {due.length ? (
            due.slice(0, 3).map((r) => (
              <button key={r.id} onClick={() => open(r)}>
                <span
                  className={
                    'pill ' + (r.status.days !== null && r.status.days < 0 ? 'expired' : 'soon')
                  }
                >
                  {r.status.days !== null && r.status.days < 0
                    ? 'Termen depășit'
                    : r.expiresAt
                      ? date(r.expiresAt)
                      : 'Prag de kilometraj'}
                </span>
                <strong>{r.title}</strong>
                <small>{vehicle(r.vehicleId)}</small>
                <ArrowUpRight size={16} />
              </button>
            ))
          ) : (
            <div className="next-step-empty">
              <p>
                {!cars.length
                  ? 'Adaugă prima mașină pentru a începe.'
                  : !home.documents.length
                    ? 'Adaugă primul document și urmărește termenele importante.'
                    : !home.services.length
                      ? 'Înregistrează prima revizie și păstrează istoricul la îndemână.'
                      : 'Nu ai termene apropiate în înregistrările tale.'}
              </p>
              <button
                onClick={() =>
                  !cars.length
                    ? add('vehicle')
                    : !home.documents.length
                      ? add('document')
                      : !home.services.length
                        ? add('service')
                        : navigate('Calendar')
                }
              >
                {!cars.length
                  ? 'Adaugă mașină'
                  : !home.documents.length
                    ? 'Adaugă document'
                    : !home.services.length
                      ? 'Adaugă operațiune'
                      : 'Vezi calendarul'}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="dashboard-secondary-stats" aria-label="Rezumatul garajului">
        {[
          { title: 'Mașini', value: String(cars.length), tab: 'Garaj' },
          {
            title: 'Documente în termen · peste 30 zile',
            value: String(home.validDocuments),
            tab: 'Documente',
          },
          { title: 'Termene care necesită atenție', value: String(due.length), tab: 'Calendar' },
          {
            title: 'Costuri cunoscute · luna curentă',
            value: money(home.monthBani),
            tab: 'Cheltuieli',
          },
        ].map((stat) => (
          <button className="card stat" key={stat.title} onClick={() => navigate(stat.tab)}>
            <span className="small muted">{stat.title}</span>
            <strong className="value">{stat.value}</strong>
            <ArrowUpRight size={14} />
          </button>
        ))}
      </section>
      <div className="overview-columns">
        <section className="card">
          <div className="section-title">
            <div>
              <p className="eyebrow">MAȘINILE TALE</p>
              <h3>Acasă, în garaj.</h3>
            </div>
            <button className="close small" onClick={() => navigate('Garaj')}>
              Vezi garajul <ArrowUpRight size={16} />
            </button>
          </div>
          {cars.length ? (
            <div className="mini-garage">
              {cars.slice(0, 4).map((v) => (
                <button className="mini-vehicle" key={v.id} onClick={() => navigate('Garaj')}>
                  <div className="vehicle-visual autocare-vehicle-monogram"><CarFront size={43} strokeWidth={1.5}/></div>
                  <div className="mini-details">
                    <span className="micro">
                      {v.year} · {v.fuel}
                    </span>
                    <h3>
                      {v.brand} {v.model}
                    </h3>
                    <div className="between">
                      <span className="plate">{v.plate}</span>
                      <span className="small muted">{v.odometer.toLocaleString('ro-RO')} km</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="designed-empty">
              <CarFront size={42} strokeWidth={1} />
              <h3>Primul drum începe aici.</h3>
              <p>Adaugă mașina și păstrează toate informațiile ei împreună.</p>
              <button className="primary" onClick={() => add('vehicle')}>
                <Plus size={16} /> Adaugă prima mașină
              </button>
            </div>
          )}
        </section>
        <section className="card">
          <div className="section-title">
            <h3>Următoarele activități</h3>
            <button className="close small" onClick={() => navigate('Calendar')}>
              Vezi calendarul <ArrowRight size={14} />
            </button>
          </div>
          {records
            .filter((r) => r.status.days != null && r.status.days >= 0)
            .sort((a, b) => (a.expiresAt || '').localeCompare(b.expiresAt || ''))
            .slice(0, 4)
            .map((r) => (
              <button className="event-line" key={r.id} onClick={() => open(r)}>
                <span className="list-icon">
                  <CalendarDays size={17} />
                </span>
                <span className="list-grow">
                  <strong>{r.title}</strong>
                  <span className="micro">{vehicle(r.vehicleId)}</span>
                </span>
                <span className="micro">{date(r.expiresAt)}</span>
              </button>
            ))}
          {!records.some((r) => r.status.days != null && r.status.days >= 0) && (
            <p className="muted small">Nu ai activități viitoare înregistrate.</p>
          )}
        </section>
      </div>
      <div className="quick-actions">
        {[
          [Files, 'Document nou', 'document'],
          [Wrench, 'Lucrare de service', 'service'],
          [Wallet, 'Cheltuială nouă', 'expense'],
        ].map(([Icon, title, kind]) => (
          <button
            key={String(kind)}
            disabled={!cars.length}
            onClick={() => add(kind as 'document' | 'service' | 'expense')}
          >
            {typeof Icon !== 'string' && <Icon size={21} />}
            <span>{String(title)}</span>
            <Plus size={17} />
          </button>
        ))}
      </div>
      <section className="card">
        <div className="section-title">
          <div>
            <p className="eyebrow">JURNALUL GARAJULUI</p>
            <h3>Ultimele înregistrări</h3>
          </div>
          <button className="close small" onClick={() => navigate('Istoric auto')}>
            Vezi istoricul <ArrowUpRight size={16} />
          </button>
        </div>
        {records.length ? (
          records.slice(0, 5).map((r) => (
            <button className="event-line" key={r.id} onClick={() => open(r)}>
              <span className="list-icon">
                {r.kind === 'document' ? (
                  <Files size={19} />
                ) : r.kind === 'service' ? (
                  <Wrench size={19} />
                ) : (
                  <Wallet size={19} />
                )}
              </span>
              <span className="list-grow">
                <strong>{r.title}</strong>
                <span className="small muted">
                  {vehicle(r.vehicleId)} · {date(r.date)}
                </span>
              </span>
              <span className="small">
                {r.amountKnown === false
                  ? 'Cost necunoscut'
                  : r.amountBani
                    ? money(r.amountBani)
                    : kindNames[r.kind]}
              </span>
            </button>
          ))
        ) : (
          <p className="muted">Istoricul va prinde contur odată cu prima înregistrare.</p>
        )}
      </section>
    </div>
  );
}
export function VehicleJournal({ data, open }: { data: Data; open: (record: Entry) => void }) {
  const [car, setCar] = useState(''),
    [kind, setKind] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  const rows = data.records
    .filter(
      (r) =>
        (!car || r.vehicleId === car) &&
        (!kind || r.kind === kind) &&
        (!from || (!!r.date && r.date >= from)) &&
        (!to || (!!r.date && r.date <= to)),
    )
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return (
    <section className="card">
      <div className="toolbar">
        <select aria-label="Mașină" value={car} onChange={(e) => setCar(e.target.value)}>
          <option value="">Toate mașinile</option>
          {data.vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.brand} {v.model} · {v.plate}
            </option>
          ))}
        </select>
        <select
          aria-label="Tip de activitate"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="">Toate activitățile</option>
          {Object.entries(kindNames).map(([key, label]) => (
            <option value={key} key={key}>
              {label}
            </option>
          ))}
        </select>
        <label>
          De la
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          Până la
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
      </div>
      <p className="micro">
        Cronologia înregistrărilor existente, inclusiv cele arhivate. Fotografiile și citirile
        separate de kilometraj nu sunt incluse în această listă.
      </p>
      {rows.length ? (
        <div className="journal">
          {rows.map((r) => {
            const v = data.vehicles.find((v) => v.id === r.vehicleId);
            return (
              <button className="journal-entry" onClick={() => open(r)} key={r.id}>
                <span className="journal-date">
                  {date(r.date)}
                  <small>{kindNames[r.kind]}</small>
                </span>
                <span className="list-grow">
                  <strong>{r.title}</strong>
                  <span className="muted small">
                    {v?.brand} {v?.model} · {v?.plate}
                  </span>
                  <span className="small">
                    {r.odometer != null ? r.odometer.toLocaleString('ro-RO') + ' km' : ''}
                    {r.provider ? ' · ' + r.provider : ''}
                  </span>
                  {r.notes && <span className="small muted">{r.notes}</span>}
                  {r.cancelled && <span className="pill archived">Arhivat</span>}
                </span>
                <strong>{r.amountKnown === false ? 'Cost necunoscut' : money(r.amountBani)}</strong>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="designed-empty">
          <CalendarDays size={38} />
          <h3>Nicio înregistrare în această perioadă.</h3>
          <p>Schimbă filtrele sau adaugă documente, lucrări și cheltuieli.</p>
        </div>
      )}
    </section>
  );
}

export function VehicleSheet({
  data,
  id,
  open,
  edit,
}: {
  data: Data;
  id: string;
  open: (record: Entry) => void;
  edit: () => void;
}) {
  const v = data.vehicles.find((v) => v.id === id);
  if (!v) return null;
  const entries = data.records.filter((r) => r.vehicleId === id);
  const active = entries.filter((r) => !r.cancelled);
  const cost = active.reduce((sum, r) => sum + r.amountBani, 0);
  const readings = entries
    .filter((r) => r.odometer != null)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return (
    <div className="vehicle-sheet">
      <div className="sheet-overview">
        <div className="autocare-vehicle-sheet-symbol"><CarFront size={56} strokeWidth={1.5}/></div>
        <div>
          <p className="eyebrow">
            {v.year} · {v.fuel}
          </p>
          <h2>
            {v.brand} {v.model}
          </h2>
          <span className="plate">{v.plate}</span>
          <p className="muted small">
            {v.engine || 'Motorizare necompletată'}
            {v.capacity ? ' · ' + v.capacity + ' cm³' : ''}
            <br />
            VIN: {v.vin || 'Necompletat'}
          </p>
          <button onClick={edit}>Editează datele mașinii</button>
        </div>
      </div>
      <div className="stats">
        <div className="card">
          <span className="micro">Kilometraj actual</span>
          <h3>{v.odometer.toLocaleString('ro-RO')} km</h3>
        </div>
        <div className="card">
          <span className="micro">Cost total înregistrat</span>
          <h3>{money(cost)}</h3>
        </div>
        <div className="card">
          <span className="micro">Documente active</span>
          <h3>{active.filter((r) => r.kind === 'document').length}</h3>
        </div>
      </div>
      {v.notes && (
        <section className="card">
          <h3>Notițe</h3>
          <p className="small">{v.notes}</p>
        </section>
      )}
      <section className="card">
        <h3>Citiri de kilometraj din înregistrări</h3>
        {readings.length ? (
          readings.map((r) => (
            <div className="between small list-row" key={r.id}>
              <span>
                {date(r.date)} · {r.title}
              </span>
              <strong>{r.odometer?.toLocaleString('ro-RO')} km</strong>
            </div>
          ))
        ) : (
          <p className="muted small">
            Nu sunt disponibile citiri istorice în documente, lucrări sau cheltuieli.
          </p>
        )}
      </section>
      {(['document', 'service', 'expense'] as const).map((kind) => (
        <section className="card" key={kind}>
          <h3>
            {kind === 'document'
              ? 'Documente și atașamente'
              : kind === 'service'
                ? 'Istoric de service'
                : 'Cheltuieli'}
          </h3>
          {entries.filter((r) => r.kind === kind).length ? (
            entries
              .filter((r) => r.kind === kind)
              .map((r) => (
                <div key={r.id}>
                  <button className="event-line" onClick={() => open(r)}>
                    <span className="list-grow">
                      <strong>{r.title}</strong>
                      <span className="micro">
                        {date(r.date)}
                        {r.expiresAt ? ' · Termen: ' + date(r.expiresAt) : ''}
                      </span>
                    </span>
                    <span className="small">
                      {r.cancelled
                        ? 'Arhivat'
                        : r.amountKnown === false
                          ? 'Cost necunoscut'
                          : money(r.amountBani)}
                    </span>
                    <ArrowRight size={15} />
                  </button>
                  {data.attachments
                    .filter((f) => f.recordId === r.id)
                    .map((f) => (
                      <a
                        className="attachment-link small"
                        href={'/api/v1/files/' + f.id}
                        key={f.id}
                      >
                        {f.name} <ArrowUpRight size={13} />
                      </a>
                    ))}
                </div>
              ))
          ) : (
            <p className="muted small">Nicio înregistrare în această secțiune.</p>
          )}
        </section>
      ))}
    </div>
  );
}

export function ReminderInbox({ data, open }: { data: Data; open: (record: Entry) => void }) {
  const [view, setView] = useState('upcoming');
  const rows = data.records
    .filter(
      (r) => r.kind !== 'expense' && data.vehicles.some((v) => v.id === r.vehicleId && !v.archived),
    )
    .filter((r) =>
      view === 'archived'
        ? r.cancelled
        : !r.cancelled &&
          (view === 'expired'
            ? r.status.days != null && r.status.days < 0
            : view === 'incomplete'
              ? r.status.days == null
              : r.status.days != null && r.status.days >= 0),
    )
    .sort((a, b) => (a.expiresAt || '9999').localeCompare(b.expiresAt || '9999'));
  return (
    <section className="card">
      <div className="section-title">
        <div>
          <p className="eyebrow">DOCUMENTE ȘI SERVICE</p>
          <h3>Centrul de termene</h3>
        </div>
        <CalendarDays size={22} />
      </div>
      <div className="filter-pills">
        {[
          ['upcoming', 'Viitoare'],
          ['expired', 'Depășite'],
          ['incomplete', 'De completat'],
          ['archived', 'Arhivate'],
        ].map(([key, label]) => (
          <button key={key} aria-pressed={view === key} onClick={() => setView(key)}>
            {label}
          </button>
        ))}
      </div>
      {rows.length ? (
        rows.map((r) => {
          const v = data.vehicles.find((v) => v.id === r.vehicleId);
          return (
            <button className="event-line" key={r.id} onClick={() => open(r)}>
              <span className="list-icon">
                {r.kind === 'document' ? <Files size={18} /> : <Wrench size={18} />}
              </span>
              <span className="list-grow">
                <strong>{r.title}</strong>
                <span className="micro">
                  {v?.brand} {v?.model} · {v?.plate}
                </span>
                <span className="micro">
                  {r.expiresAt ? date(r.expiresAt) : 'Completează termenul din înregistrare'}
                </span>
              </span>
              <span className={'pill ' + r.status.state}>
                {r.cancelled
                  ? 'Arhivat'
                  : r.status.days == null
                    ? 'Fără termen'
                    : r.status.days < 0
                      ? 'Termen depășit'
                      : r.status.days <= 7
                        ? 'Prioritar'
                        : r.status.days <= 30
                          ? 'În curând'
                          : 'Planificat'}
              </span>
              <ArrowRight size={14} />
            </button>
          );
        })
      ) : (
        <div className="designed-empty compact">
          <CalendarDays size={30} />
          <h3>Niciun termen în această categorie.</h3>
          <p>Termenele apar după adăugarea documentelor și lucrărilor.</p>
        </div>
      )}
      <p className="micro">
        Deschide înregistrarea pentru a actualiza termenul. Arhivarea păstrează înregistrarea și
        oprește alertele asociate. Livrările prin e-mail și push apar separat mai jos.
      </p>
    </section>
  );
}
