'use client';
import { useRef, useState, type FormEvent } from 'react';
import { CarFront, Files, Wrench, Paperclip, Check, ChevronDown } from 'lucide-react';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
type RecordItem = Data['records'][number];
const docs = ['RCA', 'ITP', 'Rovinietă', 'CASCO', 'Permis', 'Înmatriculare', 'Alt document'];
const operations = [
  'Revizie generală',
  'Schimb ulei',
  'Filtre',
  'Frâne',
  'Anvelope',
  'Baterie',
  'Distribuție',
  'Reparație',
  'ITP',
  'Altă operațiune',
];
export type RecordPayload = {
  kind: 'document' | 'service' | 'expense';
  vehicleId: string;
  category: string;
  title: string;
  date: string | null;
  expiresAt: string | null;
  nextKm: number | null;
  odometer: number | null;
  amountBani: number;
  amountKnown: boolean;
  provider: string;
  number: string;
  parts: string;
  notes: string;
};
export default function RecordEditor({
  kind,
  record,
  data,
  vehicleId,
  onSave,
  onCancel,
  onDirty,
}: {
  kind: 'document' | 'service' | 'expense';
  record?: RecordItem;
  data: Data;
  vehicleId?: string;
  onSave: (payload: RecordPayload, file: File | null) => Promise<boolean>;
  onCancel: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const cars = data.vehicles.filter((v) => !v.archived || v.id === record?.vehicleId);
  const [car, setCar] = useState(
      record?.vehicleId || vehicleId || cars[0]?.id || '',
    ),
    [category, setCategory] = useState(
      record?.category ||
        (kind === 'document' ? 'RCA' : kind === 'service' ? 'Schimb ulei' : 'Combustibil'),
    ),
    [serviceKmInterval, setServiceKmInterval] = useState('10000'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [details, setDetails] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [unknownCost, setUnknownCost] = useState(
      kind === 'document' ? false : record ? record.amountKnown === false : false,
    );
  const sent = useRef(false);
  const custom =
    !(kind === 'document' ? docs : operations).includes(category) ||
    category === 'Alt document' ||
    category === 'Altă operațiune' ||
    kind === 'expense';
  const brakeValue = (label: string) => {
    const line = (record?.parts || '').split('\\n').find((item) => item.startsWith(label + ': '));
    return line ? line.slice(label.length + 2) : '';
  };
  const mark = () => onDirty(true);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sent.current) return;
    const f = new FormData(e.currentTarget);
    const str = (k: string) => String(f.get(k) || '').trim();
    const num = (k: string) => (str(k) === '' ? null : Number(str(k)));
    const computedNextKm = kind === 'service' && category === 'Schimb ulei' && num('nextKm') === null && num('odometer') !== null && Number(serviceKmInterval) > 0 ? Number(num('odometer')) + Number(serviceKmInterval) : num('nextKm');
    setError('');
    if (!car) {
      setError('Alege mașina căreia îi aparține înregistrarea.');
      return;
    }
    if (str('date') && str('expiresAt') && str('expiresAt') < str('date')) {
      setError('Data expirării nu poate fi înaintea datei emiterii sau intervenției.');
      return;
    }
    if (
      file &&
      (file.size > 2097152 || !['application/pdf', 'image/png', 'image/jpeg'].includes(file.type))
    ) {
      setError('Atașează un PDF, JPEG sau PNG de maximum 2 MB.');
      return;
    }
    sent.current = true;
    setBusy(true);
    try {
      const okay = await onSave(
        {
          kind,
          vehicleId: car,
          category,
          title: custom ? str('title') : str('title') || category,
          date: str('date') || null,
          expiresAt: str('expiresAt') || null,
          nextKm: computedNextKm,
          odometer: num('odometer'),
          amountBani: unknownCost ? 0 : Math.round((num('amount') || 0) * 100),
          amountKnown: !unknownCost && str('amount') !== '',
          provider: str('provider'),
          number: str('number'),
          parts: kind === 'service' && category === 'Frâne'
            ? [
                str('parts').split('\\n').filter((line) => !/^(Piese frână|Producător frână|Preț piese frână|Manoperă frână): /.test(line)).join('\\n').trim(),
                ...([
                  ['Piese frână', str('brakePart')],
                  ['Producător frână', str('brakeMaker')],
                  ['Preț piese frână', str('brakePartsPrice') ? str('brakePartsPrice') + ' RON' : ''],
                  ['Manoperă frână', str('brakeLabor') ? str('brakeLabor') + ' RON' : ''],
                ] as const).filter(([, value]) => value).map(([label, value]) => label + ': ' + value),
              ].filter(Boolean).join('\\n')
            : str('parts'),
          notes: str('notes'),
        },
        file,
      );
      if (okay) onDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sent.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="quick-record-form" onSubmit={submit} onChange={mark}>
      <div className="record-editor-intro">
        <span>
          <CarFront size={21} />
        </span>
        <p>
          {kind === 'service'
            ? 'Înregistrează intervenția. Restul detaliilor pot aștepta.'
            : kind === 'document'
              ? 'Alege tipul actului, completează data expirării și apasă Salvează.'
              : 'Adaugă rapid un cost în istoricul mașinii.'}
        </p>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      <label>
        Pentru ce mașină?
        <select name="vehicleId" value={car} required onChange={(e) => setCar(e.target.value)}>
          <option value="" disabled>
            Alege mașina
          </option>
          {cars.map((v) => (
            <option key={v.id} value={v.id}>
              {v.brand} {v.model} · {v.plate}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="operation-picker">
        <legend>
          {kind === 'document'
            ? 'Tipul documentului'
            : kind === 'service'
              ? 'Tipul operațiunii'
              : 'Categoria cheltuielii'}
        </legend>
        <div>
          {(kind === 'document'
            ? docs
            : kind === 'service'
              ? operations
              : [
                  'Combustibil',
                  'Taxe',
                  'Asigurări',
                  'Revizii',
                  'Reparații',
                  'Anvelope',
                  'Parcare',
                  'Spălătorie',
                  'Altele',
                ]
          ).map((c) => (
            <button
              type="button"
              key={c}
              aria-pressed={category === c}
              onClick={() => {
                setCategory(c);
                mark();
              }}
            >
              {category === c ? (
                <Check size={13} />
              ) : kind === 'document' ? (
                <Files size={13} />
              ) : (
                <Wrench size={13} />
              )}{' '}
              {c}
            </button>
          ))}
        </div>
        <input name="category" value={category} readOnly hidden />
        {record &&
          !(
            kind === 'document'
              ? docs
              : kind === 'service'
                ? operations
                : [
                    'Combustibil',
                    'Taxe',
                    'Asigurări',
                    'Revizii',
                    'Reparații',
                    'Anvelope',
                    'Parcare',
                    'Spălătorie',
                    'Altele',
                  ]
          ).includes(category) && <p className="small">Categorie existentă: {category}</p>}
      </fieldset>
      {custom && (
        <label>
          {kind === 'document'
            ? 'Denumirea documentului'
            : kind === 'expense'
              ? 'Denumirea cheltuielii'
              : 'Denumirea operațiunii'}
          <input
            name="title"
            defaultValue={record?.title || ''}
            maxLength={250}
            required
            placeholder="Denumire clară și scurtă"
          />
        </label>
      )}
      <div className="form-grid">
        <label>
          {kind === 'document' ? 'Data emiterii · opțional' : 'Data intervenției'}
          <input
            type="date"
            name="date"
            required={kind !== 'document'}
            defaultValue={
              record?.date ||
              (kind === 'document'
                ? ''
                : new Date().toLocaleDateString('en-CA', { timeZone: data.profile.timezone }))
            }
          />
        </label>
        {kind === 'document' ? (
          <label>
            Data expirării · dacă este cazul
            <input type="date" name="expiresAt" defaultValue={record?.expiresAt || ''} />
            <small>Lasă liber dacă documentul nu are termen de expirare.</small>
          </label>
        ) : (
          <label>
            Kilometraj · opțional
            <input
              type="number"
              name="odometer"
              min={0}
              max={10000000}
              defaultValue={record?.odometer ?? ''}
              placeholder={
                data.vehicles.find((v) => v.id === car)?.odometer.toLocaleString('ro-RO') +
                ' km · ultima valoare'
              }
            />
          </label>
        )}
      </div>
      {kind === 'service' && category === 'Schimb ulei' && (
        <section className="service-oil-planner" aria-label="Planificare schimb ulei">
          <h3>Planifică următorul schimb de ulei</h3>
          <p className="micro">Alege intervalul recomandat pentru motorul tău. Nu este o recomandare automată a producătorului.</p>
          <div className="form-grid">
            <label>Interval în kilometri
              <select value={serviceKmInterval} onChange={(e) => { setServiceKmInterval(e.target.value); mark(); }}>
                <option value="5000">5.000 km</option>
                <option value="7500">7.500 km</option>
                <option value="10000">10.000 km</option>
                <option value="15000">15.000 km</option>
                <option value="20000">20.000 km</option>
                <option value="30000">30.000 km</option>
              </select>
            </label>
            <label>Următorul schimb (km)
              <output>{Number((record?.odometer ?? data.vehicles.find(v => v.id === car)?.odometer ?? 0) + Number(serviceKmInterval)).toLocaleString('ro-RO')} km estimativ</output>
            </label>
          </div>
          <p className="micro">Introdu kilometrajul real al intervenției mai sus pentru calcul corect. Poți suprascrie pragul în „Detalii suplimentare”.</p>
        </section>
      )}
      {kind === 'service' && category === 'Frâne' && (
        <section className="service-brake-details" aria-label="Detalii intervenție frâne">
          <h3>Detalii frâne</h3>
          <p className="micro">Completează piesele schimbate, producătorul și costurile. Datele se păstrează în istoricul lucrării.</p>
          <div className="form-grid">
            <label>Ce piese ai schimbat?
              <select name="brakePart" defaultValue={brakeValue('Piese frână')}>
                <option value="">Selectează piesele</option>
                <option value="Plăcuțe față">Plăcuțe față</option>
                <option value="Plăcuțe spate">Plăcuțe spate</option>
                <option value="Discuri față">Discuri față</option>
                <option value="Discuri spate">Discuri spate</option>
                <option value="Discuri și plăcuțe față">Discuri și plăcuțe față</option>
                <option value="Discuri și plăcuțe spate">Discuri și plăcuțe spate</option>
                <option value="Lichid de frână">Lichid de frână</option>
                <option value="Altă intervenție la frâne">Altă intervenție la frâne</option>
              </select>
            </label>
            <label>Producător / marcă piese
              <input name="brakeMaker" maxLength={120} defaultValue={brakeValue('Producător frână')} placeholder="Ex.: ATE, Brembo, TRW" />
            </label>
            <label>Preț piese (RON)
              <input name="brakePartsPrice" type="number" min="0" max="1000000" step="0.01" defaultValue={brakeValue('Preț piese frână').replace(' RON', '')} placeholder="0,00" />
            </label>
            <label>Manoperă (RON)
              <input name="brakeLabor" type="number" min="0" max="1000000" step="0.01" defaultValue={brakeValue('Manoperă frână').replace(' RON', '')} placeholder="0,00" />
            </label>
          </div>
          <p className="micro">Costul total al lucrării se introduce în câmpul „Cost · RON” de mai jos.</p>
        </section>
      )}
      {kind === 'service' && category === 'Baterie' && (
        <p className="micro service-oil-planner">Pentru baterie, notează marca, modelul, capacitatea (Ah) și garanția în „Piese și materiale”. Costul și kilometrajul rămân disponibile.</p>
      )}
      {kind === 'document' && (
        <label>
          Număr sau serie · opțional
          <input name="number" maxLength={250} defaultValue={record?.number || ''} />
        </label>
      )}
      {kind !== 'document' && (
        <div className="cost-field">
          <label>
            Cost · RON
            <input
              type="number"
              inputMode="decimal"
              name="amount"
              min={0}
              max={1000000}
              step="0.01"
              disabled={unknownCost}
              defaultValue={record && record.amountKnown !== false ? record.amountBani / 100 : ''}
              placeholder="0,00"
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={unknownCost}
              onChange={(e) => setUnknownCost(e.target.checked)}
            />
            Costul nu este cunoscut încă
          </label>
          <p className="micro">Pentru o operațiune gratuită, debifează și introdu 0.</p>
        </div>
      )}
      <details
        open={details}
        onToggle={(e) => setDetails(e.currentTarget.open)}
        className="record-extra"
      >
        <summary>
          Detalii suplimentare <ChevronDown size={15} />
        </summary>
        <div className="stack">
          {kind !== 'document' && (
            <>
              <label>
                Service sau furnizor
                <input name="provider" maxLength={250} defaultValue={record?.provider || ''} />
              </label>
              <label>
                Număr factură
                <input name="number" maxLength={250} defaultValue={record?.number || ''} />
              </label>
              <label>
                Descrierea lucrării
                <input
                  name="title"
                  maxLength={250}
                  defaultValue={custom ? '' : record?.title || ''}
                  disabled={custom}
                  placeholder={category}
                />
              </label>
              <label>
                Piese și materiale
                <textarea name="parts" maxLength={4000} defaultValue={record?.parts || ''} />
              </label>
            </>
          )}
          {kind === 'document' && (
            <label>
              Furnizor sau emitent
              <input name="provider" maxLength={250} defaultValue={record?.provider || ''} />
            </label>
          )}
          {kind === 'document' && (
            <label>
              Cost document · RON, opțional
              <input
                name="amount"
                type="number"
                step="0.01"
                min={0}
                max={1000000}
                defaultValue={record && record.amountKnown !== false ? record.amountBani / 100 : ''}
              />
            </label>
          )}
          {kind === 'service' && (
            <div className="service-reminder-box">
              <h3>Următoarea intervenție</h3>
              <p className="micro">Completează doar intervalele recomandate pentru mașina ta.</p>
              <div className="form-grid">
                <label>
                  Data planificată
                  <input name="expiresAt" type="date" defaultValue={record?.expiresAt || ''} />
                </label>
                <label>
                  Prag kilometraj · opțional
                  <input
                    name="nextKm"
                    type="number"
                    min={0}
                    defaultValue={record?.nextKm ?? ''}
                  />
                </label>
              </div>
            </div>
          )}
          {kind !== 'document' && (
            <label className="record-upload">
              <Paperclip size={18} />
              <span>Atașament opțional · PDF, JPEG sau PNG · max. 2 MB</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png"
                onChange={(e) => {
                  setFile(e.target.files?.[0] || null);
                  mark();
                }}
              />
              {file && <strong>{file.name}</strong>}
            </label>
          )}
          <label>
            Notițe
            <textarea name="notes" maxLength={4000} defaultValue={record?.notes || ''} />
          </label>
        </div>
      </details>
      {kind === 'document' && (
        <label className="record-upload compact-upload">
          <Paperclip size={18} />
          <span>{file ? file.name : 'Atașează documentul · opțional'}</span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              mark();
            }}
          />
        </label>
      )}
      <footer className="record-form-footer">
        <button type="button" onClick={onCancel} disabled={busy}>
          Anulează
        </button>
        <button className="primary" disabled={busy} type="submit">
          {busy
            ? 'Se salvează…'
            : kind === 'service'
              ? 'Salvează operațiunea'
              : kind === 'document'
                ? 'Salvează documentul'
                : 'Salvează cheltuiala'}
        </button>
      </footer>
    </form>
  );
}
