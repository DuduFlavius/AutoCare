'use client';
import { useState } from 'react';
import { ArrowUpRight, Wrench, Files, Wallet, ShieldCheck, Route, CarFront, Gauge, History, Sparkles, Send, CalendarDays, ChevronRight, Clock3, FileCheck2, Layers3 } from 'lucide-react';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { useMileageUsage } from '../use-mileage-usage';
import { selectActiveVehicle, upcomingMaintenance, homeCareAssessment } from '@/lib/application-home';
import { financeOverview } from '@/lib/finance-overview';
import { calendarRecordDate, isPlannedService } from '@/lib/planned-service';
import { localDate } from '@/lib/config';
import { AppEmpty, AppStatus } from './ui';
import type { dashboard } from '@/lib/service';
import './home-clarity.css';
import './cockpit-home.css';
type Data = Awaited<ReturnType<typeof dashboard>>;
type Row = Data['records'][number];
type Props = {data:Data;name:string;selectedVehicle:string;onSelectVehicle:(id:string)=>void;navigate:(tab:string)=>void;onVehicle:(id:string)=>void;onCreate:(kind:'vehicle'|'service'|'document'|'expense',vehicleId?:string)=>void;onRecord:(record:Row)=>void;onRefresh:()=>Promise<void>;currency:'RON'|'EUR';preview:boolean};
export default function ApplicationHome({data,name,selectedVehicle,onSelectVehicle,navigate,onVehicle,onCreate,onRecord,currency,preview}:Props) {
 const en=useApplicationLanguage()==='en', locale=useApplicationLocale();
 const t=(ro:string,english:string)=>en?english:ro;
 const car=selectActiveVehicle(data.vehicles,selectedVehicle),cars=data.vehicles.filter(v=>!v.archived);
 const usage=useMileageUsage(car?.id??'',car?.odometer??0,preview);
 const [period,setPeriod]=useState('year'),[question,setQuestion]=useState('');
 const today=localDate(new Date(),data.profile.timezone);
 const rows=data.records.filter(r=>!r.cancelled&&r.vehicleId===car?.id);
 const recorded=rows.filter(r=>!isPlannedService(r,today));
 const maintenance=car?upcomingMaintenance(recorded,car.odometer,usage.dailyKm,data.profile.timezone):[];
 const next=maintenance[0];
 const appointments=rows.filter(r=>isPlannedService(r,today)).map(row=>({row,date:calendarRecordDate(row,today)})).filter((item):item is {row:Row;date:string}=>Boolean(item.date)).sort((a,b)=>a.date.localeCompare(b.date));
 const docs=recorded.filter(r=>r.kind==='document').sort((a,b)=>(a.status.days??Infinity)-(b.status.days??Infinity));
 const attention=docs.filter(r=>r.status.days!=null&&r.status.days<=30);
 const care=homeCareAssessment(docs,maintenance,car?.odometer??0);
 const finance=financeOverview(rows,today,car?.id??'');
 const currentMonth=finance.series.find(m=>m.month===today.slice(0,7));
 const annualMonths=finance.series.filter(m=>m.month<=today.slice(0,7)).slice(-6);
 const largest=Math.max(1,...annualMonths.map(m=>m.current.bani));
 const costs=period==='month'?finance.monthBani:finance.yearBani;
 const known=period==='month'?(currentMonth?.current.known??0):finance.series.reduce((sum,m)=>sum+m.current.known,0);
 const activity=recorded.filter(r=>r.date&&r.date<=today).sort((a,b)=>(b.date??'').localeCompare(a.date??'')).slice(0,3);
 const money=(bani:number)=>new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:0}).format(bani/(currency==='EUR'?500:100));
 const date=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const openAI=()=>{
  if(!car)return;
  if(!data.premium){navigate('Premium');return;}
  try { sessionStorage.setItem('autocare-ai-draft:'+car.id,question.trim()); } catch { /* Full chat remains accessible without storage. */ }
  navigate('AutoCare AI');
 };
 const monthKnown=!!currentMonth?.current.known;
 const yearKnown=finance.series.some(m=>m.current.known>0);
 const points=annualMonths.map((m,i)=>({x:44+i*100,y:148-m.current.bani/largest*112,m}));
 const line=points.map((p,i)=>(i?'L':'M')+p.x+','+p.y).join(' ');
 const stats=[
  {Icon:CarFront,label:t('Mașini în garaj','Garage vehicles'),value:String(cars.length),detail:t('Vehicule active','Active vehicles'),run:()=>navigate('Garaj')},
  {Icon:Wrench,label:t('Lucrări planificate','Planned services'),value:String(appointments.length),detail:t('În calendarul mașinii','In this vehicle’s calendar'),run:()=>navigate('Calendar')},
  {Icon:Wallet,label:t('Costuri lunare','Monthly costs'),value:monthKnown?money(finance.monthBani):'—',detail:t('Luna curentă','This month'),run:()=>navigate('Cheltuieli')},
  {Icon:CalendarDays,label:t('Următoarea revizie','Next service'),value:next?.status.remainingKm!=null?Math.max(0,next.status.remainingKm).toLocaleString(locale)+' km':'—',detail:next?t('Până la pragul configurat','Until configured threshold'):t('Interval neconfigurat','No interval set'),run:()=>navigate('Întreținere')},
  {Icon:Files,label:t('Documente în atenție','Documents to review'),value:String(attention.length),detail:t('Expirate sau în 30 de zile','Expired or within 30 days'),run:()=>navigate('Documente')},
  {Icon:Layers3,label:t('Costuri anuale','Annual costs'),value:yearKnown?money(finance.yearBani):'—',detail:today.slice(0,4)+' · '+t('Mașina selectată','Selected vehicle'),run:()=>navigate('Cheltuieli')},
 ];
 return <div className="ac-cockpit" data-workspace-ui>
  <header className="ac-cockpit-welcome"><div><p className="ac-cockpit-eyebrow">{t('BINE AI REVENIT','WELCOME BACK')}</p><h1 id="workspace-page-title" tabIndex={-1}><span data-user-content>{name.trim().split(/\s+/)[0]}</span><span className="ac-cockpit-greeting">{t('Garajul tău, sub control.','Your garage, in control.')}</span></h1></div><div className="ac-cockpit-actions"><button type="button" onClick={()=>navigate('Garaj')}><CarFront size={18}/>{t('Garajul meu','My garage')}</button><button type="button" className="primary" onClick={()=>navigate('Plan întreținere')}><Route size={18}/>SmartDrive</button></div></header>
  {!car?<AppEmpty Icon={CarFront} title={t('Adaugă prima mașină','Add your first vehicle')} description={t('Documente, revizii și costuri. Totul începe cu mașina ta.','Documents, maintenance and costs. Start with your vehicle.')} action={t('Adaugă vehicul','Add vehicle')} onAction={()=>onCreate('vehicle')}/>:<>
  <nav className="ac-cockpit-stats" aria-label={t('Prezentarea garajului','Garage overview')}>{stats.map(({Icon,label,value,detail,run})=><button type="button" key={label} onClick={run}><span className="ac-cockpit-stat-label"><Icon size={21}/>{label}</span><strong>{value}</strong><small>{detail}</small></button>)}</nav>
  <div className="ac-cockpit-main">
   <section className="ac-cockpit-panel ac-cockpit-finance" aria-labelledby="cockpit-finance"><header><h2 id="cockpit-finance"><Wallet size={21}/>{t('Evoluția cheltuielilor','Spending overview')}</h2><select aria-label={t('Perioada financiară','Financial period')} value={period} onChange={e=>setPeriod(e.target.value)}><option value="year">{t('Anul curent','This year')}</option><option value="month">{t('Luna curentă','This month')}</option></select></header><div className="ac-cockpit-chart-summary"><strong>{known?money(costs):'—'}</strong><span>{t('Doar cheltuieli înregistrate','Recorded expenses only')}</span></div><div className="ac-cockpit-chart"><svg viewBox="0 0 590 185" role="img" aria-label={t('Cheltuieli lunare înregistrate','Recorded monthly spending')}><defs><linearGradient id="cockpit-expense-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".23"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>{[36,73,110,148].map(y=><line key={y} x1="30" x2="566" y1={y} y2={y} className="ac-cockpit-gridline"/>)}{yearKnown&&<><path d={line+' L'+points[points.length-1].x+',148 L44,148 Z'} fill="url(#cockpit-expense-fill)"/><path d={line} fill="none" stroke="currentColor" strokeWidth="2.5"/></>}{points.map(({x,y,m})=><g key={m.month}><title>{m.month+' · '+(m.current.known?money(m.current.bani):t('Fără înregistrări','No records'))}</title><circle cx={x} cy={m.current.known?y:148} r={m.current.known?4:3} fill={m.current.known?'currentColor':'none'} stroke="currentColor" strokeDasharray={m.current.known?undefined:'2 2'}/><text x={x} y="176" textAnchor="middle">{new Date(m.month+'-01T12:00:00Z').toLocaleDateString(locale,{month:'short',timeZone:'UTC'})}</text></g>)}</svg></div><footer><span>{t('Cerc gol: fără înregistrări','Hollow dot: no records')}</span><button type="button" onClick={()=>navigate('Cheltuieli')}>{t('Vezi finanțele','View finances')}<ArrowUpRight size={15}/></button></footer>{currency==='EUR'&&<small>{t('Conversie orientativă: 1 EUR = 5 RON.','Indicative conversion: EUR 1 = RON 5.')}</small>}</section>
   <section className="ac-cockpit-panel ac-cockpit-garage" aria-labelledby="cockpit-garage"><header><h2 id="cockpit-garage"><CarFront size={21}/>{t('Mașinile din garaj','Your garage')}</h2><button type="button" onClick={()=>navigate('Garaj')}>{t('Vezi toate','View all')}<ArrowUpRight size={15}/></button></header>{cars.length>1&&<select aria-label={t('Vehicul selectat','Selected vehicle')} value={car.id} onChange={e=>onSelectVehicle(e.target.value)}>{cars.map(v=><option key={v.id} value={v.id} data-user-content>{v.brand} {v.model} · {v.plate}</option>)}</select>}<button type="button" className="ac-cockpit-car" onClick={()=>onVehicle(car.id)}><span className="ac-cockpit-car-icon"><CarFront size={38} strokeWidth={1.4}/></span><span><strong data-user-content>{car.brand} {car.model}</strong><small data-user-content>{car.plate}</small><span className="ac-cockpit-pill">{t('Vehicul selectat','Selected vehicle')}</span></span><ChevronRight size={21}/></button><div className="ac-cockpit-car-meta"><span><Gauge size={16}/>{car.odometer.toLocaleString(locale)} km</span><button type="button" onClick={()=>navigate('Întreținere')}><Wrench size={16}/>{t('Întreținere','Maintenance')}<ArrowUpRight size={14}/></button></div><div className="ac-cockpit-assessment"><ShieldCheck size={20}/><div><strong>{care.complete?care.percent+'% · '+t('Starea evidențelor','Record status'):t('Evaluare incompletă','Incomplete assessment')}</strong><small>{care.valid}/{care.total} {t('verificări în regulă','checks in good standing')}</small></div><button type="button" onClick={()=>navigate('Întreținere')} aria-label={t('Vezi întreținerea','View maintenance')}><ArrowUpRight size={18}/></button></div><p className="ac-cockpit-caption">{care.complete?t('Evaluare din termene. Nu este un diagnostic tehnic.','Based on deadlines. Not a mechanical diagnosis.'):t('Completează RCA, ITP și intervalul schimbului de ulei.','Add insurance, inspection and an oil-service interval.')}</p></section>
  </div>
  <div className="ac-cockpit-bottom">
   <section className="ac-cockpit-panel" aria-labelledby="cockpit-calendar"><header><h2 id="cockpit-calendar"><CalendarDays size={20}/>{t('Următoarele programări','Upcoming appointments')}</h2><button type="button" onClick={()=>navigate('Calendar')} aria-label={t('Vezi calendarul','View calendar')}><ArrowUpRight size={16}/></button></header>{appointments.length?<ul className="ac-cockpit-list">{appointments.slice(0,2).map(({row,date:d})=><li key={row.id}><button type="button" onClick={()=>onRecord(row)}><span className="ac-cockpit-date"><strong>{Number(d.slice(8))}</strong><small>{new Date(d+'T12:00:00Z').toLocaleDateString(locale,{month:'short',timeZone:'UTC'})}</small></span><span className="ac-cockpit-list-copy"><strong data-user-content>{row.title}</strong><small><Clock3 size={13}/>{date(d)}</small></span><ChevronRight size={15}/></button></li>)}</ul>:<p className="ac-cockpit-empty">{t('Nicio programare viitoare.','No upcoming appointments.')}</p>}<button type="button" className="ac-cockpit-inline" onClick={()=>onCreate('service',car.id)}><Wrench size={15}/>{t('Adaugă intervenție','Add maintenance')}<ArrowUpRight size={14}/></button></section>
   <section className="ac-cockpit-panel" aria-labelledby="cockpit-activity"><header><h2 id="cockpit-activity"><History size={20}/>{t('Activitate recentă','Recent activity')}</h2><button type="button" onClick={()=>navigate('Istoric auto')} aria-label={t('Deschide istoricul complet','Open full history')}><ArrowUpRight size={16}/></button></header>{activity.length?<ul className="ac-cockpit-list ac-cockpit-timeline">{activity.map(r=><li key={r.id}><button type="button" onClick={()=>onRecord(r)}><span className="ac-cockpit-dot"/><span className="ac-cockpit-list-copy"><strong data-user-content>{r.title}</strong><small>{r.date&&date(r.date)}</small></span><ChevronRight size={14}/></button></li>)}</ul>:<p className="ac-cockpit-empty">{t('Activitatea apare după prima înregistrare.','Activity appears after your first record.')}</p>}<button type="button" className="ac-cockpit-inline" onClick={()=>onCreate('expense',car.id)}><Wallet size={15}/>{t('Adaugă cheltuială','Add expense')}<ArrowUpRight size={14}/></button></section>
   <section className="ac-cockpit-panel" aria-labelledby="cockpit-documents"><header><h2 id="cockpit-documents"><FileCheck2 size={20}/>{t('Documente importante','Important documents')}</h2><button type="button" onClick={()=>navigate('Documente')} aria-label={t('Toate documentele','All documents')}><ArrowUpRight size={16}/></button></header>{docs.length?<ul className="ac-cockpit-list">{docs.slice(0,3).map(r=><li key={r.id}><button type="button" onClick={()=>onRecord(r)}><Files size={18}/><span className="ac-cockpit-list-copy"><strong data-user-content>{r.category}</strong><small>{r.expiresAt?date(r.expiresAt):t('Fără termen','No expiry date')}</small></span><AppStatus state={r.status.days!=null&&r.status.days<=30?'soon':'valid'}>{r.status.days==null?'—':r.status.days<0?t('Expirat','Expired'):r.status.days+' '+t('zile','days')}</AppStatus></button></li>)}</ul>:<p className="ac-cockpit-empty">{t('Adaugă actele pentru a urmări termenele.','Add documents to track expiry dates.')}</p>}<button type="button" className="ac-cockpit-inline" onClick={()=>onCreate('document',car.id)}><Files size={15}/>{t('Adaugă document','Add document')}<ArrowUpRight size={14}/></button></section>
  </div>
  <section className="ac-cockpit-ai" aria-labelledby="cockpit-ai"><span className="ac-cockpit-ai-icon"><Sparkles size={23}/></span><div><h2 id="cockpit-ai">AutoCare AI <span>Premium</span></h2><p>{t('Claritate pentru următorul drum.','Clarity for your next drive.')}</p></div><form onSubmit={e=>{e.preventDefault();openAI();}}><input aria-label={t('Întrebarea pentru AI','Question for AI')} placeholder={data.premium?t('Întreabă despre mașina ta…','Ask about your vehicle…'):t('Disponibil cu Premium','Available with Premium')} maxLength={600} value={question} onChange={e=>setQuestion(e.target.value)} disabled={!data.premium}/><button type="submit" aria-label={t('Deschide chatul','Open chat')}><Send size={18}/></button></form></section>
  </>}
 </div>;
}
