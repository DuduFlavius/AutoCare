'use client';
import { useState, type CSSProperties } from 'react';
import { ArrowUpRight, Wrench, Files, Wallet, ShieldCheck, Route, CarFront, History, Sparkles, Send } from 'lucide-react';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
import { useMileageUsage } from '../use-mileage-usage';
import { selectActiveVehicle, upcomingMaintenance, homeCareAssessment } from '@/lib/application-home';
import { financeOverview } from '@/lib/finance-overview';
import { calendarRecordDate, isPlannedService } from '@/lib/planned-service';
import { daysRemaining, localDate } from '@/lib/config';
import { AppEmpty, AppStatus } from './ui';
import type { dashboard } from '@/lib/service';
import './home-clarity.css';
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
 const imminent=rows.filter(r=>isPlannedService(r,today)).map(row=>({row,date:calendarRecordDate(row,today)})).filter(item=>item.date).map(item=>({...item,days:daysRemaining(item.date!,new Date(),data.profile.timezone)})).filter(item=>item.days>=0&&item.days<=7).sort((a,b)=>a.days-b.days)[0];
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
 return <div className="ac-clear-home" data-workspace-ui>
  <header className="ac-clear-welcome">
   <div><span className="ac-clear-eyebrow">AUTOCARE · {t('PREZENTARE GENERALĂ','OVERVIEW')}</span><h1 id="workspace-page-title" tabIndex={-1}>{t('Bună, ','Hello, ')}<span data-user-content>{name.trim().split(/\s+/)[0]}</span></h1>
    {car&&<div className="ac-clear-vehicle"><button type="button" onClick={()=>onVehicle(car.id)} data-user-content>{car.brand} {car.model}<span>{car.plate}</span></button><small>{car.odometer.toLocaleString(locale)} km · {t('kilometraj înregistrat','recorded mileage')}</small></div>}
   </div>
   <div className="ac-clear-header-actions">{cars.length>1&&<select aria-label={t('Vehicul selectat','Selected vehicle')} value={car?.id??''} onChange={e=>onSelectVehicle(e.target.value)}>{cars.map(v=><option key={v.id} value={v.id} data-user-content>{v.brand} {v.model} · {v.plate}</option>)}</select>}<button type="button" onClick={()=>navigate('Garaj')}><CarFront size={17}/>{t('Garajul meu','My garage')}</button><button type="button" onClick={()=>navigate('Plan întreținere')}><Route size={17}/>SmartDrive</button></div>
   {car&&<nav className="ac-clear-shortcuts" aria-label={t('Acțiuni rapide','Quick actions')}>{[{Icon:Wrench,label:t('Adaugă intervenție','Add maintenance'),run:()=>onCreate('service',car.id)},{Icon:Wallet,label:t('Adaugă cheltuială','Add expense'),run:()=>onCreate('expense',car.id)},{Icon:Files,label:t('Adaugă document','Add document'),run:()=>onCreate('document',car.id)},{Icon:Route,label:'SmartDrive',run:()=>navigate('Plan întreținere')}].map(({Icon,label,run})=><button type="button" key={label} onClick={run}><Icon size={17}/><span>{label}</span></button>)}</nav>}
  </header>
  {!car?<AppEmpty Icon={CarFront} title={t('Adaugă prima mașină','Add your first vehicle')} description={t('Începe cu mașina ta. Documentele, întreținerea și costurile vor fi grupate aici.','Start with your vehicle. Documents, maintenance and costs will appear here.')} action={t('Adaugă vehicul','Add vehicle')} onAction={()=>onCreate('vehicle')}/>:<>
   <section className="ac-clear-card ac-clear-health" aria-labelledby="ac-clear-health-title">
    <div className="ac-clear-section-title"><span className="ac-clear-icon"><ShieldCheck size={21}/></span><h2 id="ac-clear-health-title">{t('Starea mașinii','Vehicle status')}</h2><span className="ac-clear-tag">{care.complete?t('Evaluare din evidențe','Record-based assessment'):t('Evaluare incompletă','Incomplete assessment')}</span></div>
    <div className="ac-clear-health-body"><div className="ac-clear-score" style={{'--score':(care.percent??0)+'%'} as CSSProperties}><strong>{care.percent===null?'—':care.percent+'%'}</strong><span>{care.valid}/{care.total} {t('verificări în regulă','checks in good standing')}</span></div>
     <div className="ac-clear-next"><small>{t('Următorul termen important','Next important deadline')}</small>{attention[0]?<><h3 data-user-content>{attention[0].title}</h3><p>{attention[0].status.days!<0?t('Document expirat','Document expired'):attention[0].status.days+' '+t('zile rămase','days remaining')}</p><button type="button" onClick={()=>onRecord(attention[0])}>{t('Vezi documentul','View document')}<ArrowUpRight size={15}/></button></>:imminent?<><h3 data-user-content>{imminent.row.title}</h3><p>{imminent.days===0?t('Astăzi','Today'):imminent.days+' '+t('zile până la programare','days until appointment')}</p><button type="button" onClick={()=>navigate('Calendar')}>{t('Vezi calendarul','View calendar')}<ArrowUpRight size={15}/></button></>:next?<><h3 data-user-content>{next.service.title}</h3><p>{next.status.remainingKm!=null?(next.status.remainingKm<0?t('Depășit cu ','Overdue by '):t('Mai sunt ','Remaining: '))+Math.abs(next.status.remainingKm).toLocaleString(locale)+' km':next.estimate?.days!=null?t('Estimare: ','Estimate: ')+next.estimate.days+' '+t('zile','days'):t('Consultă termenul configurat','Review the configured deadline')}</p><button type="button" onClick={()=>navigate('Întreținere')}>{t('Vezi întreținerea','View maintenance')}<ArrowUpRight size={15}/></button></>:<><h3>{t('Niciun termen configurat','No deadline configured')}</h3><button type="button" onClick={()=>onCreate('service',car.id)}>{t('Configurează întreținerea','Set up maintenance')}<ArrowUpRight size={15}/></button></>}</div>
    </div>
    <p className="ac-clear-caption">{care.complete?t('Scor bazat pe termenele înregistrate. Nu reprezintă un diagnostic tehnic.','Based on recorded deadlines. This is not a mechanical diagnosis.'):t('Completează RCA, ITP și intervalul schimbului de ulei pentru o evaluare completă.','Add liability insurance, inspection and an oil-service interval for a complete assessment.')}</p>
    {!!activity.length&&<details className="ac-clear-activity"><summary><History size={15}/>{t('Activitate recentă','Recent activity')}<span>{activity.length}</span></summary><ul>{activity.map(r=><li key={r.id}><button type="button" onClick={()=>onRecord(r)}><strong data-user-content>{r.title}</strong><small>{r.date&&date(r.date)}</small><ArrowUpRight size={14}/></button></li>)}</ul><button type="button" onClick={()=>navigate('Istoric auto')}>{t('Deschide istoricul complet','Open full history')}<ArrowUpRight size={14}/></button></details>}
   </section>
   <section className="ac-clear-card ac-clear-docs" aria-labelledby="ac-clear-docs-title"><div className="ac-clear-section-title"><span className="ac-clear-icon"><Files size={21}/></span><h2 id="ac-clear-docs-title">{t('Documentele mele','My documents')}</h2></div>
    {attention.length?<ul className="ac-clear-document-list">{attention.slice(0,3).map(r=><li key={r.id}><button type="button" onClick={()=>onRecord(r)}><span><strong data-user-content>{r.category}</strong><small>{r.expiresAt&&date(r.expiresAt)}</small></span><AppStatus state={r.status.days!<0?'overdue':'soon'}>{r.status.days!<0?t('Expirat','Expired'):r.status.days+' '+t('zile','days')}</AppStatus></button></li>)}</ul>:<p className="ac-clear-doc-summary"><ShieldCheck size={19}/>{docs.length?(docs.some(doc=>doc.status.days==null)?t('Completează datele de expirare lipsă pentru un rezumat sigur.','Complete missing expiry dates before relying on this summary.'):t('Niciun document înregistrat nu expiră în următoarele 30 de zile.','No recorded documents expire within the next 30 days.')):t('Adaugă documentele pentru a urmări expirările.','Add documents to track their expiry dates.')}</p>}
    <div className="ac-clear-document-types">{['ITP','RCA','Rovinietă','CASCO'].filter(kind=>kind!=='CASCO'||docs.some(r=>r.category===kind)).map(kind=>{const doc=docs.find(r=>r.category===kind);return <span key={kind}>{kind==='Rovinietă'?t('Rovinietă','Road vignette'):kind}<small>{!doc?t('Lipsește','Missing'):doc.status.days==null?t('Fără termen','No deadline'):doc.status.days<=30?t('De verificat','Review'):t('În regulă','Valid')}</small></span>})}</div>
    <button type="button" className="ac-clear-link" onClick={()=>navigate('Documente')}>{t('Toate documentele','All documents')}<ArrowUpRight size={15}/></button>
   </section>
   <section className="ac-clear-card ac-clear-finance" aria-labelledby="ac-clear-finance-title"><div className="ac-clear-section-title"><span className="ac-clear-icon"><Wallet size={21}/></span><h2 id="ac-clear-finance-title">{t('Costurile mașinii','Vehicle costs')}</h2><select aria-label={t('Perioada financiară','Financial period')} value={period} onChange={e=>setPeriod(e.target.value)}><option value="year">{t('Anul curent','This year')}</option><option value="month">{t('Luna curentă','This month')}</option></select></div>
    <strong className="ac-clear-money">{known?money(costs):'—'}</strong><p className="ac-clear-caption">{!known?t('Nicio cheltuială cu sumă cunoscută în această perioadă.','No expenses with known amounts in this period.'):period==='year'&&currentMonth&&currentMonth.current.known?t('Luna curentă: ','This month: ')+money(finance.monthBani):t('Total înregistrat pentru perioada selectată','Recorded total for the selected period')}</p>
    <div className="ac-clear-bars" aria-label={t('Evoluția costurilor în anul curent','Cost trend for the current year')}>{annualMonths.map(m=><div key={m.month} title={m.month+' · '+(m.current.known?money(m.current.bani):t('Fără înregistrări','No records'))}><span className={!m.current.known?'is-missing':''}><i style={{height:m.current.known?Math.max(3,m.current.bani/largest*100)+'%':'0'}}/></span><small>{new Date(m.month+'-01T12:00:00Z').toLocaleDateString(locale,{month:'short',timeZone:'UTC'})}</small></div>)}</div>
    {currency==='EUR'&&<p className="ac-clear-caption">{t('Conversie orientativă: 1 EUR = 5 RON.','Indicative conversion: EUR 1 = RON 5.')}</p>}<button type="button" className="ac-clear-link" onClick={()=>navigate('Cheltuieli')}>{t('Deschide finanțele','Open finances')}<ArrowUpRight size={15}/></button>
   </section>
   <section className="ac-clear-card ac-clear-ai" aria-labelledby="ac-clear-ai-title"><div className="ac-clear-section-title"><span className="ac-clear-icon"><Sparkles size={21}/></span><h2 id="ac-clear-ai-title">AutoCare AI</h2><span className="ac-clear-tag">Premium</span></div><p>{t('Ai întrebări despre mașina ta? Continuă în asistentul personal.','Questions about your vehicle? Continue in your personal assistant.')}</p><form onSubmit={e=>{e.preventDefault();openAI();}}><input aria-label={t('Întrebarea pentru AI','Question for AI')} placeholder={t('Scrie o întrebare…','Ask a question…')} maxLength={600} value={question} onChange={e=>setQuestion(e.target.value)} disabled={!data.premium}/><button type="submit" aria-label={t('Deschide chatul','Open chat')}><Send size={18}/></button></form><button type="button" className="ac-clear-link" onClick={openAI}>{data.premium?t('Deschide chatul complet','Open full chat'):t('Activează Premium pentru AI','Get Premium for AI')}<ArrowUpRight size={15}/></button></section>
  </>}
 </div>;
}
