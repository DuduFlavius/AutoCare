'use client';
import {FilterSelect} from './filter-select';
import {PremiumDateInput} from './premium-date-input';
import {PremiumAttachment} from './premium-attachment';
import { useApplicationLanguage, useApplicationLocale } from './application-locale';
import { useId, useRef, useState, type FormEvent } from 'react';
import OperationAlerts from './operation-alerts';
import { SignatureActions } from './signature-form';
import RecordCategoryPicker, { categoryIcon } from './record-category-picker';
import { currencyRateLabel, ronBaniFromEuroCents, type ExchangeRate } from '@/lib/exchange-rate';
import { readFuelFill } from '@/lib/fuel-log';
import { recordCategory } from '@/lib/record-categories';
import ServiceDetailFields, {
  serializeServiceDetails,
  parseServiceDetails,
} from './service-detail-fields';
import { ChevronDown } from 'lucide-react';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
type RecordItem = Data['records'][number];
export type { RecordPayload } from '@/lib/record-draft';
import { prepareRecordDraft, recordDraftSchedule, type RecordPayload } from '@/lib/record-draft';
export default function RecordEditor({
  kind,
  record,
  planned = false,
  data,
  vehicleId,
  initialCategory,
  initialDate,
  onSave,
  completeAction,
  uploading = false,
  exchangeRate,
  onCancel,
  onDirty,
}: {
  kind: 'document' | 'service' | 'expense';
  record?: RecordItem;
  planned?: boolean;
  data: Data;
  vehicleId?: string;
  initialCategory?: string;
  initialDate?: string;
  onSave: (payload: RecordPayload, file: File | null) => Promise<boolean>;
  completeAction?: React.ReactNode;
  uploading?: boolean;
  exchangeRate?: ExchangeRate | null;
  onCancel: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const locale = useApplicationLocale();
  const language = useApplicationLanguage();
  const en = language === 'en';
  const t = (ro: string, english: string) => en ? english : ro;
  const errorId = useId();
  const body = useRef<HTMLDivElement>(null);
  const categoryHeading = useRef<HTMLHeadingElement>(null);
  const [invalid, setInvalid] = useState<{ field: string; message: string } | null>(null);
  const [returnFromCategory, setReturnFromCategory] = useState(false);
  const plannedWork = kind === 'service' && (planned || parseServiceDetails(record?.parts ?? '').planned === '1');
  const formRef = useRef<HTMLFormElement>(null);
  const categoryDrafts = useRef<Record<string, string>>({});
  const [choosing, setChoosing] = useState(!record&&!initialCategory);

  const cars = data.vehicles.filter((v) => !v.archived || v.id === record?.vehicleId);
  const [car, setCar] = useState(record?.vehicleId || vehicleId || cars[0]?.id || ''),
    [category, setCategory] = useState(
      record?.category || initialCategory ||
        (kind === 'document' ? 'RCA' : kind === 'service' ? 'Schimb ulei' : 'Combustibil'),
    ),
    [serviceKmInterval, setServiceKmInterval] = useState(
      parseServiceDetails(record?.parts || '').intervalUlei || '',
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [details, setDetails] = useState(false),
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
        record?.date || initialDate ||
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
  const [euroRate, setEuroRate] = useState<ExchangeRate | null>(null);
  const [euroDraft, setEuroDraft] = useState<string | null>(null);
  const euroValue = euroDraft ?? (euroRate && manualAmount !== '' ? (Number(manualAmount) / Number(euroRate.ronPerEuro)).toFixed(2) : '');
  const expenseAmount = () => {
    if (!euroRate || euroDraft === null) return manualAmount;
    if (euroDraft === '') return '';
    return (ronBaniFromEuroCents(Math.round(Number(euroDraft) * 100), euroRate) / 100).toFixed(2);
  };
  const sent = useRef(false);
  const custom =
    !recordCategory(kind, category) ||
    ['Alt document', 'Altă operațiune', 'Altele'].includes(category);
  const selectedCategory = recordCategory(kind, category);
  const CategoryIcon = categoryIcon(selectedCategory?.icon);
  const currentKm = cars.find(vehicle => vehicle.id === car)?.odometer;
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
    if (kind === 'expense' && euroRate && !unknownCost) f.set('amount', expenseAmount());
    setInvalid(null);
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
      setError(e instanceof Error ? e.message : t('Salvarea a eșuat. Încearcă din nou.', 'Saving failed. Try again.'));
      body.current?.scrollTo({ top: 0 });
    } finally {
      sent.current = false;
      setBusy(false);
    }
  }
  const closePicker = () => {
    setChoosing(false);
    requestAnimationFrame(() => {
      body.current?.scrollTo({ top: 0 });
      categoryHeading.current?.focus({ preventScroll: true });
    });
  };
  const fieldError = (name: string) => invalid?.field === name
    ? { 'aria-invalid': true as const, 'aria-describedby': errorId }
    : {};
  const errorFor = (name: string) => invalid?.field === name &&
    <small className="sf-error" id={errorId} role="alert">{invalid.message}</small>;

  return (
    <form ref={formRef} className="sf-form" onSubmit={submit} aria-busy={busy}
      onInvalid={(event) => {
        const field = event.target;
        if (!(field instanceof HTMLInputElement) && !(field instanceof HTMLTextAreaElement) && !(field instanceof HTMLSelectElement)) return;
        for (let parent = field.parentElement; parent && parent !== event.currentTarget; parent = parent.parentElement) {
          if (parent instanceof HTMLDetailsElement) parent.open = true;
        }
        if (!event.currentTarget.querySelector(':invalid:not(form)')?.isSameNode(field)) return;
        setInvalid({ field: field.name, message: field.validationMessage });
      }}
      onInput={(event) => {
        const field = event.target;
        if (field instanceof HTMLInputElement && !['search', 'file', 'hidden'].includes(field.type)) mark();
      }}
      onChange={(event) => {
        if (!(event.target instanceof HTMLInputElement && ['search', 'file'].includes(event.target.type))) mark();
        if (invalid && event.target instanceof HTMLElement && event.target.getAttribute('name') === invalid.field) setInvalid(null);
        syncLive(event.currentTarget);
      }}
    >
      <div className="sf-body" ref={body}>
        {choosing && (
          <RecordCategoryPicker kind={kind} selected={category}
            onCancel={returnFromCategory ? closePicker : onCancel} back={returnFromCategory}
            onSelect={(value) => {
              rememberDetails();
              if (category !== value) { setCategory(value); mark(); }
              closePicker();
              requestAnimationFrame(() => { if (formRef.current) syncLive(formRef.current, value); });
            }}
          />
        )}
        <div className="sf-stage" hidden={choosing} inert={busy}>
          <div className="sf-category-current" data-workspace-ui>
            <span className="sf-category-icon"><CategoryIcon size={21} aria-hidden="true" /></span>
            <div>
              <h3 tabIndex={-1} ref={categoryHeading}>{selectedCategory ? (en ? selectedCategory.en : selectedCategory.ro) : category}</h3>
              {kind === 'service' && <p className="sf-status">
                {record?.cancelled ? t('Arhivată', 'Archived') : plannedWork ? t('Planificată', 'Scheduled') : record ? t('Efectuată', 'Completed') : t('Intervenție nouă', 'New service')}
              </p>}
            </div>
            <button type="button" className="sf-secondary" onClick={() => {
              rememberDetails();
              setInvalid(null);
              setReturnFromCategory(true);
              setChoosing(true);
              requestAnimationFrame(() => {
                body.current?.scrollTo({ top: 0 });
                body.current?.querySelector<HTMLInputElement>('input[type=search]')?.focus();
              });
            }}>{t('Schimbă categoria', 'Change category')}</button>
          </div>

        {error && (
          <div role="alert" className="sf-error">
            {error}
          </div>
        )}
        <label>
          {t('Vehicul', 'Vehicle')}
          <FilterSelect name="vehicleId" value={car} required {...fieldError('vehicleId')} onChange={(e) => setCar(e.target.value)}>
            <option value="" disabled>
              {language === "en" ? "Choose a vehicle" : "Alege mașina"}
            </option>
            {cars.map((v) => (
              <option data-user-content key={v.id} value={v.id}>
                {v.brand} {v.model} · {v.plate}
              </option>
            ))}
          </FilterSelect>
          {errorFor('vehicleId')}
        </label>
        <input name="category" value={category} readOnly hidden />
        {kind === 'service' && currentKm != null && <div className="sf-mileage" data-workspace-ui>
          <span>{t('Kilometraj actual al vehiculului', 'Current vehicle mileage')}</span>
          <strong>{currentKm.toLocaleString(locale)} km</strong>
        </div>}
        <label>
          {kind === 'document'
            ? t('Denumirea documentului', 'Document name')
            : kind === 'expense'
              ? t('Denumirea cheltuielii', 'Expense name')
              : t('Denumirea operațiunii', 'Service name')}
          {!custom && <small>Opțional</small>}
          <input
            name="title"
            {...fieldError('title')}
            defaultValue={record?.title || ''}
            maxLength={250}
            required={custom}
            placeholder={
              selectedCategory ? (en ? selectedCategory.en : selectedCategory.ro) : category
            }
          />
          {errorFor('title')}
        </label>
        {plannedWork && <input type="hidden" name="ac_planned" value="1" />}
        {plannedWork && !record && <p className="small" data-workspace-ui>{en ? 'Saved in Calendar. It enters the service history after completion.' : 'Lucrarea se salvează în Calendar. Apare în istoric după ce o marchezi efectuată.'}</p>}
        <div className="form-grid">
          <label>
            {kind === 'document'
              ? 'Data emiterii · opțional'
              : kind === 'expense'
                ? 'Data cheltuielii'
                : plannedWork ? (en ? 'Scheduled work date' : 'Data planificată') : 'Data intervenției'}
            <PremiumDateInput
              type="date"
              name="date"
              {...fieldError('date')}
              required={kind !== 'document'}
              defaultValue={
                record?.date || initialDate ||
                (kind === 'document'
                  ? ''
                  : new Date().toLocaleDateString('en-CA', { timeZone: data.profile.timezone }))
              }
            />
            {errorFor('date')}
          </label>
          {kind === 'document' ? (
            <label>
              {category === 'RCA'
                ? en
                  ? 'RCA expiry date · required'
                  : 'Data expirării RCA · obligatorie'
                : 'Data expirării · dacă este cazul'}
              <PremiumDateInput
                type="date"
                name="expiresAt"
                {...fieldError('expiresAt')}
                required={category === 'RCA'}
                defaultValue={record?.expiresAt || ''}
              />
              {errorFor('expiresAt')}
              <small data-workspace-ui>
                {category === 'RCA'
                  ? en
                    ? 'Used for your expiry reminders.'
                    : 'Folosită pentru notificările de expirare.'
                  : en
                    ? 'Leave blank for documents without expiry.'
                    : 'Lasă liber dacă documentul nu are termen de expirare.'}
              </small>
            </label>
          ) : (
            <label>
              <span data-workspace-ui>
                {category === 'Distribuție'
                  ? en
                    ? 'Odometer at the last timing service · km'
                    : 'Kilometraj la ultimul schimb de distribuție · km'
                  : en
                    ? kind === 'service' ? 'Odometer at service · km' : 'Odometer · optional'
                    : kind === 'service' ? 'Kilometrajul intervenției · km' : 'Kilometraj · opțional'}
              </span>
              <input
                type="number"
                name="odometer"
                inputMode="numeric"
                {...fieldError('odometer')}
                min={0}
                max={10000000}
                defaultValue={record?.odometer ?? ''}
                placeholder={t('Opțional', 'Optional')}
              />
              {errorFor('odometer')}
            </label>
          )}
        </div>
        {kind === 'expense' && category === 'Combustibil' && (
          <div className="form-grid" data-workspace-ui>
            <label>{en ? 'Litres added' : 'Litri alimentați'}<input type="number" name="fuelLiters" min="0.01" max="2500" step="0.01" defaultValue={readFuelFill(record?.parts)?.liters ?? ''}/></label>
            <label className="check"><input type="checkbox" name="fuelFull" defaultChecked={readFuelFill(record?.parts)?.full ?? false}/>{en ? 'Filled the tank' : 'Am făcut plinul'}</label>
            <p className="small muted">{en ? 'Log the odometer and all fill-ups between two full tanks to calculate consumption.' : 'Notează kilometrajul și toate alimentările dintre două plinuri pentru a calcula consumul.'}</p>
          </div>
        )}
        {kind === 'service' && category === 'Distribuție' && (
          <section className="service-reminder-box" data-workspace-ui>
            <h3>
              {en
                ? 'When should the timing service be repeated?'
                : 'La câți km se repetă schimbul de distribuție?'}
            </h3>
            <p className="micro">
              {en
                ? 'Enter the distance between changes, not the odometer reading. Use the interval specified for your engine.'
                : 'Introdu distanța dintre două schimburi, nu kilometrajul de pe bord. Folosește intervalul specific motorului tău.'}
            </p>
            <div className="form-grid">
              <label>
                {en ? 'Change every · km' : 'Schimb la fiecare · km'}
                <input
                  name="ac_intervalIntretinere"
                  type="number"
                  min="1"
                  max="99999999"
                  step="1"
                  placeholder="100000"
                  defaultValue={
                    parseServiceDetails(record?.parts || '').intervalIntretinere ||
                    parseServiceDetails(record?.parts || '').intervalDistributie ||
                    (record?.nextKm != null &&
                    record.odometer != null &&
                    record.nextKm > record.odometer
                      ? record.nextKm - record.odometer
                      : '')
                  }
                />
              </label>
              <label>
                {en ? 'Or every · months (optional)' : 'Sau la fiecare · luni (opțional)'}
                <input
                  name="ac_intervalLuni"
                  type="number"
                  min="1"
                  max="1200"
                  step="1"
                  defaultValue={parseServiceDetails(record?.parts || '').intervalLuni || ''}
                />
              </label>
            </div>
            <p className="micro">
              {en
                ? 'Example: changed at 83,000 km + a 100,000 km interval = next change at 183,000 km. If your next change is at 150,000 km, enter an interval of 67,000 km.'
                : 'Exemplu: schimb făcut la 83.000 km + interval de 100.000 km = următorul schimb la 183.000 km. Dacă următorul schimb trebuie făcut la 150.000 km, introdu un interval de 67.000 km.'}
            </p>
            <strong aria-live="polite">
              {en ? 'Next change: ' : 'Următorul schimb: '}
              {live.next && live.km
                ? Number(live.next).toLocaleString(locale) + ' km'
                : en
                  ? 'complete the mileage and interval'
                  : 'completează kilometrajul și intervalul'}
            </strong>
          </section>
        )}
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
          <details className="sf-optional-section service-reminder-box" data-workspace-ui>
            <summary>{en ? 'Document expiry reminders' : 'Notificări pentru expirarea documentului'}</summary>
            <p>
              {en
                ? 'General reminders follow your account preferences in Settings → Notifications and email.'
                : 'Mementourile respectă preferințele din Setări → Notificări și email.'}
            </p>
            <OperationAlerts parts={record?.parts || ''} premium={data.premium} mileage={false} />
          </details>
        )}
        {kind === 'document' && (
          <label>
            Număr sau serie · opțional
            <input name="number" maxLength={250} defaultValue={record?.number || ''} />
          </label>
        )}
        {kind !== 'document' && (
          <div className="cost-field ac-cost-breakdown">
            {data.premium && kind === 'service' && (
              <label data-workspace-ui>
                {en ? 'Estimated budget · RON (optional)' : 'Buget estimat · RON (opțional)'}
                <input
                  name="ac_budgetEstimat"
                  type="number"
                  min="0"
                  max="1000000"
                  step="0.01"
                  defaultValue={parseServiceDetails(record?.parts || '').budgetEstimat || ''}
                />
                <small>
                  {en
                    ? 'Planning only. It does not count as an actual expense.'
                    : 'Doar pentru planificare. Nu se adaugă la cheltuielile reale.'}
                </small>
              </label>
            )}
            <h3>{kind === 'service' ? 'Costurile intervenției' : 'Suma plătită'}</h3>
            {kind === 'service' && (
              <p className="micro">
                Introdu totalul sau completează costurile pe categorii. Include costul filtrelor o
                singură dată.
              </p>
            )}
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
              {kind === 'service' ? t('Cost total · RON', 'Total cost · RON') : t('Sumă plătită', 'Amount paid')}
              <input
                key={costEdited ? 'computed-cost' : 'manual-cost'}
                type="number"
                inputMode="decimal"
                name="amount"
                {...fieldError('amount')}
                min={0}
                max={euroRate ? Math.floor(100000000 / Number(euroRate.ronPerEuro)) / 100 : 1000000}
                step="0.01"
                disabled={unknownCost || (kind === 'service' && costEdited)}
                value={
                  kind === 'service' && costEdited
                    ? (
                        Number(costParts || 0) +
                        Number(costLabor || 0) +
                        Number(costOther || 0)
                      ).toFixed(2)
                    : euroRate ? euroValue : manualAmount
                }
                onChange={(event) => euroRate ? setEuroDraft(event.target.value) : setManualAmount(event.target.value)}
                placeholder={en ? '0.00' : '0,00'}
              />
              {errorFor('amount')}
            </label>
            {kind === 'expense' && <label>
              {t('Monedă', 'Currency')}
              <FilterSelect value={euroRate ? 'EUR' : 'RON'} disabled={unknownCost} onChange={event => {
                if (event.target.value === 'EUR') setEuroRate(exchangeRate ?? null);
                else {
                  setManualAmount(expenseAmount());
                  setEuroRate(null);
                  setEuroDraft(null);
                }
              }}>
                <option value="RON">RON</option>
                <option value="EUR" disabled={!exchangeRate}>EUR</option>
              </FilterSelect>
              {euroRate ? <small>{currencyRateLabel(language, euroRate)} · {t('Soldurile se păstrează în RON.', 'Balances are stored in RON.')}</small>
                : !exchangeRate && <small>{t('EUR este disponibil când cursul BCE este încărcat.', 'EUR is available when the ECB rate is loaded.')}</small>}
            </label>}
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
              Nu cunosc încă suma
            </label>
            <p className="micro">Introdu 0 lei dacă nu ai plătit nimic.</p>
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
                  {kind === 'service' ? 'Service sau mecanic' : 'Furnizor sau comerciant'}
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
                {...fieldError('amount')}
                  type="number"
                  step="0.01"
                  min={0}
                  max={1000000}
                  defaultValue={
                    record && record.amountKnown !== false ? record.amountBani / 100 : ''
                  }
                />
                {errorFor('amount')}
              </label>
            )}
            {kind === 'service' && (
              <div className="service-reminder-box">
                <OperationAlerts parts={record?.parts || ''} premium={data.premium} />
                <h3>Următoarea intervenție</h3>
                <p className="micro">Completează doar intervalele recomandate pentru mașina ta.</p>
                <div className="form-grid">
                  {category !== 'Schimb ulei' && category !== 'Distribuție' && (
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
                  {category !== 'Distribuție' && (
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
                  )}
                  <label>
                    Data planificată
                    <PremiumDateInput name="expiresAt" type="date" defaultValue={record?.expiresAt || ''} />
                  </label>
                  {category !== 'Distribuție' && (
                    <label>
                      Prag kilometraj · opțional
                      <input
                        name="nextKm"
                        type="number"
                        min={0}
                        defaultValue={record?.nextKm ?? ''}
                      />
                    </label>
                  )}
                </div>
              </div>
            )}
            {kind !== 'document' && <PremiumAttachment file={file} onChange={next=>{setFile(next);mark();}} disabled={busy} uploading={uploading}/>}
            <label>
              Notițe
              <textarea name="notes" maxLength={4000} defaultValue={record?.notes || ''} />
            </label>
          </div>
        </details>
        {kind === 'document' && <PremiumAttachment file={file} onChange={next=>{setFile(next);mark();}} disabled={busy} uploading={uploading}/>}
        </div>
      </div>
      {!choosing && <SignatureActions onCancel={onCancel} busy={busy}
        status={uploading ? t('Se încarcă…', 'Uploading…') : undefined}
        label={record ? t('Salvează modificările', 'Save changes') : t('Salvează', 'Save')}>
        {completeAction}
      </SignatureActions>}
    </form>
  );
}
