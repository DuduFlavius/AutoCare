'use client';
import { Bell, CalendarDays, CarFront, ChevronRight, Files, Gauge, Plus, Sparkles, Wallet, Wrench } from 'lucide-react';
import type { dashboard } from '@/lib/service';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { selectActiveVehicle, upcomingMaintenance } from '@/lib/application-home';
import { financeOverview } from '@/lib/finance-overview';
import { documentCounts } from '@/lib/record-filters';
import { localDate } from '@/lib/config';

type Data=Awaited<ReturnType<typeof dashboard>>;
type RecordRow=Data['records'][number];
export function MobileCockpit({data,selectedVehicle,onSelectVehicle,navigate,onVehicle,onCreate,onRecord,currency}:{
 data:Data;selectedVehicle:string;onSelectVehicle:(id:string)=>void;navigate:(tab:string)=>void;onVehicle:(id:string)=>void;
 onCreate:(kind:'vehicle'|'service'|'document'|'expense',vehicleId?:string)=>void;onRecord:(row:RecordRow)=>void;currency:'RON'|'EUR';
}){
 const en=useApplicationLanguage()==='en',locale=useApplicationLocale();
 const t=(ro:string,enText:string)=>en?enText:ro;
 const car=selectActiveVehicle(data.vehicles,selectedVehicle);
 const today=localDate(new Date(),data.profile.timezone);
 const rows=data.records.filter(row=>row.vehicleId===car?.id&&!row.cancelled);
 const finance=financeOverview(rows,today,car?.id??'');
 const docs=documentCounts(rows,new Date(today+'T12:00:00Z'),data.profile.timezone);
 const next=car?upcomingMaintenance(rows,car.odometer,null,data.profile.timezone)[0]:undefined;
 const recent=finance.entries.filter(row=>!row.cancelled&&row.date&&row.date<=today).sort((a,b)=>(b.date??'').localeCompare(a.date??'')).slice(0,3);
 const unread=data.notifications.filter(row=>!row.readAt).length;
 const money=(bani:number)=>new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:0}).format(bani/(currency==='EUR'?500:100));
 const date=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const active=data.vehicles.filter(row=>!row.archived);
 return <div className="ac-mobile-home" data-workspace-ui>
  {!car?<section className="ac-m-empty"><CarFront size={52}/><h2>{t('Garajul tău începe aici','Your garage starts here')}</h2><p>{t('Adaugă mașina pentru a organiza documentele și întreținerea.','Add your vehicle to organize documents and maintenance.')}</p><button className="ac-m-primary" onClick={()=>onCreate('vehicle')}><Plus size={18}/>{t('Adaugă vehicul','Add vehicle')}</button></section>:<>
   <section className="ac-m-vehicle">
    <button className="ac-m-vehicle-open" onClick={()=>onVehicle(car.id)} aria-label={t('Deschide fișa mașinii','Open vehicle profile')}><span className="ac-m-vehicle-art"><CarFront size={66} strokeWidth={1.2}/><span>AutoCare</span></span><span className="ac-m-vehicle-identity"><strong data-user-content>{car.brand} {car.model}</strong><small data-user-content>{car.plate}</small></span><ChevronRight size={19}/></button>
    <div className="ac-m-vehicle-bottom"><span><Gauge size={14}/>{car.odometer.toLocaleString(locale)} km</span><button onClick={()=>navigate('Garaj')}>{t('Garajul meu','My garage')}<ChevronRight size={14}/></button></div>
    {active.length>1&&<label className="ac-m-car-switch"><span>{t('Mașina selectată','Selected vehicle')}</span><select value={car.id} onChange={e=>onSelectVehicle(e.target.value)}>{active.map(vehicle=><option key={vehicle.id} value={vehicle.id}>{vehicle.brand} {vehicle.model} · {vehicle.plate}</option>)}</select></label>}
   </section>
   <button className="ac-m-next-service" onClick={()=>{const record=next&&data.records.find(row=>row.id===next.service.id||next.service.id.startsWith(row.id+':'));if(record)onRecord(record);else navigate('Întreținere');}}><span className="ac-m-icon"><Wrench size={27}/></span><span><small>{t('Următoarea revizie','Next service')}</small><strong>{next?.status.remainingKm!=null?(next.status.remainingKm<=0?t('Prag atins','Threshold reached'):t('în ','in ')+next.status.remainingKm.toLocaleString(locale)+' km'):next?.raw?date(next.raw):t('Adaugă un termen','Add a service deadline')}</strong>{next?.raw&&next.status.remainingKm!=null&&<small>{date(next.raw)}</small>}</span><ChevronRight size={20}/></button>
   <div className="ac-m-overview">{[
    {Icon:Wallet,label:t('Costuri totale','Total costs'),value:finance.yearKnown?money(finance.yearBani):'—',note:t('Anul curent','Current year'),tab:'Cheltuieli'},
    {Icon:Files,label:t('Documente','Documents'),value:String(docs.total),note:t('în dosarul mașinii','in your vehicle folder'),tab:'Documente'},
    {Icon:CalendarDays,label:t('Expiră în 30 zile','Expires in 30 days'),value:String(docs.soon+docs.expired),note:docs.expired?t('inclusiv expirate','including expired'):t('de verificat','to review'),tab:'Documente'},
    {Icon:Bell,label:t('Alerte','Alerts'),value:String(unread),note:t('necitite','unread'),tab:'Notificări'},
   ].map(({Icon,label,value,note,tab})=><button key={tab+label} onClick={()=>navigate(tab)}><Icon size={23}/><span>{label}</span><strong>{value}</strong><small>{note}</small></button>)}</div>
   <button className="ac-m-ai-entry" onClick={()=>navigate(data.premium?'AutoCare AI':'Premium')}><span className="ac-m-icon"><Sparkles size={23}/></span><span><strong>AutoCare AI <small>Premium</small></strong><small>{t('Ajutor pentru mașina ta','Help for your vehicle')}</small></span><ChevronRight size={19}/></button>
   <section className="ac-m-recent"><header><h2>{t('Cheltuieli recente','Recent expenses')}</h2><button onClick={()=>navigate('Cheltuieli')}>{t('Vezi toate','View all')}<ChevronRight size={15}/></button></header>{recent.length?<ul>{recent.map(row=><li key={row.id}><button onClick={()=>onRecord(row)}><span className="ac-m-icon"><Wrench size={22}/></span><span><strong data-user-content>{row.title}</strong><small>{row.date&&date(row.date)}</small></span><b>{row.amountKnown===false?'—':money(row.amountBani)}</b></button></li>)}</ul>:<p>{t('Cheltuielile înregistrate vor apărea aici.','Your recorded expenses will appear here.')}</p>}</section>
  </>}
 </div>;
}
