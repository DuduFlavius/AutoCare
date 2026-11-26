'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CarFront, ChartNoAxesCombined, ChevronDown, Download, Eye, FileText, Gauge, History, ShieldCheck, SlidersHorizontal, Table2, Wrench } from 'lucide-react';
import { PremiumDateInput } from './premium-date-input';
import { FilterSelect } from './filter-select';
import { DocumentPreview, type PreviewSource } from './document-preview';
import { documentDownloadError, downloadDocument } from '@/lib/document-download-client';
import { currencyRateLabel, formatDisplayMoney, validExchangeRate, type DisplayCurrency, type ExchangeRate } from '@/lib/exchange-rate';
import { ReportOverview } from './application/report-overview';
import { upcomingMaintenance } from '@/lib/application-home';
import { localDate } from '@/lib/config';
import { reportPeriod, vehicleName, type ReportKind } from '@/lib/report-analysis';
import { translateApplicationCopy } from '@/lib/application-language';
import type { dashboard } from '@/lib/service';
import './premium-reports-green.css';
import './editorial-reports.css';

type Data = Awaited<ReturnType<typeof dashboard>>;
type LibraryKind = ReportKind | 'mileage';
const catalog = [
  {id:'annual', Icon:CarFront, ro:'Dosarul garajului', en:'Garage dossier', roDesc:'Vehicule, costuri, acte și evenimente într-un dosar anual.',enDesc:'Vehicles, costs, documents and events in an annual dossier.'},
  {id:'finance', Icon:ChartNoAxesCombined, ro:'Situația cheltuielilor', en:'Expense report', roDesc:'Evoluție cumulativă, costuri pe categorii și registru.',enDesc:'Cumulative spending, category breakdown and ledger.'},
  {id:'service', Icon:Wrench, ro:'Fișa de service', en:'Service report', roDesc:'Revizii efectuate, piese, manoperă și lucrări programate.',enDesc:'Completed maintenance, parts, labour and scheduled work.'},
  {id:'documents', Icon:ShieldCheck, ro:'Situația documentelor', en:'Vehicle documents', roDesc:'RCA, ITP, rovinietă și termenele documentelor.',enDesc:'Insurance, inspection, road vignette and deadlines.'},
  {id:'journal', Icon:History, ro:'Istoric auto', en:'Vehicle history', roDesc:'Registrul cronologic al activității din garaj.',enDesc:'A chronological register of garage activity.'},
  {id:'mileage', Icon:Gauge, ro:'Raport kilometraj', en:'Mileage report', roDesc:'Citirile și diferențele de bord pentru vehiculul ales.',enDesc:'Recorded odometer readings and differences for the selected vehicle.'},
] as const;

function ReportThumbnail({kind,Icon}:{kind:LibraryKind;Icon:typeof CarFront}){
  return <div className="ed-report-thumb" data-kind={kind} aria-hidden="true">
    <div className="ed-thumb-paper">
      <Icon size={17}/><i/><b/>
      {kind==='finance'||kind==='mileage'?<svg viewBox="0 0 90 32" role="presentation"><path d={kind==='finance'?'M2 29H22V23H41V16H64V8H88':'M2 28L22 25L42 17L62 15L88 4'}/><path d="M2 31H88"/></svg>
        :kind==='annual'?<svg viewBox="0 0 90 32" role="presentation"><path d="M2 30L33 2M19 30L50 2M37 30L68 2M54 30L85 2"/></svg>:<div className="ed-thumb-lines"><i/><i/><i/></div>}
    </div>
  </div>;
}

export default function PremiumDownloads({data,language,currency,rate,preview,navigate}:{
  data:Data; language:'ro'|'en'; currency:DisplayCurrency; rate?:ExchangeRate|null; preview:boolean; navigate?:(tab:string)=>void;
}){
  const en=language==='en';
  const t=(ro:string,english:string)=>en?english:ro;
  const today=localDate(new Date(),data.profile.timezone);
  const [preset,setPreset]=useState('12');
  const initial=reportPeriod(preset,today);
  const [custom,setCustom]=useState(initial);
  const [vehicle,setVehicle]=useState('');
  const [category,setCategory]=useState('');
  const [kind,setKind]=useState('');
  const [exportLanguage,setExportLanguage]=useState<'ro'|'en'|''>('');
  const [exportCurrency,setExportCurrency]=useState<DisplayCurrency|''>('');
  const [additionalRate,setAdditionalRate]=useState<ExchangeRate|null>(null);
  const [pending,setPending]=useState('');
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [previewSource,setPreviewSource]=useState<PreviewSource|null>(null);
  const running=useRef(false);
  const docLanguage=exportLanguage||language, selectedCurrency=exportCurrency||currency;
  const selectedRate=rate??additionalRate;
  useEffect(()=>{
    if(selectedCurrency!=='EUR'||rate)return;
    const controller=new AbortController();
    void fetch('/api/exchange-rate',{signal:controller.signal}).then(response=>response.ok?response.json():null).then((quote:unknown)=>{
      if(!controller.signal.aborted&&validExchangeRate(quote))setAdditionalRate(quote);
    }).catch(()=>{});
    return ()=>controller.abort();
  },[selectedCurrency,rate]);
  const money=useMemo(()=>formatDisplayMoney(en?'en-GB':'ro-RO',selectedCurrency,selectedRate),[en,selectedCurrency,selectedRate]);
  const period=preset==='custom'?custom:initial;
  const invalid=!!(period.from&&period.to&&period.from>period.to);
  const cars=useMemo(()=>data.vehicles.filter(car=>!car.archived),[data.vehicles]);
  const selectedCars=useMemo(()=>cars.filter(car=>!vehicle||car.id===vehicle),[cars,vehicle]);
  const selectedIds=useMemo(()=>new Set(selectedCars.map(car=>car.id)),[selectedCars]);
  const records=useMemo(()=>data.records.filter(row=>selectedIds.has(row.vehicleId)&&!row.cancelled),[data.records,selectedIds]);
  const categories=useMemo(()=>[...new Set(records.map(row=>row.category))].sort((a,b)=>a.localeCompare(b)),[records]);
  const rows=useMemo(()=>records.filter(row=>(!category||category===row.category)&&(!kind||kind===row.kind)),[records,category,kind]);
  const nextDistances=useMemo(()=>selectedCars.flatMap(car=>upcomingMaintenance(rows.filter(row=>row.vehicleId===car.id),car.odometer,null,data.profile.timezone)
    .flatMap(item=>item.status.remainingKm==null?[]:[Math.max(0,item.status.remainingKm)])),[selectedCars,rows,data.profile.timezone]);
  const nextKm=nextDistances.length?Math.min(...nextDistances):null;
  const [measured,setMeasured]=useState<{key:string;distance:Record<string,number>}>();
  const mileageQuery=new URLSearchParams({...(vehicle?{vehicleId:vehicle}:{}),...(period.from?{from:period.from}:{}),...(period.to?{to:period.to}:{})}).toString();
  useEffect(()=>{
    if(preview||invalid||!cars.length)return;
    const controller=new AbortController();
    void fetch('/api/v1/reports/distances?'+mileageQuery,{signal:controller.signal}).then(response=>response.ok?response.json():null).then(value=>{
      if(value&&!controller.signal.aborted)setMeasured({key:mileageQuery,distance:value});
    }).catch(()=>{});
    return ()=>controller.abort();
  },[cars.length,invalid,mileageQuery,preview]);
  function reportURL(report:LibraryKind,format:'pdf'|'csv'='pdf'){
    const params=new URLSearchParams({format,language:docLanguage,...(period.from?{from:period.from}:{}),...(period.to?{to:period.to}:{})});
    if(report==='mileage')return '/api/v1/smartdrive/vehicles/'+encodeURIComponent(vehicle||cars[0]?.id||'')+'/readings?'+params;
    params.set('vehicleScope','active');params.set('archived','active');params.set('currency',selectedCurrency);params.set('report',report);
    if(vehicle)params.set('vehicleId',vehicle);
    if(category)params.set('category',category);
    if(kind)params.set('kind',kind);
    return '/api/v1/export?'+params;
  }
  async function save(id:string,url:string,format:'pdf'|'csv'){
    if(running.current||preview||invalid)return;
    running.current=true;setPending(id);setError('');setMessage('');
    try{
      const result=await downloadDocument(url,'AutoCare.'+format,format==='pdf'?'application/pdf':'text/csv');
      if(result==='saved')setMessage(t('Document salvat.','Document saved.'));
      if(result==='started')setMessage(t('Descărcarea a început.','Download started.'));
    }catch(cause){setError(documentDownloadError(cause,en));}
    finally{running.current=false;setPending('');}
  }
  function open(report:LibraryKind,title:string){
    setPreviewSource({url:reportURL(report)+'&view=1',name:title,mime:'application/pdf',nativeShare:true});
  }
  if(!data.premium)return null;
  const disabled=invalid||preview;
  const periodLabel=(period.from?period.from+' – ':'')+(period.to||today);
  return <section className="rg-premium-downloads ed-reports" data-workspace-ui>
    <header className="ed-report-hero">
      <div><h2>{t('Rapoartele garajului','Garage reports')}</h2>
      <p>{t('Urmărește costurile, reviziile și termenele. Generează documente pentru perioada și vehiculele alese.','Review expenses, maintenance and deadlines. Generate reports for the period and vehicles you select.')}</p></div>
      <FileText size={46} strokeWidth={1.1} aria-hidden="true"/>
    </header>
    {cars.length===0 ? <aside className="ed-report-card ed-report-empty">
      <CarFront size={26}/><h3>{t('Dosarul începe cu primul vehicul','Your dossier starts with a vehicle')}</h3>
      <p>{t('Adaugă un vehicul și înregistrează primul document, cost sau kilometraj.','Add a vehicle and record its first document, expense or odometer reading.')}</p>
      {navigate&&<button className="ed-report-primary" type="button" onClick={()=>navigate('Garaj')}>{t('Deschide garajul','Open garage')}</button>}
    </aside>:<>
      <section className="ed-report-card ed-report-filter" aria-label={t('Filtrele rapoartelor','Report filters')}>
        <header><SlidersHorizontal size={18}/><h3>{t('Filtre','Filters')}</h3><small>{periodLabel}</small></header>
        <div className="ed-report-presets" role="group" aria-label={t('Perioada raportului','Report period')}>
          {[
            ['1',t('Luna curentă','Current month')],['previous',t('Luna trecută','Last month')],['3',t('3 luni','3 months')],
            ['6',t('6 luni','6 months')],['12',t('12 luni','12 months')],['year',t('Anul curent','Current year')],
            ['all',t('Toată perioada','All time')],['custom',t('Personalizat','Custom')],
          ].map(([id,label])=><button key={id} type="button" aria-pressed={preset===id} onClick={()=>setPreset(id)}>{label}</button>)}
        </div>
        {preset==='custom'&&<div className="ed-filter-fields">
          <label>{t('De la','From')}<PremiumDateInput type="date" value={custom.from} onChange={event=>setCustom({...custom,from:event.target.value})}/></label>
          <label>{t('Până la','To')}<PremiumDateInput type="date" value={custom.to} onChange={event=>setCustom({...custom,to:event.target.value})}/></label>
        </div>}
        <div className="ed-filter-fields">
          <label>{t('Vehicul','Vehicle')}<FilterSelect value={vehicle} onChange={event=>{setVehicle(event.target.value);setCategory('');}}>
          <option value="">{t('Toate vehiculele','All vehicles')}</option>{cars.map(car=><option value={car.id} key={car.id}>{vehicleName(car)}</option>)}</FilterSelect></label>
          <label>{t('Categorie','Category')}<FilterSelect value={category} onChange={event=>setCategory(event.target.value)}>
          <option value="">{t('Toate categoriile','All categories')}</option>{categories.map(item=><option key={item} value={item}>{translateApplicationCopy(item,language)}</option>)}</FilterSelect></label>
          <label>{t('Tipul înregistrării','Record type')}<FilterSelect value={kind} onChange={event=>setKind(event.target.value)}>
            <option value="">{t('Toate tipurile','All types')}</option><option value="document">{t('Documente','Documents')}</option>
            <option value="service">{t('Întreținere','Maintenance')}</option><option value="expense">{t('Cheltuieli','Expenses')}</option>
          </FilterSelect></label>
        </div>
        <details><summary>{t('Limbă, monedă și CSV','Language, currency and CSV')}<ChevronDown size={15}/></summary>
          <div className="ed-filter-fields">
            <label>{t('Limba PDF','PDF language')}<FilterSelect value={exportLanguage} onChange={event=>setExportLanguage(event.target.value as 'ro'|'en'|'')}>
              <option value="">{t('Limba contului','Account language')}</option><option value="ro">Română</option><option value="en">English</option>
            </FilterSelect></label>
            <label>{t('Monedă','Currency')}<FilterSelect value={exportCurrency} onChange={event=>setExportCurrency(event.target.value as DisplayCurrency|'')}>
              <option value="">{t('Moneda contului','Account currency')} ({currency})</option><option value="RON">RON</option><option value="EUR">EUR</option>
            </FilterSelect></label>
            <button className="ed-report-secondary" type="button" disabled={disabled||!!pending} onClick={()=>void save('csv',reportURL('journal','csv'),'csv')}><Table2 size={16}/>{t('Exportă datele CSV','Export CSV data')}</button>
          </div>
        </details>
        {selectedCurrency==='EUR'&&<p>{currencyRateLabel(language,selectedRate)}</p>}
        {invalid&&<p role="alert">{t('Data finală trebuie să fie egală cu sau după data de început.','The end date must be on or after the start date.')}</p>}
      </section>
      <section className="ed-report-library" aria-label={t('Biblioteca rapoartelor','Report library')}>
        <h3>{t('Biblioteca rapoartelor','Report library')}</h3>
        <div className="ed-report-library-grid">
        {catalog.map(spec=>{
          const title=spec[language],mileageNeedsVehicle=spec.id==='mileage'&&!vehicle&&cars.length>1;
          const incompatible=spec.id==='service'&&kind&&kind!=='service'||spec.id==='documents'&&kind&&kind!=='document'||spec.id==='mileage'&&(!!category||!!kind);
          const blocked=disabled||mileageNeedsVehicle||!!incompatible;
          return <article key={spec.id} className="ed-report-card">
            <ReportThumbnail kind={spec.id} Icon={spec.Icon}/>
            <div className="ed-report-card-body">
              <h4>{title}</h4><p>{en?spec.enDesc:spec.roDesc}</p>
              <small>PDF · {mileageNeedsVehicle?t('Alege un vehicul','Select one vehicle'):incompatible?t('Schimbă tipul sau categoria','Change record type or category'):periodLabel}</small>
              <div className="ed-report-card-actions">
                <button type="button" className="ed-report-secondary" disabled={blocked} onClick={()=>open(spec.id,title)} aria-label={t('Previzualizează: ','Preview: ')+title}><Eye size={16}/>{t('Previzualizează','Preview')}</button>
                <button type="button" className="ed-report-primary" disabled={blocked||!!pending} aria-busy={pending===spec.id} onClick={()=>void save(spec.id,reportURL(spec.id),'pdf')} aria-label={t('Descarcă PDF: ','Download PDF: ')+title}><Download size={16}/>{pending===spec.id?t('Se generează…','Generating…'):'PDF'}</button>
              </div>
            </div>
          </article>;
        })}
        </div>
        {message&&<p role="status">{message}</p>}
        {error&&<p role="alert">{error}</p>}
      </section>
      {!invalid&&<ReportOverview rows={rows} today={today} from={period.from} to={period.to} vehicles={selectedCars}
        vehicleCount={selectedCars.length} distance={measured?.key===mileageQuery?measured.distance:undefined} en={en} nextKm={nextKm} money={money}/>}
      {rows.length===0&&navigate&&<button className="ed-report-secondary" type="button" onClick={()=>navigate('Cheltuieli')}>{t('Deschide cheltuielile','Open expenses')}</button>}
    </>}
    {previewSource&&<DocumentPreview source={previewSource} onClose={()=>setPreviewSource(null)}/>}
  </section>;
}
