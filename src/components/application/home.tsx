'use client';
import { useState } from 'react';
import { dashboardCopy } from '@/lib/dashboard-copy';
import { ArrowUpRight, Wrench, Files, Wallet, CarFront, Gauge, History, Sparkles, Send, CalendarDays, ChevronRight, Clock3, FileCheck2, Plus } from 'lucide-react';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { useMileageUsage } from '../use-mileage-usage';
import { selectActiveVehicle, upcomingMaintenance, homeCareAssessment } from '@/lib/application-home';
import { financeOverview } from '@/lib/finance-overview';
import { calendarRecordDate, isPlannedService } from '@/lib/planned-service';
import { localDate } from '@/lib/config';
import { AppEmpty } from './ui';
import type { dashboard } from '@/lib/service';
import './reference-dashboard.css';
type Data = Awaited<ReturnType<typeof dashboard>>;
type Row = Data['records'][number];
type Props = {data:Data;name:string;selectedVehicle:string;onSelectVehicle:(id:string)=>void;navigate:(tab:string)=>void;onVehicle:(id:string)=>void;onCreate:(kind:'vehicle'|'service'|'document'|'expense',vehicleId?:string)=>void;onRecord:(record:Row)=>void;onRefresh:()=>Promise<void>;currency:'RON'|'EUR';preview:boolean};
export default function ApplicationHome({data,name,selectedVehicle,onSelectVehicle,navigate,onVehicle,onCreate,onRecord,currency,preview}:Props) {
 const en=useApplicationLanguage()==='en', locale=useApplicationLocale();
 const t=(ro:string)=>en?(dashboardCopy[ro]??ro):ro;
 const car=selectActiveVehicle(data.vehicles,selectedVehicle),cars=data.vehicles.filter(v=>!v.archived);
 const usage=useMileageUsage(car?.id??'',car?.odometer??0,preview);
 const [period,setPeriod]=useState('12'),[question,setQuestion]=useState('');
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
 const activity=recorded.filter(r=>r.date&&r.date<=today).sort((a,b)=>(b.date??'').localeCompare(a.date??'')).slice(0,3);
 const money=(bani:number)=>new Intl.NumberFormat(locale,{style:'currency',currency,maximumFractionDigits:0}).format(bani/(currency==='EUR'?500:100));
 const date=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
 const openAI=()=>{
  if(!car)return;
  if(!data.premium){navigate('Premium');return;}
  try { sessionStorage.setItem('autocare-ai-draft:'+car.id,question.trim()); } catch { /* Full chat remains accessible without storage. */ }
  navigate('AutoCare AI');
 };

 const months=period==='6'?finance.series.filter(m=>m.month<=today.slice(0,7)).slice(-6):finance.series;
 const largest=Math.max(100,...months.flatMap(m=>[m.current.bani,m.previous.bani]));
 const chartPoints=(key:'current'|'previous')=>months.map((m,i)=>({x:58+i*700/Math.max(1,months.length-1),y:190-m[key].bani/largest*156,known:m[key].known>0,bani:m[key].bani,month:m.month}));
 const line=(key:'current'|'previous')=>{let open=false;return chartPoints(key).map(p=>{if(!p.known){open=false;return '';}const segment=(open?'L':'M')+p.x+','+p.y;open=true;return segment;}).join(' ');};
 const area=()=>{let output='';let segment:ReturnType<typeof chartPoints>=[];const close=()=>{if(segment.length>1)output+='M'+segment[0].x+',190 '+segment.map(p=>'L'+p.x+','+p.y).join(' ')+' L'+segment[segment.length-1].x+',190 Z ';segment=[];};for(const point of chartPoints('current')){if(point.known)segment.push(point);else close();}close();return output;};
 const total=months.reduce((sum,m)=>sum+m.current.bani,0);
 const measured=months.some(m=>m.current.known>0);
 const stats=[
  {Icon:CarFront,label:t('Total mașini'),value:String(cars.length),detail:t('În garajul tău'),go:'Garaj'},
  {Icon:Wrench,label:t('Lucrări planificate'),value:String(appointments.length),detail:t('În calendar'),go:'Calendar'},
  {Icon:CalendarDays,label:t('Revizii următoare'),value:String(maintenance.length),detail:next?.status.remainingKm!=null?Math.max(0,next.status.remainingKm).toLocaleString(locale)+' km '+t('până la prag'):t('Intervale înregistrate'),go:'Întreținere'},
  {Icon:Files,label:t('Documente care expiră'),value:String(attention.length),detail:t('În următoarele 30 de zile'),go:'Documente'},
  {Icon:Gauge,label:t('Kilometraj confirmat'),value:car?car.odometer.toLocaleString(locale):'—',detail:car?'km · '+car.plate:t('Ultima valoare înregistrată'),go:'Kilometraj'},
 ];
 return <div className="ac-reference" data-workspace-ui>
  <header className="ac-ref-welcome"><div><p>{t('Bine ai venit,')}</p><h1 id="workspace-page-title" tabIndex={-1}><span data-user-content>{name.trim().split(/\s+/)[0]}!</span> <span className="ac-ref-wave" aria-hidden="true">👋</span></h1><span>{t('Garajul tău. Mereu sub control.')}</span></div><div className="ac-ref-hero-actions"><button onClick={()=>navigate('Garaj')}><CarFront size={20}/>{t('Garajul meu')}</button><button className="ac-ref-primary" onClick={()=>navigate('Plan întreținere')}><Send size={20}/>SmartDrive</button></div></header>
  {!car?<AppEmpty Icon={CarFront} title={t('Adaugă prima mașină')} description={t('Documente, revizii și costuri. Totul începe cu mașina ta.')} action={t('Adaugă vehicul')} onAction={()=>onCreate('vehicle')}/>:<>
  <div className="ac-ref-scope"><span><span className="ac-ref-live"/>{t('Prezentarea garajului')}</span><label><CarFront size={14}/><select aria-label={t('Vehicul selectat')} value={car.id} onChange={e=>onSelectVehicle(e.target.value)}>{cars.map(v=><option key={v.id} value={v.id}>{v.brand} {v.model} · {v.plate}</option>)}</select></label></div>
  <nav className="ac-ref-stats" aria-label={t('Prezentarea garajului')}>{stats.map(({Icon,label,value,detail,go},i)=><button key={go} className={'ac-ref-stat ac-ref-stat-'+i} onClick={()=>navigate(go)}><span className="ac-ref-stat-icon"><Icon size={28}/></span><span className="ac-ref-stat-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></span></button>)}</nav>
  <div className="ac-ref-main">
   <section className="ac-ref-panel ac-ref-finance"><header><h2><span className="ac-ref-heading-icon"><Wallet size={23}/></span>{t('Statistici financiare')}</h2><select aria-label={t('Perioada financiară')} value={period} onChange={e=>setPeriod(e.target.value)}><option value="12">{t('Anul curent')}</option><option value="6">{t('Ultimele 6 luni')}</option></select></header><div className="ac-ref-chart-meta"><strong>{measured?money(total):'—'}</strong><div><span><i/>{today.slice(0,4)}</span><span><i/>{Number(today.slice(0,4))-1}</span></div></div><div className="ac-ref-chart"><svg viewBox="0 0 800 232" role="img" aria-label={t('Cheltuieli înregistrate, comparate cu anul precedent')}><defs><linearGradient id="ref-chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#7863ff" stopOpacity=".28"/><stop offset="1" stopColor="#7863ff" stopOpacity="0"/></linearGradient></defs>{[0,1,2,3].map(i=><g key={i}><line x1="58" x2="770" y1={190-i*52} y2={190-i*52}/><text x="45" y={194-i*52} textAnchor="end">{new Intl.NumberFormat(locale,{notation:'compact',maximumFractionDigits:1}).format(largest*i/3/(currency==='EUR'?500:100))}</text></g>)}{months.map((m,i)=><line key={m.month} className="ac-ref-chart-vertical" x1={58+i*700/Math.max(1,months.length-1)} x2={58+i*700/Math.max(1,months.length-1)} y1="34" y2="190"/>)}<path d={area()} fill="url(#ref-chart-fill)"/>{(['current','previous'] as const).map((key,index)=><g key={key} className={'ac-ref-series-'+index}><path d={line(key)} fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>{chartPoints(key).map(p=><g key={p.month}><title>{(index?Number(today.slice(0,4))-1:today.slice(0,4))+' · '+p.month.slice(5)+' · '+(p.known?money(p.bani):t('Fără înregistrări'))}</title>{p.known?<circle cx={p.x} cy={p.y} r="4.5"/>:index===0?<circle className="ac-ref-missing" cx={p.x} cy="190" r="3"/>:null}</g>)}</g>)}{months.map((m,i)=><text className={i%2?'ac-ref-month-alternate':undefined} key={m.month} x={58+i*700/Math.max(1,months.length-1)} y="222" textAnchor="middle">{new Date(m.month+'-01T12:00:00Z').toLocaleDateString(locale,{month:'short',timeZone:'UTC'})}</text>)}</svg></div><footer><span>{currency==='EUR'?t('Conversie orientativă: 1 EUR = 5 RON.'):t('Doar cheltuieli înregistrate')} · {t('Cerc gol: fără înregistrări')}</span><button onClick={()=>navigate('Cheltuieli')}>{t('Vezi finanțele')}<ArrowUpRight size={15}/></button></footer></section>
   <section className="ac-ref-panel ac-ref-garage"><header><h2><span className="ac-ref-heading-icon"><CarFront size={25}/></span>{t('Mașinile din garaj')}</h2><div className="ac-ref-garage-actions"><button onClick={()=>onCreate('vehicle')} aria-label={t('Adaugă vehicul')}><Plus size={17}/></button><button onClick={()=>navigate('Garaj')}>{t('Vezi toate')}<ArrowUpRight size={16}/></button></div></header><ul>{cars.slice(0,3).map(v=><li key={v.id} data-selected={v.id===car.id}><button className="ac-ref-garage-select" onClick={()=>onSelectVehicle(v.id)} aria-pressed={v.id===car.id}><span className="ac-ref-vehicle-icon"><CarFront size={30} strokeWidth={1.8}/></span><span><strong data-user-content>{v.brand} {v.model}</strong><small data-user-content>{v.plate}</small></span><span className="ac-ref-vehicle-km">{v.odometer.toLocaleString(locale)} km</span></button><button className="ac-ref-car-open" onClick={()=>onVehicle(v.id)} aria-label={t('Vezi detalii')+' '+v.brand+' '+v.model}><ArrowUpRight size={17}/></button></li>)}</ul><div className="ac-ref-care"><span><span className="ac-ref-live"/>{care.complete?care.valid+'/'+care.total+' '+t('verificări în regulă'):t('Evaluare incompletă')}</span><button onClick={()=>navigate('Întreținere')}>{t('Întreținere')}<ArrowUpRight size={14}/></button></div></section>
  </div>
  <div className="ac-ref-bottom">
   <section className="ac-ref-panel"><header><h2><CalendarDays size={23}/>{t('Următoarele programări')}</h2><button onClick={()=>navigate('Calendar')} aria-label={t('Vezi calendarul')}><ArrowUpRight size={17}/></button></header>{appointments.length?<ul className="ac-ref-appointments">{appointments.slice(0,2).map(({row,date:d})=><li key={row.id}><button onClick={()=>onRecord(row)}><span className="ac-ref-date"><strong>{Number(d.slice(8))}</strong><small>{new Date(d+'T12:00:00Z').toLocaleDateString(locale,{month:'short',timeZone:'UTC'})}</small></span><span className="ac-ref-row-copy"><strong data-user-content>{row.title}</strong><small data-user-content>{car.brand} {car.model}</small></span><Clock3 size={16}/></button></li>)}</ul>:<div className="ac-ref-empty"><CalendarDays size={26}/><p>{t('Nicio lucrare planificată')}</p><button onClick={()=>onCreate('service',car.id)}>{t('Adaugă intervenție')}<Plus size={15}/></button></div>}</section>
   <section className="ac-ref-panel"><header><h2><History size={23}/>{t('Activitate recentă')}</h2><button onClick={()=>navigate('Istoric auto')} aria-label={t('Deschide istoricul complet')}><ArrowUpRight size={17}/></button></header>{activity.length?<ul className="ac-ref-timeline">{activity.map(r=><li key={r.id}><button onClick={()=>onRecord(r)}><i/><span className="ac-ref-row-copy"><strong data-user-content>{r.title}</strong><small>{r.date&&date(r.date)}</small></span><ChevronRight size={15}/></button></li>)}</ul>:<div className="ac-ref-empty"><History size={26}/><p>{t('Activitatea apare după prima înregistrare.')}</p></div>}</section>
   <section className="ac-ref-panel"><header><h2><Files size={23}/>{t('Documente importante')}</h2><button onClick={()=>navigate('Documente')} aria-label={t('Toate documentele')}><ArrowUpRight size={17}/></button></header>{docs.length?<ul className="ac-ref-documents">{docs.slice(0,3).map(r=><li key={r.id}><button onClick={()=>onRecord(r)}><span className="ac-ref-doc-icon"><FileCheck2 size={20}/></span><span className="ac-ref-row-copy"><strong data-user-content>{r.category} · {car.brand}</strong><small>{r.expiresAt?date(r.expiresAt):t('Fără termen')}</small></span><span className="ac-ref-doc-open"><ArrowUpRight size={15}/></span></button></li>)}</ul>:<div className="ac-ref-empty"><Files size={26}/><p>{t('Adaugă actele pentru a urmări termenele.')}</p><button onClick={()=>onCreate('document',car.id)}>{t('Adaugă document')}<Plus size={15}/></button></div>}</section>
  </div>
  <section className="ac-ref-ai"><span className="ac-ref-ai-icon"><Sparkles size={22}/></span><div><strong>AutoCare AI <small>Premium</small></strong><p>{t('Claritate pentru următorul drum.')}</p></div><form onSubmit={e=>{e.preventDefault();openAI();}}><input aria-label={t('Întrebarea pentru AI')} placeholder={data.premium?t('Întreabă despre mașina ta…'):t('Disponibil cu Premium')} maxLength={600} value={question} onChange={e=>setQuestion(e.target.value)} disabled={!data.premium}/><button type="submit" aria-label={t('Deschide chatul')}><Send size={18}/></button></form></section>
  </>}
 </div>;
}
