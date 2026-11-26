'use client';
import {FilterSelect} from './filter-select';
import {PremiumDateInput} from './premium-date-input';
import {PremiumAttachment} from './premium-attachment';
import { useApplicationLanguage, useApplicationLocale } from './application-locale';
import { useId, useRef, useState, type FormEvent } from 'react';
import {requestConfirmation} from './premium-dialogs';
import OperationAlerts from './operation-alerts';
import { SignatureActions, SignatureFold, SignatureGroup } from './signature-form';
import RecordCategoryPicker, { categoryIcon } from './record-category-picker';
import { maintenanceSchedule } from '@/lib/maintenance-schedule';
import { currencyRateLabel, ronBaniFromEuroCents, type ExchangeRate } from '@/lib/exchange-rate';
import { readFuelFill } from '@/lib/fuel-log';
import { recordCategory } from '@/lib/record-categories';
import ServiceDetailFields, {
  serializeServiceDetails,
  parseServiceDetails,
} from './service-detail-fields';
import { CalendarClock, ChevronDown, ClipboardList, Gauge, Paperclip, Settings2, StickyNote, Wallet } from 'lucide-react';
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
  displayCurrency,
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
  displayCurrency?:'RON'|'EUR';
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

  const stored = parseServiceDetails(record?.parts??'');
  const storedInterval=stored.intervalIntretinere||stored.intervalUlei||stored.intervalDistributie||'';
  const storedAuto=record?maintenanceSchedule({...record,nextKm:null,expiresAt:null,details:stored}):null;
  const storedAutoKm=storedAuto?.nextKm??null;
  const [manualDue,setManualDue]=useState(record?.expiresAt&&(stored.manualServiceDate==='1'||record.expiresAt!==storedAuto?.expiresAt)?record.expiresAt:'');
  const [manualNext,setManualNext]=useState(record?.nextKm!=null&&(stored.manualServiceDue==='1'||record.nextKm!==storedAutoKm)?String(record.nextKm):'');
  const cars = data.vehicles.filter((v) => !v.archived || v.id === record?.vehicleId);
  const [car, setCar] = useState(record?.vehicleId || vehicleId || cars[0]?.id || ''),
    [category, setCategory] = useState(
      record?.category || initialCategory ||
        (kind === 'document' ? 'RCA' : kind === 'service' ? 'Schimb ulei' : 'Combustibil'),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
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
      interval: storedInterval,
      amount:
        record?.amountKnown !== false && record?.amountBani != null
          ? (record.amountBani / 100).toString()
          : '',
    }),
    [unknownCost, setUnknownCost] = useState(
      kind === 'document' ? false : record ? record.amountKnown === false : false,
    );
  const [selectedCurrency,setSelectedCurrency]=useState<'RON'|'EUR'|null>(null);
  const euroRate=kind==='expense'&&(selectedCurrency??displayCurrency)==='EUR'?exchangeRate??null:null;
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
  const selectedCar=cars.find(vehicle=>vehicle.id===car);
  const currentKm=selectedCar?.odometer;
  const attachmentCount=data.attachments.filter(item=>item.recordId===record?.id).length;
  const number=(value:number)=>value.toLocaleString(locale);
  const money=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'RON'}).format(value);
  const remaining = live.next && currentKm!=null ? Number(live.next)-currentKm : null;
  const journey = live.next && live.km ? Number(live.next)-Number(live.km) : 0;
  const progress = journey>0 && remaining!=null ? Math.min(100,Math.max(0,100-remaining/journey*100)) : null;
  const statusLabel=record?.cancelled?t('Arhivată','Archived'):plannedWork?t('Planificată','Scheduled'):record?t('Efectuată','Completed'):t('Intervenție nouă','New service');
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
      String(f.get('ac_intervalUlei') || ''),
    );
    setLive({
      date: String(f.get('date') || ''),
      km: String(f.get('odometer') || ''),
      next: schedule.nextKm === null ? '' : String(schedule.nextKm),
      due: schedule.expiresAt || '',
      interval: String(f.get('ac_intervalIntretinere') || f.get('ac_intervalUlei') || ''),
      amount: String(f.get('amount') || ''),
    });
    setFilterCostLive(
      Array.from(f.entries())
        .filter(([key]) => /^ac_filtru\d+Cost$/.test(key))
        .reduce((sum, [, value]) => sum + (Number(value) || 0), 0),
    );
  };
  const edited=useRef(false);
  const mark = () => {edited.current=true;onDirty(true);};
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
        serviceKmInterval:String(f.get('ac_intervalUlei')||''),
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

  const storedPartsText=(record?.parts||'').split('\n').filter(line=>!line.startsWith('AutoCare · ')).join('\n');
  const technicalCount=Object.keys(stored).filter(key=>!(/^(interval|alert|cost|manualServiceDue|manualServiceDate|budget|planned)/.test(key))).length;
  const costFields = kind==='document'?null:(<div className="sf2-cost">
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

            {kind === 'service' && (
              <p className="micro">
                {t('Introdu totalul sau defalcarea. Include costul filtrelor o singură dată.','Enter the total or the breakdown. Include the cost of filters once.')}
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
                  {t('Defalcare cost: piese și manoperă · opțional','Cost breakdown: parts and labour · optional')} <ChevronDown size={16} />
                </summary>
                <div className="form-grid">
                  <label>
                    {t('Cost piese / materiale · RON','Parts and materials · RON')}
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
                    {t('Cost manoperă · RON','Labour · RON')}
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
                    {t('Alte costuri · RON','Other costs · RON')}
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
                if (event.target.value === 'EUR') setSelectedCurrency('EUR');
                else {
                  setManualAmount(expenseAmount());
                  setSelectedCurrency('RON');
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
              {t('Nu cunosc încă suma','Amount unknown')}
            </label>
            <p className="micro">{t('Introdu 0 dacă nu ai plătit nimic.','Enter 0 when there was no charge.')}</p>
          </div>);
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
            recent={[...new Set(data.records.filter(row=>row.kind===kind&&row.vehicleId===car).map(row=>row.category))].slice(0,5)}
            onSelect={async(value) => {
              if(kind==='service'&&returnFromCategory&&edited.current&&value!==category&&
                !await requestConfirmation(t('Categoria nouă afișează alte câmpuri tehnice. Poți reveni la categoria inițială pentru a recupera ce ai introdus. Continui?',
                  'The new category uses different technical fields. You can switch back to recover what you entered. Continue?')))return;
              rememberDetails();
              if (category !== value) { setCategory(value); mark(); }
              closePicker();
              requestAnimationFrame(() => { if (formRef.current) syncLive(formRef.current, value); });
            }}
          />
        )}
        <div className="sf-stage" hidden={choosing} inert={busy}>
          <div className="sf2-identity">
            <span className="sf-category-icon"><CategoryIcon size={23} aria-hidden="true"/></span>
            <div className="sf2-identity-copy">
              <h3 tabIndex={-1} ref={categoryHeading}>{selectedCategory?(en?selectedCategory.en:selectedCategory.ro):category}</h3>
              {selectedCar&&<p><span>{selectedCar.brand} {selectedCar.model}</span><code>{selectedCar.plate}</code></p>}
            </div>
            {kind==='service'&&<div className="sf2-identity-state"><span>{statusLabel}</span>{currentKm!=null&&<strong><Gauge size={15} aria-hidden="true"/>{number(currentKm)} km</strong>}</div>}
            <button type="button" className="sf-secondary" onClick={()=>{
              rememberDetails();setInvalid(null);setReturnFromCategory(true);setChoosing(true);
              requestAnimationFrame(()=>{body.current?.scrollTo({top:0});body.current?.querySelector<HTMLInputElement>('input[type=search]')?.focus();});
            }}>{t('Schimbă categoria','Change category')}</button>
          </div>

        {error && (
          <div role="alert" className="sf-error">
            {error}
          </div>
        )}
        <div className="sf2-editor-layout" data-service={kind==='service'}>
          <div className="sf2-main">
            <SignatureGroup icon={ClipboardList} title={t('Detaliile principale','Main details')}>
        <div className="form-grid sf2-primary-grid"><label>
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
        <label>
          {kind === 'document'
            ? t('Denumirea documentului', 'Document name')
            : kind === 'expense'
              ? t('Denumirea cheltuielii', 'Expense name')
              : t('Denumirea operațiunii', 'Service name')}
          {!custom && <small>{t('Opțional','Optional')}</small>}
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

          <label>
            {kind === 'document'
              ? t('Data emiterii · opțional','Issue date · optional')
              : kind === 'expense'
                ? t('Data cheltuielii','Expense date')
                : plannedWork ? (en ? 'Scheduled work date' : 'Data planificată') : t('Data intervenției','Service date')}
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
                : t('Data expirării · dacă este cazul','Expiry date · if applicable')}
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
            {t('Număr sau serie · opțional','Number or serial · optional')}
            <input name="number" maxLength={250} defaultValue={record?.number || ''} />
          </label>
        )}
            </SignatureGroup>
            {kind==='service'&&<SignatureGroup icon={CalendarClock} title={t('Următorul termen de service','Next service')}>
              <div className="sf2-service-snapshot">
                <div><small>{t('Următorul prag','Next threshold')}</small><strong>{live.next?number(Number(live.next))+' km':'—'}</strong></div>
                <div><small>{t('Kilometri rămași','Distance remaining')}</small><strong>{remaining==null?'—':remaining<0?t('Depășit cu ','Overdue by ')+number(-remaining)+' km':number(remaining)+' km'}</strong></div>
                {progress!=null&&<progress max={100} value={progress} aria-label={t('Progres până la următoarea intervenție','Progress towards next service')}/>}
              </div>
              <div className="form-grid sf2-schedule">
                <label>{t('Interval de service · km','Service interval · km')}
                  <input key={category==='Schimb ulei'?'oil':'generic'} name={category==='Schimb ulei'?'ac_intervalUlei':'ac_intervalIntretinere'} type="number" inputMode="numeric" min={1} max={99999999}
                    defaultValue={category==='Distribuție'?(storedInterval||(record?.odometer!=null&&record.nextKm!=null&&record.nextKm>record.odometer?String(record.nextKm-record.odometer):'')):storedInterval}
                    />
                </label>
                <label>{t('Interval în luni · opțional','Interval in months · optional')}<input name="ac_intervalLuni" type="number" min={1} max={1200} defaultValue={stored.intervalLuni||''}/></label>
                <label>{t('Prag manual · km','Manual threshold · km')}<input name="nextKm" type="number" inputMode="numeric" min={0} max={10000000} value={manualNext} onChange={event=>setManualNext(event.target.value)} placeholder={t('Calcul automat','Automatic calculation')}/></label>
                <label>{t('Dată stabilită manual','Manual due date')}<PremiumDateInput name="expiresAt" type="date" value={manualDue} onChange={event=>setManualDue(event.target.value)}/></label>
                <input type="hidden" name="ac_manualServiceDate" value={manualDue?'1':''}/>
                <input type="hidden" name="ac_manualServiceDue" value={manualNext?'1':''}/>
              </div>
              <p className="micro">{t('Kilometrajul intervenției rămâne cel înregistrat. Pragul manual are prioritate.','The service mileage stays as recorded. A manual threshold takes precedence.')}</p>
              <SignatureFold icon={Gauge} title={t('Alerte de service','Service reminders')}><OperationAlerts parts={record?.parts||''} premium={data.premium}/></SignatureFold>
            </SignatureGroup>}
            {kind==='expense'&&<SignatureGroup icon={Wallet} title={t('Sumă și monedă','Amount and currency')}>{costFields}</SignatureGroup>}
          </div>
          <aside className="sf2-optional">
          {kind==='service'&&<SignatureFold icon={Settings2} title={t('Detalii tehnice și piese','Technical details and parts')}
            summary={storedPartsText || (technicalCount ? t(technicalCount+' detalii înregistrate',technicalCount+' saved details') : '')}>
            <ServiceDetailFields key={category} category={category} parts={categoryDrafts.current[category]??(record?.category===category?record.parts||'':'')}/>
            <label>{t('Piese și materiale','Parts and materials')}<textarea name="parts" maxLength={4000} defaultValue={storedPartsText}/></label>
          </SignatureFold>}

            {kind==='service'&&<SignatureFold icon={Wallet} title={t('Costuri și manoperă','Costs and labour')}
              summary={unknownCost?t('Sumă necunoscută','Amount unknown'):costEdited?money(Number(costParts||0)+Number(costLabor||0)+Number(costOther||0)):manualAmount?money(Number(manualAmount)):''}>{costFields}</SignatureFold>}
            <SignatureFold icon={Paperclip} title={t('Documente și fotografii','Documents and photos')}
              summary={file?.name||(attachmentCount?t(attachmentCount+' fișiere atașate',attachmentCount+' files attached'):'')}>
              {record&&data.attachments.filter(item=>item.recordId===record.id).map(item=><a key={item.id} href={'/api/v1/files/'+item.id} className="sf2-attachment-link"><Paperclip size={15}/>{item.name}</a>)}
              <PremiumAttachment file={file} onChange={next=>{setFile(next);mark();}} disabled={busy} uploading={uploading}/>
            </SignatureFold>
            <SignatureFold icon={StickyNote} title={t('Observații și referințe','Notes and references')}
              summary={[record?.provider,record?.number||record?.notes]?.filter(Boolean).join(' · ').slice(0,110)}>
              <div className="form-grid">
                <label>{kind==='service'?t('Atelier sau mecanic','Workshop or mechanic'):t('Furnizor sau emitent','Supplier or issuer')}<input name="provider" maxLength={250} defaultValue={record?.provider||''}/></label>
                {kind!=='document'&&<label>{t('Număr factură','Invoice number')}<input name="number" maxLength={250} defaultValue={record?.number||''}/></label>}
                {kind==='document'&&<label>{t('Cost document · RON','Document cost · RON')}<input name="amount" type="number" min={0} max={1000000} step="0.01" defaultValue={record&&record.amountKnown!==false?record.amountBani/100:''}/></label>}
                {kind==='expense'&&record?.parts&&<label className="full">{t('Piese și materiale','Parts and materials')}<textarea name="parts" maxLength={4000} defaultValue={storedPartsText}/></label>}
                <label className="full">{t('Observații','Notes')}<textarea name="notes" maxLength={4000} defaultValue={record?.notes||''}/></label>
              </div>
            </SignatureFold>
          </aside>
        </div>
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
