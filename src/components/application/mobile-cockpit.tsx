'use client';
import {useState,type ReactNode} from 'react';
import {MobileFinanceOverview} from './mobile-finance-overview';
import {homeDocument} from '@/lib/application-home';
import {FilterSelect} from '../filter-select';
import { CalendarDays, CarFront, ChevronRight, Files, Gauge, Plus, Sparkles, Coins, ChartNoAxesCombined, Wrench, ShieldCheck, Check, Clock3, Route } from 'lucide-react';
import type { dashboard } from '@/lib/service';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { selectActiveVehicle, upcomingMaintenance } from '@/lib/application-home';
import { financialChange, financeOverview } from '@/lib/finance-overview';
import {isPlannedService} from '@/lib/planned-service';
import { documentStatus, localDate } from '@/lib/config';

type Data=Awaited<ReturnType<typeof dashboard>>;
type RecordRow=Data['records'][number];
export function MobileCockpit({data,selectedVehicle,onSelectVehicle,navigate,onDrill=(tab)=>navigate(tab),onVehicle,onCreate,onRecord,onNextService,currency,smartDrive}:{
 data:Data;selectedVehicle:string;onSelectVehicle:(id:string)=>void;onDrill?:(tab:string,vehicleId:string,ids:string[],label:string)=>void;navigate:(tab:string)=>void;onVehicle:(id:string)=>void;
 onCreate:(kind:'vehicle'|'service'|'document'|'expense',vehicleId?:string)=>void;onRecord:(row:RecordRow)=>void;onNextService:()=>void;currency:'RON'|'EUR';smartDrive?:ReactNode;
}){
 const [failedPhoto,setFailedPhoto]=useState('');
 const [chartPeriod,setChartPeriod]=useState('6');
 const en=useApplicationLanguage()==='en',locale=useApplicationLocale();
 const t=(ro:string,enText:string)=>en?enText:ro;
 const car=selectActiveVehicle(data.vehicles,selectedVehicle);
 const today=localDate(new Date(),data.profile.timezone);
 const rows=data.records.filter(row=>row.vehicleId===car?.id&&!row.cancelled);
 const finance=financeOverview(rows,today,car?.id??'');
 const monthChange=finance.monthKnown&&finance.previousMonthKnown?financialChange(finance.monthBani,finance.previousMonthBani):null;
 const next=car?upcomingMaintenance(rows,car.odometer,null,data.profile.timezone)[0]:undefined;
 const recent=finance.entries.filter(row=>!row.cancelled&&row.date&&row.date<=today).sort((a,b)=>(b.date??'').localeCompare(a.date??'')).slice(0,3);
 const source=next?rows.find(r=>r.id===next.service.id||next.service.id.startsWith(r.id+':')):null;
 const progress=source?.odometer!=null&&source.nextKm!=null&&source.nextKm>source.odometer&&car&&car.odometer>=source.odometer?Math.min(100,Math.max(0,(car.odometer-source.odometer)/(source.nextKm-source.odometer)*100)):null;
 const itp=car?homeDocument(rows,car.id,'ITP',today):null;
 const money=(bani:number)=>new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:0}).format(bani/(currency==='EUR'?500:100));
 const date=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const active=data.vehicles.filter(row=>!row.archived);
 const hasPhoto=car&&failedPhoto!==car.id&&data.photos?.some(photo=>photo.vehicleId===car.id);
 const expiries=['ITP','RCA','Rovinietă','CASCO'].flatMap(category=>{
  const row=car?homeDocument(rows,car.id,category,today):null;
  return row?.expiresAt&&row.expiresAt>=today?[{row,category,expiry:row.expiresAt}]:[];
 }).sort((a,b)=>a.expiry.localeCompare(b.expiry)).slice(0,3);
 const firstVehicle=data.vehicles.length===0;
 return <div className="rg-mobile-home" data-empty-garage={!car||undefined} data-first-vehicle={firstVehicle||undefined} data-workspace-ui>
  {firstVehicle?<section className="ac-home-empty-garage ac-home-first-vehicle" aria-labelledby="home-empty-garage-title">
   <div className="ac-home-empty-garage-content">
    <h2 id="home-empty-garage-title">{t('Adaugă-ți prima mașină','Add your first car')}</h2>
    <p>{t('Ține documentele, reviziile și cheltuielile mașinii într-un singur loc.','Keep your car’s documents, servicing and expenses in one place.')}</p>
    <button type="button" className="rg-m-primary" onClick={()=>onCreate('vehicle')}><Plus size={18} aria-hidden="true"/>{t('Adaugă mașina','Add your car')}</button>
   </div>
   <img className="ac-home-empty-garage-image" src="/images/autocare-empty-garage.webp" alt="" width={1200} height={800} decoding="async"/>
  </section>:!car?<section className="rg-m-empty ac-home-empty-garage" aria-labelledby="home-empty-garage-title">
   <span className="ac-home-empty-garage-icon" aria-hidden="true"><CarFront size={28}/></span>
   <h2 id="home-empty-garage-title">{t('Garajul tău începe aici','Your garage starts here')}</h2>
   <p>{t('Adaugă mașina pentru a organiza documentele și întreținerea.','Add your vehicle to organize documents and maintenance.')}</p>
   <button type="button" className="rg-m-primary" onClick={()=>onCreate('vehicle')}><Plus size={18} aria-hidden="true"/>{t('Adaugă vehicul','Add vehicle')}</button>
  </section>:<>
   <section className="rg-m-vehicle" data-multiple={active.length>1||undefined}>
    {hasPhoto&&car?<div className="rg-home-owned-photo">
     <img src={'/api/v1/vehicles/'+encodeURIComponent(car.id)+'/photo'} alt="" decoding="async" onError={()=>setFailedPhoto(car.id)}/></div>:<CarFront className="rg-home-vehicle-silhouette" size={120} strokeWidth={.8} aria-hidden="true"/>}
    <button className="rg-m-vehicle-open" onClick={()=>onVehicle(car.id)} aria-label={t('Deschide fișa mașinii','Open vehicle profile')}><span className="rg-m-vehicle-art rg-m-vehicle-emblem" aria-hidden="true"><span className="rg-m-emblem-orbit"/><CarFront size={35} strokeWidth={1.25}/><span className="rg-m-emblem-caption">AUTOCARE</span></span><span className="rg-m-vehicle-sweep" aria-hidden="true"/><span className="rg-m-vehicle-identity"><strong data-user-content>{car.brand} {car.model}</strong><small data-user-content>{car.plate}</small></span><ChevronRight size={19}/></button>
    <div className="rg-m-vehicle-bottom"><span><Gauge size={19}/><span><strong>{car.odometer.toLocaleString(locale)} km</strong><small>{t('Kilometraj actual','Current mileage')}</small></span></span><button onClick={()=>onDrill('Documente',car.id,itp?[itp.id]:[],t('Inspecție tehnică','Vehicle inspection'))}><CalendarDays size={18}/><span>{itp?.expiresAt?date(itp.expiresAt):t('Necompletat','Not recorded')}<small>ITP</small></span></button></div>
    {active.length>1&&<label className="rg-m-car-switch"><span>{t('Mașina selectată','Selected vehicle')}</span><FilterSelect value={car.id} onChange={e=>onSelectVehicle(e.target.value)}>{active.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.plate}</option>)}</FilterSelect></label>}
   </section>
   <section className="ac-home-documents" aria-labelledby="home-documents-title">
    <header><h2 id="home-documents-title"><Files size={22}/>{t('Documente auto','Vehicle documents')}</h2><button onClick={()=>onDrill('Documente',car.id,rows.filter(r=>r.kind==='document').map(r=>r.id),t('Documentele mașinii','Vehicle documents'))}>{t('Vezi toate','View all')}<ChevronRight size={15}/></button></header>
    <div>{[{category:'ITP',Icon:ShieldCheck},{category:'RCA',Icon:ShieldCheck},{category:'Rovinietă',Icon:Route},{category:'CASCO',Icon:ShieldCheck}].map(({category,Icon})=>{
     const record=homeDocument(rows,car.id,category,today),status=documentStatus(record?.expiresAt??null,new Date(),data.profile.timezone);
     const label=!record?t('Lipsește','Missing'):record.date&&record.date>today?t('Începe în viitor','Starts later'):status.days==null?t('Fără termen','No expiry'):status.days<0?t('Expirat','Expired'):status.days<=30?t('Expiră curând','Expires soon'):t('Valabil','Valid');
     const state=!record||record.date&&record.date>today?'incomplete':status.state;
     return <button key={category} data-state={state} onClick={()=>onDrill('Documente',car.id,record?[record.id]:[],category)} aria-label={category+' · '+label}><Icon size={28}/><strong>{category==='Rovinietă'?t('Rovinietă','Vignette'):category}</strong><small>{record?.expiresAt?date(record.expiresAt):'—'}</small><span className="ac-home-document-state">{state==='valid'?<Check size={13}/>:<Clock3 size={13}/>}<span>{label}</span></span></button>;
    })}</div>
   </section>
   <button className="rg-m-next-service" onClick={onNextService}><span className="rg-m-icon"><Wrench size={27}/></span><span><small>{t('Următoarea intervenție','Next maintenance')}</small><strong>{next?.service.title??t('Adaugă un termen','Add a service deadline')}</strong><small>{next?.status.remainingKm!=null?(next.status.remainingKm<=0?t('Prag atins','Threshold reached'):t('în ','in ')+next.status.remainingKm.toLocaleString(locale)+' km'):next?.raw?date(next.raw):t('Planifică întreținerea mașinii','Plan your vehicle maintenance')}</small></span>{progress!=null?<span className="rg-service-progress" aria-label={t("Progres interval kilometraj","Mileage interval progress")+" "+Math.round(progress)+"%"}><svg viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18"/><circle cx="22" cy="22" r="18" strokeDasharray="113.1" strokeDashoffset={113.1*(1-progress/100)}/></svg><b>{Math.round(progress)}%</b></span>:<ChevronRight size={20}/>}</button>
   <section className="ac-home-finance" aria-labelledby="home-finance-title"><header><h2 id="home-finance-title"><Coins size={22}/>{t('Cheltuieli','Expenses')}</h2><button aria-label={t('Deschide cheltuielile','Open expenses')} onClick={()=>onDrill('Cheltuieli',car.id,finance.entries.map(r=>r.id),t('Cheltuielile mașinii','Vehicle expenses'))}><ChevronRight size={17}/></button></header><MobileFinanceOverview variant="bars" rows={rows} today={today} money={money} period={chartPeriod} onPeriod={setChartPeriod} onFilters={()=>navigate('Cheltuieli')} filtersOpen={false}/>{monthChange!=null&&<p className="rg-home-cost-comparison"><strong>{new Intl.NumberFormat(locale,{style:'percent',signDisplay:'exceptZero',maximumFractionDigits:0}).format(monthChange/100)}</strong> {t('luna aceasta față de luna trecută','this month vs. last month')}</p>}</section>
   <div className="rg-m-shortcuts">{[
    {Icon:Files,title:t('Documente','Documents'),note:'ITP, RCA, CASCO',tab:'Documente'},
    {Icon:Wrench,title:t('Service','Service'),note:t('Plan și istoric','Plan & history'),tab:'Întreținere'},
    {Icon:Coins,title:t('Cheltuieli','Expenses'),note:t('Costuri și rapoarte','Costs and reports'),tab:'Cheltuieli'},
    {Icon:Gauge,title:t('Kilometraj','Mileage'),note:t('Istoric și statistici','History & statistics'),tab:'Kilometraj'},
    {Icon:ShieldCheck,title:t('RCA & Rovinietă','RCA & Road vignette'),note:t('Expirări și reînnoiri','Expiry & renewals'),tab:'RCA & Rovinietă'},
    {Icon:Sparkles,title:'AutoCare AI',note:t('Asistentul tău auto','Your car assistant'),tab:data.premium?'AutoCare AI':'Premium'},
   ].map(({Icon,title,note,tab})=><button type="button" key={title} onClick={()=>navigate(tab)}><Icon size={23} aria-hidden="true"/><span><strong>{title}</strong><small>{note}</small></span><ChevronRight size={15} aria-hidden="true"/></button>)}</div>
   {smartDrive}
   {!!expiries.length&&<section className="rg-home-expiries">
    <header><h2>{t('Următoarele expirări','Upcoming expiries')}</h2><button type="button" onClick={()=>navigate('Documente')}>{t('Vezi toate','View all')}<ChevronRight size={16}/></button></header>
    <ul>{expiries.map(({row,category,expiry})=><li key={row.id}>
     <button type="button" onClick={()=>onRecord(row)}><ShieldCheck size={23}/><strong>{category==='Rovinietă'?t('Rovinietă','Vignette'):category}</strong><time dateTime={expiry}>{date(expiry)}</time><ChevronRight size={16}/></button>
    </li>)}</ul>
   </section>}
   <div className="rg-m-overview">{[
    {Icon:Coins,label:t('Costuri totale','Total costs'),value:finance.yearKnown?money(finance.yearBani):'—',note:t('Anul curent','Current year'),tab:'Cheltuieli'},
    {Icon:ChartNoAxesCombined,label:t('Intervenții','Service entries'),value:String(rows.filter(r=>r.kind==='service'&&r.date&&r.date<=today&&!isPlannedService(r,today)).length),note:t('Istoric înregistrat','Recorded history'),tab:'Întreținere'},
    {Icon:Gauge,label:t('Revizie în','Next service in'),value:next?.status.remainingKm!=null?Math.max(0,next.status.remainingKm).toLocaleString(locale)+' km':'—',note:t('Prag de kilometraj','Mileage threshold'),tab:'Întreținere'},
   ].map(({Icon,label,value,note,tab})=><button key={tab+label} onClick={()=>onDrill(tab,car?.id??'',rows.filter(r=>tab==='Întreținere'?r.kind==='service':true).map(r=>r.id),label)}><Icon size={23}/><span>{label}</span><strong>{value}</strong><small>{note}</small></button>)}</div>
   {currency==='EUR'&&<small className="rg-currency-note">{t('Afișare orientativă: 1 EUR = 5 RON.','Indicative display: 1 EUR = 5 RON.')}</small>}
   <section className="rg-m-recent"><header><h2>{t('Cheltuieli recente','Recent expenses')}</h2><button onClick={()=>navigate('Cheltuieli')}>{t('Vezi toate','View all')}<ChevronRight size={15}/></button></header>{recent.length?<ul>{recent.map(row=><li key={row.id}><button onClick={()=>onRecord(row)}><span className="rg-m-icon"><Wrench size={22}/></span><span><strong data-user-content>{row.title}</strong><small>{row.date&&date(row.date)}</small></span><b>{row.amountKnown===false?'—':money(row.amountBani)}</b></button></li>)}</ul>:<p>{t('Cheltuielile înregistrate vor apărea aici.','Your recorded expenses will appear here.')}</p>}</section>
  </>}
  {!car&&smartDrive}
 </div>;
}
