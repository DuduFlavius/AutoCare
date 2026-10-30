'use client';
import { useApplicationLanguage, useApplicationLocale } from './application-locale';
import { useRef, useState, type FormEvent } from 'react';
import OperationAlerts from './operation-alerts';
import RecordCategoryPicker from './record-category-picker';
import { recordCategory } from '@/lib/record-categories';
import ServiceDetailFields, {
  serializeServiceDetails,
  parseServiceDetails,
} from './service-detail-fields';
import { CarFront, Paperclip, ChevronDown } from 'lucide-react';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
type RecordItem = Data['records'][number];
export type { RecordPayload } from '@/lib/record-draft';
import { prepareRecordDraft, recordDraftSchedule, type RecordPayload } from '@/lib/record-draft';
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
  const locale = useApplicationLocale();
  const language = useApplicationLanguage();
  const en = language === 'en';
  const formRef = useRef<HTMLFormElement>(null);
  const categoryDrafts = useRef<Record<string, string>>({});
  const [choosing, setChoosing] = useState(!record);

  const cars = data.vehicles.filter((v) => !v.archived || v.id === record?.vehicleId);
  const [car, setCar] = useState(record?.vehicleId || vehicleId || cars[0]?.id || ''),
    [category, setCategory] = useState(
      record?.category ||
        (kind === 'document' ? 'RCA' : kind === 'service' ? 'Schimb ulei' : 'Combustibil'),
    ),
    [serviceKmInterval, setServiceKmInterval] = useState(
      parseServiceDetails(record?.parts || '').intervalUlei || '',
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [details, setDetails] = useState(Boolean(record)),
    [file, setFile] = useState<File | null>(null),
    [costParts, setCostParts] = useState(parseServiceDetails(record?.parts || '').costPiese || ''),
    [costLabor, setCostLabor] = useState(parseServiceDetails(record?.parts || '').costLabor || ''),
    [costOther, setCostOther] = useState(parseServiceDetails(record?.parts || '').costOther || ''),
    [costEdited, setCostEdited] = useState(false),
    [manualAmount, setManualAmount] = useState(
      record && record.amountKnown !== false ? (record.amountBani / 100).toString() : '',
    ),
    [filterCostLive, setFilterCostLive] = useState(0),
    [live, setLive] = useState({
      date:
        record?.date ||
        (kind === 'document'
          ? ''
          : new Date().toLocaleDateString('en-CA', { timeZone: data.profile.timezone })),
      km: record?.odometer?.toString() || '',
      next: record?.nextKm?.toString() || '',
      due: record?.expiresAt || '',
      amount:
        record?.amountKnown !== false && record?.amountBani != null
          ? (record.amountBani / 100).toString()
          : '',
    }),
    [unknownCost, setUnknownCost] = useState(
      kind === 'document' ? false : record ? record.amountKnown === false : false,
    );
  const sent = useRef(false);
  const custom =
    !recordCategory(kind, category) ||
    ['Alt document', 'Altă operațiune', 'Altele'].includes(category);
  const selectedCategory = recordCategory(kind, category);
  const rememberDetails = () => {
    if (formRef.current && kind === 'service')
      categoryDrafts.current[category] = serializeServiceDetails('', new FormData(formRef.current));
  };
  const _brakeValue = (label: string) => {
    const line = (record?.parts || '').split('\\n').find((item) => item.startsWith(label + ': '));
    return line ? line.slice(label.length + 2) : '';
  };
  const syncLive = (form: HTMLFormElement, selected = category) => {
    const f = new FormData(form);
    const schedule = recordDraftSchedule(
      f,
      kind,
      selected,
      String(f.get('ac_intervalUlei') || serviceKmInterval),
    );
    setLive({
      date: String(f.get('date') || ''),
      km: String(f.get('odometer') || ''),
      next: schedule.nextKm === null ? '' : String(schedule.nextKm),
      due: schedule.expiresAt || '',
      amount: String(f.get('amount') || ''),
    });
    setFilterCostLive(
      Array.from(f.entries())
        .filter(([key]) => /^ac_filtru\d+Cost$/.test(key))
        .reduce((sum, [, value]) => sum + (Number(value) || 0), 0),
    );
  };
  const mark = () => onDirty(true);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sent.current) return;
    const f = new FormData(e.currentTarget);
    sent.current = true;
    setBusy(true);
    try {
      setError('');
      const payload = prepareRecordDraft(f, {
        kind,
        category,
        car,
        serviceKmInterval,
        costEdited,
        unknownCost,
        existingParts: record?.parts || '',
        file,
      });
      const okay = await onSave(payload, file);
      if (okay) onDirty(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sent.current = false;
      setBusy(false);
    }
  }
  return (
    <form
      ref={formRef}
      className="quick-record-form record-editor-shell"
      onSubmit={submit}
      onChange={(e) => {
        mark();
        syncLive(e.currentTarget);
      }}
    >
      {choosing && (
        <RecordCategoryPicker
          kind={kind}
          selected={category}
          onCancel={onCancel}
          onSelect={(value) => {
            rememberDetails();
            setCategory(value);
            setChoosing(false);
            mark();
            requestAnimationFrame(() => {
              if (formRef.current) {
                syncLive(formRef.current, value);
                formRef.current.closest('.dialog')?.scrollTo({ top: 0 });
              }
            });
          }}
        />
      )}
      <div className="record-form-stage" hidden={choosing}>
        <div className="record-selected-category" data-workspace-ui>
          <div>
            <span className="record-step">
              {en ? '02 · RECORD DETAILS' : '02 · DETALIILE ÎNREGISTRĂRII'}
            </span>
            <h3>
              {selectedCategory ? (en ? selectedCategory.en : selectedCategory.ro) : category}
            </h3>
            <p>
              {selectedCategory
                ? en
                  ? selectedCategory.descriptionEn
                  : selectedCategory.description
                : ''}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              rememberDetails();
              setChoosing(true);
              requestAnimationFrame(() =>
                formRef.current?.closest('.dialog')?.scrollTo({ top: 0 }),
              );
            }}
          >
            {en ? 'Change category' : 'Schimbă categoria'}
          </button>
        </div>
        <div className="record-editor-intro">
          <span>
            <CarFront size={21} />
          </span>
          <p>
            {kind === 'service'
              ? 'Ține evidența întreținerii și a costurilor mașinii tale. Completează rapid datele esențiale și, opțional, detaliile tehnice.'
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
              <option data-user-content key={v.id} value={v.id}>
                {v.brand} {v.model} · {v.plate}
              </option>
            ))}
          </select>
        </label>
        <input name="category" value={category} readOnly hidden />
        <label>
          {kind === 'document'
            ? 'Denumirea documentului'
            : kind === 'expense'
              ? 'Denumirea cheltuielii'
              : 'Denumirea operațiunii'}
          {!custom && <small>Opțional</small>}
          <input
            name="title"
            defaultValue={record?.title || ''}
            maxLength={250}
            required={custom}
            placeholder={
              selectedCategory ? (en ? selectedCategory.en : selectedCategory.ro) : category
            }
          />
        </label>
        <div className="form-grid">
          <label>
            {kind === 'document'
              ? 'Data emiterii · opțional'
              : kind === 'expense'
                ? 'Data cheltuielii'
                : 'Data intervenției'}
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
                  data.vehicles.find((v) => v.id === car)?.odometer.toLocaleString(locale) +
                  ' km · ultima valoare'
                }
              />
            </label>
          )}
        </div>
        {kind === 'service' && (
          <>
            <details className="record-technical-details">
              <summary>
                Detalii tehnice și piese · opțional <ChevronDown size={16} />
              </summary>
              <ServiceDetailFields
                key={category}
                category={category}
                parts={
                  categoryDrafts.current[category] ??
                  (record?.category === category ? record?.parts || '' : '')
                }
              />
            </details>
            {category === 'Schimb ulei' && (
              <label className="ac-oil-interval">
                Interval pentru următorul schimb · opțional, în km
                <input
                  name="ac_intervalUlei"
                  type="number"
                  min="1"
                  step="1"
                  value={serviceKmInterval}
                  onChange={(e) => {
                    setServiceKmInterval(e.target.value);
                    mark();
                  }}
                  placeholder="Conform recomandării producătorului"
                />
                <small>
                  Se calculează doar dacă ai introdus kilometrajul intervenției. Poți stabili manual
                  următorul termen mai jos.
                </small>
              </label>
            )}
          </>
        )}
        {kind === 'document' && (
          <label>
            Număr sau serie · opțional
            <input name="number" maxLength={250} defaultValue={record?.number || ''} />
          </label>
        )}
        {kind !== 'document' && (
          <div className="cost-field ac-cost-breakdown">
            <h3>{kind === 'service' ? 'Costurile intervenției' : 'Valoarea cheltuielii'}</h3>
            <p className="micro">
              {kind === 'service'
                ? 'Completează suma totală sau defalcarea. Pentru filtre, costurile individuale sunt incluse în total o singură dată.'
                : 'Înregistrează suma plătită. Cheltuiala se adaugă o singură dată în istoricul mașinii.'}
            </p>
            {kind === 'service' && (
              <div className="record-cost-mode" data-workspace-ui>
                <span>
                  {costEdited
                    ? en
                      ? 'Total calculated from the breakdown'
                      : 'Total calculat din defalcare'
                    : en
                      ? 'Enter the total directly'
                      : 'Introdu direct costul total'}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCostEdited(!costEdited);
                    mark();
                  }}
                >
                  {costEdited
                    ? en
                      ? 'Use a simple total'
                      : 'Introdu doar totalul'
                    : en
                      ? 'Use cost breakdown'
                      : 'Calculează din defalcare'}
                </button>
              </div>
            )}
            {kind === 'service' && (
              <details className="record-cost-details">
                <summary>
                  Defalcare cost: piese și manoperă · opțional <ChevronDown size={16} />
                </summary>
                <div className="form-grid">
                  <label>
                    Cost piese / materiale · RON
                    <input
                      name="ac_costPiese"
                      type="number"
                      min="0"
                      max="1000000"
                      step="0.01"
                      inputMode="decimal"
                      disabled={unknownCost}
                      value={costParts}
                      onChange={(e) => {
                        setCostParts(e.target.value);
                        setCostEdited(true);
                      }}
                      placeholder="Opțional"
                    />
                  </label>
                  <label>
                    Cost manoperă · RON
                    <input
                      name="ac_costLabor"
                      type="number"
                      min="0"
                      max="1000000"
                      step="0.01"
                      inputMode="decimal"
                      disabled={unknownCost}
                      value={costLabor}
                      onChange={(e) => {
                        setCostLabor(e.target.value);
                        setCostEdited(true);
                      }}
                      placeholder="Opțional"
                    />
                  </label>
                  <label>
                    Alte costuri · RON
                    <input
                      name="ac_costOther"
                      type="number"
                      min="0"
                      max="1000000"
                      step="0.01"
                      inputMode="decimal"
                      disabled={unknownCost}
                      value={costOther}
                      onChange={(e) => {
                        setCostOther(e.target.value);
                        setCostEdited(true);
                      }}
                      placeholder="Opțional"
                    />
                  </label>
                </div>
              </details>
            )}
            <label>
              {kind === 'service' ? 'Cost total · RON' : 'Cost · RON'}
              <input
                key={costEdited ? 'computed-cost' : 'manual-cost'}
                type="number"
                inputMode="decimal"
                name="amount"
                min={0}
                max={1000000}
                step="0.01"
                disabled={unknownCost || (kind === 'service' && costEdited)}
                value={
                  kind === 'service' && costEdited
                    ? (
                        Number(costParts || 0) +
                        Number(costLabor || 0) +
                        Number(costOther || 0)
                      ).toFixed(2)
                    : manualAmount
                }
                onChange={(event) => setManualAmount(event.target.value)}
                placeholder="Introdu suma sau completează defalcarea"
              />
            </label>
            {kind === 'service' &&
              ['Filtre', 'Schimb ulei'].includes(category) &&
              filterCostLive > 0 && (
                <p className="micro">
                  Total filtre introduse: {filterCostLive.toFixed(2)} RON. Nu adăuga aceeași sumă de
                  două ori.
                </p>
              )}
            <label className="check">
              <input
                type="checkbox"
                checked={unknownCost}
                onChange={(e) => {
                  setUnknownCost(e.target.checked);
                  mark();
                }}
              />
              Costul nu este cunoscut încă
            </label>
            <p className="micro">
              Dacă suma este zero, introdu 0 RON. Dacă nu cunoști costul, bifează opțiunea de mai
              sus.
            </p>
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
                  {kind === 'service' ? 'Service sau mecanic' : 'Furnizor'}
                  <input name="provider" maxLength={250} defaultValue={record?.provider || ''} />
                </label>
                <label>
                  Număr factură
                  <input name="number" maxLength={250} defaultValue={record?.number || ''} />
                </label>
                {(kind === 'service' || !!record?.parts) && (
                  <>
                    <label>
                      Piese și materiale
                      <textarea
                        name="parts"
                        maxLength={4000}
                        defaultValue={(record?.parts || '')
                          .split('\n')
                          .filter((line) => !line.startsWith('AutoCare · '))
                          .join('\n')}
                      />
                    </label>
                  </>
                )}
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
                  defaultValue={
                    record && record.amountKnown !== false ? record.amountBani / 100 : ''
                  }
                />
              </label>
            )}
            {kind === 'service' && (
              <div className="service-reminder-box">
                <OperationAlerts parts={record?.parts||''} premium={data.premium}/>
                <h3>Următoarea intervenție</h3>
                <p className="micro">Completează doar intervalele recomandate pentru mașina ta.</p>
                <div className="form-grid">
                  {category !== 'Schimb ulei' && (
                    <label data-workspace-ui>
                      {en
                        ? 'Repeat after · km (optional)'
                        : 'Interval între intervenții · km (opțional)'}
                      <input
                        name="ac_intervalIntretinere"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={
                          parseServiceDetails(record?.parts || '').intervalIntretinere ||
                          (category === 'Distribuție'
                            ? parseServiceDetails(record?.parts || '').intervalDistributie
                            : '') ||
                          ''
                        }
                      />
                    </label>
                  )}
                  <label data-workspace-ui>
                    {en
                      ? 'Repeat after · months (optional)'
                      : 'Interval între intervenții · luni (opțional)'}
                    <input
                      name="ac_intervalLuni"
                      type="number"
                      min="1"
                      max="1200"
                      step="1"
                      defaultValue={parseServiceDetails(record?.parts || '').intervalLuni || ''}
                    />
                  </label>
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
        {kind === 'service' && (
          <aside className="ac-service-summary" aria-label="Rezumatul intervenției">
            <h3>Rezumatul intervenției</h3>
            <div>
              <span>Operațiune</span>
              <strong data-workspace-ui>
                {selectedCategory ? (en ? selectedCategory.en : selectedCategory.ro) : category}
              </strong>
            </div>
            <div>
              <span>Data</span>
              <strong>
                {live.date
                  ? new Date(live.date + 'T12:00:00').toLocaleDateString(locale)
                  : 'Necompletată'}
              </strong>
            </div>
            <div>
              <span>Kilometraj</span>
              <strong>
                {live.km ? Number(live.km).toLocaleString(locale) + ' km' : 'Necompletat'}
              </strong>
            </div>
            <div>
              <span>Cost</span>
              <strong>
                {unknownCost
                  ? 'Necunoscut'
                  : costEdited
                    ? (
                        Number(costParts || 0) +
                        Number(costLabor || 0) +
                        Number(costOther || 0)
                      ).toFixed(2) + ' RON'
                    : manualAmount !== ''
                      ? Number(manualAmount).toFixed(2) + ' RON'
                      : filterCostLive > 0
                        ? filterCostLive.toFixed(2) + ' RON'
                        : 'Cost necompletat'}
              </strong>
            </div>
            <div>
              <span>Următorul termen</span>
              <strong>
                {live.due ||
                  (live.next
                    ? Number(live.next).toLocaleString(locale) + ' km'
                    : category === 'Schimb ulei' && serviceKmInterval && live.km
                      ? (Number(live.km) + Number(serviceKmInterval)).toLocaleString(locale) + ' km'
                      : 'Nesetat')}
              </strong>
            </div>
            <div>
              <span>Memento</span>
              <strong>
                {live.due ||
                live.next ||
                (category === 'Schimb ulei' && serviceKmInterval && live.km)
                  ? 'Termen configurat'
                  : 'Fără termen configurat'}
              </strong>
            </div>
          </aside>
        )}
        <footer className="record-form-footer">
          <button type="button" onClick={onCancel} disabled={busy}>
            Anulează
          </button>
          <button className="primary" disabled={busy} type="submit">
            {busy
              ? 'Se salvează…'
              : kind === 'service'
                ? 'Salvează intervenția'
                : kind === 'document'
                  ? 'Salvează documentul'
                  : 'Salvează cheltuiala'}
          </button>
        </footer>
      </div>
    </form>
  );
}
