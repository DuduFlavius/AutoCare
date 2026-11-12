'use client';
import { useState } from 'react';
import { dashboardCopy } from '@/lib/dashboard-copy';
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
 const t=(ro:string)=>en?(dashboardCopy[ro]??ro):ro;
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
  {Icon:CarFront,label:t('Mașini în garaj'),value:String(cars.length),detail:t('Vehicule active'),run:()=>navigate('Garaj')},
  {Icon:CalendarDays,label:t('Revizii următoare'),value:String(maintenance.length+appointments.length),detail:t('Intervale și lucrări planificate'),run:()=>navigate('Calendar')},
  {Icon:Wallet,label:t('Costuri lunare'),value:monthKnown?money(finance.monthBani):'—',detail:t('Luna curentă'),run:()=>navigate('Cheltuieli')},
  {Icon:Gauge,label:t('Kilometraj confirmat'),value:car?car.odometer.toLocaleString(locale)+' km':'—',detail:t('Ultima valoare înregistrată'),run:()=>navigate('Kilometraj')},
  {Icon:Files,label:t('Documente în atenție'),value:String(attention.length),detail:t('Expirate sau în 30 de zile'),run:()=>navigate('Documente')},
  {Icon:Layers3,label:t('Starea mentenanței'),value:care.complete?care.valid+'/'+care.total:t('Incompletă'),detail:care.complete?t('Verificări în termen'):t('Completează intervalele și actele'),run:()=>navigate('Întreținere')},
 ];
 return <div className="ac-cockpit" data-workspace-ui>
  <header className="ac-cockpit-welcome"><div><p className="ac-cockpit-eyebrow">{t('BINE AI REVENIT')}</p><h1 id="workspace-page-title" tabIndex={-1}>{t('Salut, ')}<span data-user-content>{name.trim().split(/\s+/)[0]}!</span><span className="ac-cockpit-greeting">{t('Garajul tău, sub control.')}</span></h1></div><div className="ac-cockpit-actions"><button type="button" onClick={()=>navigate('Garaj')}><CarFront size={18}/>{t('Garajul meu')}</button><button type="button" className="primary" onClick={()=>navigate('Plan întreținere')}><Route size={18}/>SmartDrive</button></div></header>
  {!car?<AppEmpty Icon={CarFront} title={t('Adaugă prima mașină')} description={t('Documente, revizii și costuri. Totul începe cu mașina ta.')} action={t('Adaugă vehicul')} onAction={()=>onCreate('vehicle')}/>:<>
  <nav className="ac-cockpit-stats" aria-label={t('Prezentarea garajului')}>{stats.map(({Icon,label,value,detail,run})=><button type="button" key={label} onClick={run}><span className="ac-cockpit-stat-label"><Icon size={21}/>{label}</span><strong>{value}</strong><small>{detail}</small></button>)}</nav>
  <div className="ac-cockpit-main">
   <section className="ac-cockpit-panel ac-cockpit-finance" aria-labelledby="cockpit-finance"><header><h2 id="cockpit-finance"><Wallet size={21}/>{t('Evoluția cheltuielilor')}</h2><select aria-label={t('Perioada financiară')} value={period} onChange={e=>setPeriod(e.target.value)}><option value="year">{t('Anul curent')}</option><option value="month">{t('Luna curentă')}</option></select></header><div className="ac-cockpit-chart-summary"><strong>{known?money(costs):'—'}</strong><span>{t('Doar cheltuieli înregistrate')}</span></div><div className="ac-cockpit-chart"><svg viewBox="0 0 590 185" role="img" aria-label={t('Cheltuieli lunare înregistrate')}><defs><linearGradient id="cockpit-expense-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".23"/><stop offset="100%" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>{[36,73,110,148].map(y=><line key={y} x1="30" x2="566" y1={y} y2={y} className="ac-cockpit-gridline"/>)}{yearKnown&&<><path d={line+' L'+points[points.length-1].x+',148 L44,148 Z'} fill="url(#cockpit-expense-fill)"/><path d={line} fill="none" stroke="currentColor" strokeWidth="2.5"/></>}{points.map(({x,y,m})=><g key={m.month}><title>{m.month+' · '+(m.current.known?money(m.current.bani):t('Fără înregistrări'))}</title><circle cx={x} cy={m.current.known?y:148} r={m.current.known?4:3} fill={m.current.known?'currentColor':'none'} stroke="currentColor" strokeDasharray={m.current.known?undefined:'2 2'}/><text x={x} y="176" textAnchor="middle">{new Date(m.month+'-01T12:00:00Z').toLocaleDateString(locale,{month:'short',timeZone:'UTC'})}</text></g>)}</svg></div><footer><span>{t('Cerc gol: fără înregistrări')}</span><button type="button" onClick={()=>navigate('Cheltuieli')}>{t('Vezi finanțele')}<ArrowUpRight size={15}/></button></footer>{currency==='EUR'&&<small>{t('Conversie orientativă: 1 EUR = 5 RON.')}</small>}</section>
   <section className="ac-cockpit-panel ac-cockpit-garage" aria-labelledby="cockpit-garage"><header><h2 id="cockpit-garage"><CarFront size={21}/>{t('Mașinile din garaj')}</h2><button type="button" onClick={()=>navigate('Garaj')}>{t('Vezi toate')}<ArrowUpRight size={15}/></button></header>{cars.length>1&&<select aria-label={t('Vehicul selectat')} value={car.id} onChange={e=>onSelectVehicle(e.target.value)}>{cars.map(v=><option key={v.id} value={v.id} data-user-content>{v.brand} {v.model} · {v.plate}</option>)}</select>}<button type="button" className="ac-cockpit-car" onClick={()=>onVehicle(car.id)}><span className="ac-cockpit-car-icon"><CarFront size={38} strokeWidth={1.4}/></span><span><strong data-user-content>{car.brand} {car.model}</strong><small data-user-content>{car.plate}</small><span className="ac-cockpit-pill">{t('Vehicul selectat')}</span></span><ChevronRight size={21}/></button><div className="ac-cockpit-car-meta"><span><Gauge size={16}/>{car.odometer.toLocaleString(locale)} km</span><button type="button" onClick={()=>navigate('Întreținere')}><Wrench size={16}/>{t('Întreținere')}<ArrowUpRight size={14}/></button></div><div className="ac-cockpit-assessment"><ShieldCheck size={20}/><div><strong>{care.complete?care.percent+'% · '+t('Starea evidențelor'):t('Evaluare incompletă')}</strong><small>{care.valid}/{care.total} {t('verificări în regulă')}</small></div><button type="button" onClick={()=>navigate('Întreținere')} aria-label={t('Vezi întreținerea')}><ArrowUpRight size={18}/></button></div><p className="ac-cockpit-caption">{care.complete?t('Evaluare din termene. Nu este un diagnostic tehnic.'):t('Completează RCA, ITP și intervalul schimbului de ulei.')}</p></section>
  </div>
  <div className="ac-cockpit-bottom">
   <section className="ac-cockpit-panel" aria-labelledby="cockpit-activity"><header><h2 id="cockpit-activity"><History size={20}/>{t('Activitate recentă')}</h2><button type="button" onClick={()=>navigate('Istoric auto')} aria-label={t('Deschide istoricul complet')}><ArrowUpRight size={16}/></button></header>{activity.length?<ul className="ac-cockpit-list ac-cockpit-timeline">{activity.map(r=><li key={r.id}><button type="button" onClick={()=>onRecord(r)}><span className="ac-cockpit-dot"/><span className="ac-cockpit-list-copy"><strong data-user-content>{r.title}</strong><small>{r.date&&date(r.date)}</small></span><ChevronRight size={14}/></button></li>)}</ul>:<p className="ac-cockpit-empty">{t('Activitatea apare după prima înregistrare.')}</p>}<button type="button" className="ac-cockpit-inline" onClick={()=>onCreate('expense',car.id)}><Wallet size={15}/>{t('Adaugă cheltuială')}<ArrowUpRight size={14}/></button></section>
   <section className="ac-cockpit-panel" aria-labelledby="cockpit-documents"><header><h2 id="cockpit-documents"><FileCheck2 size={20}/>{t('Documente importante')}</h2><button type="button" onClick={()=>navigate('Documente')} aria-label={t('Toate documentele')}><ArrowUpRight size={16}/></button></header>{docs.length?<ul className="ac-cockpit-list">{docs.slice(0,3).map(r=><li key={r.id}><button type="button" onClick={()=>onRecord(r)}><Files size={18}/><span className="ac-cockpit-list-copy"><strong data-user-content>{r.category}</strong><small>{r.expiresAt?date(r.expiresAt):t('Fără termen')}</small></span><AppStatus state={r.status.days!=null&&r.status.days<=30?'soon':'valid'}>{r.status.days==null?'—':r.status.days<0?t('Expirat'):r.status.days+' '+t('zile')}</AppStatus></button></li>)}</ul>:<p className="ac-cockpit-empty">{t('Adaugă actele pentru a urmări termenele.')}</p>}<button type="button" className="ac-cockpit-inline" onClick={()=>onCreate('document',car.id)}><Files size={15}/>{t('Adaugă document')}<ArrowUpRight size={14}/></button></section>   <section className="ac-cockpit-panel" aria-labelledby="cockpit-recommendations"><header><h2 id="cockpit-recommendations"><Sparkles size={20}/>{t('Recomandări inteligente')}</h2><button type="button" onClick={()=>navigate('Calendar')} aria-label={t('Vezi calendarul')}><ArrowUpRight size={16}/></button></header>{appointments.length?<ul className="ac-cockpit-list">{appointments.slice(0,2).map(({row,date:d})=><li key={row.id}><button type="button" onClick={()=>onRecord(row)}><span className="ac-cockpit-date"><strong>{Number(d.slice(8))}</strong><small>{new Date(d+'T12:00:00Z').toLocaleDateString(locale,{month:'short',timeZone:'UTC'})}</small></span><span className="ac-cockpit-list-copy"><strong data-user-content>{row.title}</strong><small><Clock3 size={13}/>{date(d)}</small></span><ChevronRight size={15}/></button></li>)}</ul>:<div className="ac-cockpit-recommendation"><span className="ac-cockpit-car-icon"><CalendarDays size={25}/></span><div><strong data-user-content>{attention[0]?.title??next?.service.title??t('Completează evidența mașinii')}</strong><p>{attention[0]?.status.days!=null?(attention[0].status.days<0?t('Document expirat'):attention[0].status.days+' '+t('zile până la expirare')):next?.status.remainingKm!=null?Math.max(0,next.status.remainingKm).toLocaleString(locale)+' km '+t('până la prag'):t('Adaugă termenele pentru alerte utile.')}</p><button type="button" onClick={()=>attention[0]?onRecord(attention[0]):navigate('Întreținere')}>{t('Vezi detalii')}<ArrowUpRight size={14}/></button></div></div>}<button type="button" className="ac-cockpit-inline" onClick={()=>onCreate('service',car.id)}><Wrench size={15}/>{t('Adaugă intervenție')}<ArrowUpRight size={14}/></button></section>

  </div>
  <nav className="ac-cockpit-context" aria-label={t('Acțiuni și situație curentă')}>
   <button type="button" onClick={()=>navigate('Plan întreținere')}><Route size={21}/><span><strong>SmartDrive GPS</strong><small>{data.monthlyTrips.some(trip=>trip.vehicleId===car.id)?(data.monthlyTrips.filter(trip=>trip.vehicleId===car.id).reduce((sum,trip)=>sum+Number(trip.meters),0)/1000).toLocaleString(locale,{maximumFractionDigits:1})+' km · '+t('luna aceasta'):t('Nicio călătorie salvată luna aceasta')}</small></span><ArrowUpRight size={17}/></button>
   <button type="button" onClick={()=>navigate('Notificări')}><ShieldCheck size={21}/><span><strong>{t('Notificări')}</strong><small>{data.notifications.filter(item=>!item.readAt).length} {t('mesaje necitite')}</small></span><ArrowUpRight size={17}/></button>
   <button type="button" onClick={()=>navigate('Rapoarte')}><Layers3 size={21}/><span><strong>{t('Rapoartele vehiculului')}</strong><small>{t('Istoric, costuri și documente')}</small></span><ArrowUpRight size={17}/></button>
  </nav>
  <section className="ac-cockpit-ai" aria-labelledby="cockpit-ai"><span className="ac-cockpit-ai-icon"><Sparkles size={23}/></span><div><h2 id="cockpit-ai">AutoCare AI <span>Premium</span></h2><p>{t('Claritate pentru următorul drum.')}</p></div><form onSubmit={e=>{e.preventDefault();openAI();}}><input aria-label={t('Întrebarea pentru AI')} placeholder={data.premium?t('Întreabă despre mașina ta…'):t('Disponibil cu Premium')} maxLength={600} value={question} onChange={e=>setQuestion(e.target.value)} disabled={!data.premium}/><button type="submit" aria-label={t('Deschide chatul')}><Send size={18}/></button></form></section>
  </>}
 </div>;
}
