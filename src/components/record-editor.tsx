'use client';
import { useRef, useState, type FormEvent } from 'react';
import ServiceDetailFields, { serializeServiceDetails, parseServiceDetails } from './service-detail-fields';
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
    [serviceKmInterval, setServiceKmInterval] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [details, setDetails] = useState(false),
    [file, setFile] = useState<File | null>(null),
    [costParts, setCostParts] = useState(parseServiceDetails(record?.parts||'').costPiese||''),
    [costLabor, setCostLabor] = useState(parseServiceDetails(record?.parts||'').costLabor||''),
    [costOther, setCostOther] = useState(parseServiceDetails(record?.parts||'').costOther||''),
    [costEdited, setCostEdited] = useState(false),
    [live, setLive] = useState({date:record?.date||'',km:record?.odometer?.toString()||'',next:record?.nextKm?.toString()||'',due:record?.expiresAt||'',amount:record?.amountKnown!==false&&record?.amountBani!=null?(record.amountBani/100).toString():''}),
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
    const partsTotal = ['ac_costPiese','ac_costLabor','ac_costOther'].reduce((sum,k)=>sum+(num(k)||0),0);
    const finalAmount = kind === 'service' && costEdited ? partsTotal : (num('amount') ?? 0);
    const hasCost = kind === 'service' && costEdited ? ['ac_costPiese','ac_costLabor','ac_costOther'].some(k => str(k) !== '') : str('amount') !== '';
    const filterCost = category === 'Filtre' ? Array.from(f.entries()).filter(([key]) => /^ac_filtru\d+Cost$/.test(key)).reduce((total,[,value]) => total + (Number(value) || 0),0) : 0;
    // Filter line-item prices are informational when a total or parts breakdown is supplied: never add them twice.
    const effectiveTotal = kind === 'service' && !hasCost && filterCost > 0 ? filterCost : finalAmount;
    const effectiveKnown = hasCost || (kind === 'service' && filterCost > 0) || (Boolean(record?.amountKnown) && !costEdited && str('amount') !== '');
    if (kind === 'service' && category === 'Filtre' && costEdited && filterCost > 0 && str('ac_costPiese') === '') {
      setError('Ai introdus costuri pentru filtre. Completează costul pieselor cu suma lor sau lasă defalcarea necompletată pentru a evita neconcordanțele.');
      return;
    }
    setError('');
    if (!unknownCost && (!Number.isFinite(effectiveTotal) || effectiveTotal < 0 || effectiveTotal > 1000000)) {setError('Costul trebuie să fie între 0 și 1.000.000 RON.');return;}
    if (num('odometer') !== null && (!Number.isInteger(num('odometer')) || Number(num('odometer')) < 0)) {setError('Kilometrajul trebuie să fie un număr întreg pozitiv.');return;}
    if (computedNextKm !== null && num('odometer') !== null && computedNextKm < Number(num('odometer'))) {setError('Următorul kilometraj nu poate fi mai mic decât kilometrajul intervenției.');return;}
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
          amountBani: unknownCost ? 0 : Math.round(effectiveTotal * 100),
          amountKnown: !unknownCost && effectiveKnown,
          provider: str('provider'),
          number: str('number'),
          parts: kind === 'service' ? serializeServiceDetails(str('parts') || record?.parts || '',f) : str('parts'),
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
    <form className="quick-record-form" onSubmit={submit} onChange={(e)=>{mark();const f=new FormData(e.currentTarget);setLive({date:String(f.get("date")||""),km:String(f.get("odometer")||""),next:String(f.get("nextKm")||""),due:String(f.get("expiresAt")||""),amount:String(f.get("amount")||"")});setFilterCostLive(Array.from(f.entries()).filter(([k])=>/^ac_filtru\d+Cost$/.test(k)).reduce((n,[,v])=>n+(Number(v)||0),0))}}>
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
      {kind === 'service' && <>
        <ServiceDetailFields key={category} category={category} parts={record?.category===category ? record?.parts||'' : ''}/>
        {category === 'Schimb ulei' && <label className="ac-oil-interval">Interval pentru următorul schimb · opțional, în km
          <input type="number" min="1" step="1" value={serviceKmInterval} onChange={e=>{setServiceKmInterval(e.target.value);mark()}} placeholder="Conform recomandării producătorului"/>
          <small>Se calculează doar dacă ai introdus kilometrajul intervenției. Poți stabili manual următorul termen mai jos.</small>
        </label>}
      </>}
      {kind === 'document' && (
        <label>
          Număr sau serie · opțional
          <input name="number" maxLength={250} defaultValue={record?.number || ''} />
        </label>
      )}
      {kind !== 'document' && (
        <div className="cost-field ac-cost-breakdown">
          <h3>Costurile intervenției</h3>
          <p className="micro">Completează suma totală sau defalcarea. Pentru filtre, costurile individuale sunt incluse în total o singură dată.</p>
          {kind === 'service' && <div className="form-grid">
            <label>Cost piese / materiale · RON<input name="ac_costPiese" type="number" min="0" max="1000000" step="0.01" inputMode="decimal" disabled={unknownCost} value={costParts} onChange={e=>{setCostParts(e.target.value);setCostEdited(true)}} placeholder="Opțional"/></label>
            <label>Cost manoperă · RON<input name="ac_costLabor" type="number" min="0" max="1000000" step="0.01" inputMode="decimal" disabled={unknownCost} value={costLabor} onChange={e=>{setCostLabor(e.target.value);setCostEdited(true)}} placeholder="Opțional"/></label>
            <label>Alte costuri · RON<input name="ac_costOther" type="number" min="0" max="1000000" step="0.01" inputMode="decimal" disabled={unknownCost} value={costOther} onChange={e=>{setCostOther(e.target.value);setCostEdited(true)}} placeholder="Opțional"/></label>
          </div>}
          <label>{kind === 'service' ? 'Cost total · RON' : 'Cost · RON'}
            <input key={costEdited ? "computed-cost" : "manual-cost"} type="number" inputMode="decimal" name="amount" min={0} max={1000000} step="0.01" disabled={unknownCost || (kind==='service'&&costEdited)}
              value={kind==='service'&&costEdited ? (Number(costParts||0)+Number(costLabor||0)+Number(costOther||0)).toFixed(2) : undefined}
              defaultValue={kind==='service'&&costEdited ? undefined : record && record.amountKnown !== false ? record.amountBani / 100 : ''}
              placeholder="Introdu suma sau completează defalcarea"/>
          </label>
          {kind==='service'&&category==='Filtre'&&filterCostLive>0&&<p className="micro">Total filtre introduse: {filterCostLive.toFixed(2)} RON. Nu adăuga aceeași sumă de două ori.</p>}
          <label className="check"><input type="checkbox" checked={unknownCost} onChange={e=>setUnknownCost(e.target.checked)}/>Costul nu este cunoscut încă</label>
          <p className="micro">Dacă intervenția a fost gratuită, introdu 0 RON. Dacă nu cunoști costul, bifează opțiunea de mai sus.</p>
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
                <textarea name="parts" maxLength={4000} defaultValue={(record?.parts || '').split('\n').filter(line => !line.startsWith('AutoCare · ')).join('\n')} />
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
      {kind === 'service' && <aside className="ac-service-summary" aria-label="Rezumatul intervenției">
        <h3>Rezumatul intervenției</h3>
        <div><span>Operațiune</span><strong>{category}</strong></div>
        <div><span>Data</span><strong>{live.date||'Necompletată'}</strong></div>
        <div><span>Kilometraj</span><strong>{live.km?Number(live.km).toLocaleString('ro-RO')+' km':'Necompletat'}</strong></div>
        <div><span>Cost</span><strong>{unknownCost?'Necunoscut':costEdited?(Number(costParts||0)+Number(costLabor||0)+Number(costOther||0)).toFixed(2)+' RON':live.amount!==''?Number(live.amount).toFixed(2)+' RON':filterCostLive>0?filterCostLive.toFixed(2)+' RON':'Cost necompletat'}</strong></div>
        <div><span>Următorul termen</span><strong>{live.due|| (live.next?Number(live.next).toLocaleString('ro-RO')+' km':category==='Schimb ulei'&&serviceKmInterval&&live.km?(Number(live.km)+Number(serviceKmInterval)).toLocaleString('ro-RO')+' km':'Nesetat')}</strong></div>
        <div><span>Memento</span><strong>{live.due||live.next||category==='Schimb ulei'&&serviceKmInterval&&live.km?'Termen configurat':'Fără termen configurat'}</strong></div>
      </aside>}
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
