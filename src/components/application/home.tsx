'use client';
import {useState} from 'react';
import {CarFront,Files,Wrench,Wallet,Plus,ChevronRight,Sparkles} from 'lucide-react';
import type {dashboard} from '@/lib/service';
import {selectActiveVehicle,upcomingMaintenance} from '@/lib/application-home';
import {financeOverview} from '@/lib/finance-overview';
import {isPlannedService} from '@/lib/planned-service';
import {localDate} from '@/lib/config';
import {useApplicationLanguage,useApplicationLocale} from '../application-locale';
import {FilterSelect} from '../filter-select';
import {useMileageUsage} from '../use-mileage-usage';
import {MobileCockpit} from './mobile-cockpit';
import {MobileFinanceOverview} from './mobile-finance-overview';
type Data=Awaited<ReturnType<typeof dashboard>>;
type Row=Data['records'][number];
type Props={data:Data;name:string;selectedVehicle:string;onSelectVehicle:(id:string)=>void;onDrill:(tab:string,vehicleId:string,ids:string[],label:string)=>void;navigate:(tab:string)=>void;onVehicle:(id:string)=>void;onCreate:(kind:'vehicle'|'service'|'document'|'expense',vehicleId?:string)=>void;onRecord:(row:Row)=>void;onRefresh:()=>Promise<void>;currency:'RON'|'EUR';preview:boolean};
export default function ApplicationHome(props:Props){
 const {data,name,selectedVehicle,onSelectVehicle,onDrill,navigate,onVehicle,onCreate,onRecord,currency,preview}=props;
 const en=useApplicationLanguage()==='en',locale=useApplicationLocale(),t=(ro:string,english:string)=>en?english:ro;
 const cars=data.vehicles.filter(v=>!v.archived),car=selectActiveVehicle(cars,selectedVehicle);
 const usage=useMileageUsage(car?.id??'',car?.odometer??0,preview);
 const today=localDate(new Date(),data.profile.timezone),rows=data.records.filter(r=>!r.cancelled&&r.vehicleId===car?.id);
 const maintenance=car?upcomingMaintenance(rows.filter(r=>!isPlannedService(r,today)),car.odometer,usage.dailyKm,data.profile.timezone):[],next=maintenance[0];
 const finance=financeOverview(rows,today,car?.id??'');
 const docs=rows.filter(r=>r.kind==='document'),soon=docs.filter(r=>r.status.days!=null&&r.status.days<=30);
 const services=rows.filter(r=>r.kind==='service'&&isPlannedService(r,today));
 const [period,setPeriod]=useState('12');
 const money=(bani:number)=>new Intl.NumberFormat(locale,{style:'currency',currency}).format(bani/(currency==='EUR'?500:100));
 const date=(v:string|null)=>v?new Date(v+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'—';
 const openNext=()=>{const r=rows.find(r=>r.id===next?.service.id||next?.service.id.startsWith(r.id+':'));if(r)onRecord(r);else navigate('Întreținere');};
 return <><MobileCockpit {...props} onNextService={openNext}/><div className="rg-home-desktop">
  <header className="rg-hero"><div><p>{t('Bine ai venit,','Welcome back,')}</p><h1 id="workspace-page-title" tabIndex={-1}>{name.trim().split(/\s+/)[0]}!</h1><p>{t('Garajul tău inteligent, mereu la zi.','Your digital garage, always up to date.')}</p></div><div className="rg-actions"><button onClick={()=>onCreate('vehicle')}><Plus size={18}/>{t('Adaugă vehicul','Add vehicle')}</button><button className="primary" onClick={()=>navigate('Garaj')}><CarFront size={19}/>{t('Garajul meu','My garage')}</button></div></header>
  <nav className="rg-stat-grid" aria-label={t('Prezentarea garajului','Garage overview')}>{[
   {Icon:CarFront,label:t('Vehicule','Vehicles'),value:cars.length,tab:'Garaj'},
   {Icon:Wallet,label:t('Cheltuieli în acest an','Expenses this year'),value:finance.yearKnown?money(finance.yearBani):'—',tab:'Cheltuieli'},
   {Icon:Wrench,label:t('Revizii următoare','Upcoming maintenance'),value:maintenance.length,tab:'Întreținere'},
   {Icon:Files,label:t('Documente de verificat','Documents to review'),value:soon.length,tab:'Documente'},
  ].map(({Icon,label,value,tab})=><button key={tab} onClick={()=>navigate(tab)}><Icon size={23}/><span>{label}</span><strong>{value}</strong></button>)}</nav>
  {currency==='EUR'&&<small className="rg-currency-note">{en?'Indicative display: 1 EUR = 5 RON. Original records remain in RON.':'Afișare orientativă: 1 EUR = 5 RON. Înregistrările originale rămân în RON.'}</small>}
  <div className="rg-home-grid"><section className="rg-panel"><header><h2>{t('Evoluția cheltuielilor','Expense history')}</h2>{car&&<FilterSelect aria-label={t('Vehicul selectat','Selected vehicle')} value={car.id} onChange={e=>onSelectVehicle(e.target.value)}>{cars.map(v=><option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}</FilterSelect>}</header><MobileFinanceOverview rows={rows} today={today} money={money} period={period} onPeriod={setPeriod} onFilters={()=>{}} filtersOpen={false}/><button className="rg-text-action" onClick={()=>navigate('Cheltuieli')}>{t('Vezi cheltuielile','View expenses')}<ChevronRight size={17}/></button></section>
  <section className="rg-panel"><header><h2>{t('Mașinile din garaj','Your garage')}</h2><button onClick={()=>onCreate('vehicle')} aria-label={t('Adaugă vehicul','Add vehicle')}><Plus size={20}/></button></header><div className="rg-garage-list">{cars.map(v=>{const vr=data.records.filter(r=>r.vehicleId===v.id&&!r.cancelled),doc=vr.filter(r=>r.kind==='document'),up=upcomingMaintenance(vr,v.odometer,null,data.profile.timezone)[0];return <button key={v.id} onClick={()=>onVehicle(v.id)}><span className="rg-icon"><CarFront size={25}/></span><span><strong data-user-content>{v.brand} {v.model}</strong><small data-user-content>{v.plate} · {v.odometer.toLocaleString(locale)} km</small><small>{doc.length} {t('documente','documents')} · {up?.status.remainingKm!=null?Math.max(0,up.status.remainingKm).toLocaleString(locale)+' km '+t('până la revizie','until service'):t('Revizie nesetată','Maintenance not set')}</small></span><ChevronRight size={18}/></button>;})}</div>{!cars.length&&<p>{t('Adaugă prima mașină pentru a începe.','Add your first vehicle to get started.')}</p>}</section></div>
  <div className="rg-home-bottom"><section className="rg-panel"><header><h2>{t('Următoarea intervenție','Next maintenance')}</h2><Wrench size={21}/></header><button className="rg-record" onClick={openNext}><strong>{next?.service.title??t('Planifică întreținerea','Plan maintenance')}</strong><small>{next?.status.remainingKm!=null?Math.max(0,next.status.remainingKm).toLocaleString(locale)+' km':next?.raw?date(next.raw):t('Adaugă un termen','Add a deadline')}</small></button><button onClick={()=>navigate('Calendar')}>{t('Deschide calendarul','Open calendar')} · {services.length}</button></section>
  <section className="rg-panel"><header><h2>{t('Documentele mașinii','Vehicle documents')}</h2><Files size={21}/></header>{docs.slice(0,3).map(r=><button className="rg-record" key={r.id} onClick={()=>onRecord(r)}><strong>{r.category}</strong><small>{date(r.expiresAt)}</small></button>)}<button onClick={()=>onDrill('Documente',car?.id??'',docs.map(r=>r.id),t('Documente','Documents'))}>{t('Vezi toate documentele','View all documents')}</button></section>
  <section className="rg-panel"><header><h2>AutoCare AI</h2><Sparkles size={21}/></header><p>{t('Întreținere, documente și costuri, în contextul mașinii tale.','Maintenance, documents and costs, with your vehicle in context.')}</p><button className="primary" onClick={()=>navigate(data.premium?'AutoCare AI':'Premium')}>{t('Deschide asistentul','Open assistant')}</button></section></div>
 </div></>;
}
