'use client';

import type { dashboard } from '@/lib/service';
import { homeDocument, upcomingMaintenance } from '@/lib/application-home';
import { documentStatus, localDate } from '@/lib/config';
import { financeTimeline } from '@/lib/finance-overview';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';

type Data = Awaited<ReturnType<typeof dashboard>>;
export function AiVehicleInsights({ question, vehicle, records, timezone, onNavigate }: {
  question:string; vehicle:Data['vehicles'][number]|undefined; records:Data['records']; timezone:string; onNavigate:(tab:string)=>void;
}) {
  const locale=useApplicationLocale(), en=useApplicationLanguage()==='en';
  if(!vehicle)return null;
  const query=question.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const rows=records.filter(row=>row.vehicleId===vehicle.id&&!row.cancelled);
  const now=new Date(), today=localDate(now,timezone);
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
  const money=(value:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'RON'}).format(value/100);
  if(/\b(rca|itp|casco)\b|roviniet|document|expir|vignette/.test(query)){
    return <section className="ac-ai-insight"><h4>{en?'Saved vehicle documents':'Documente salvate'}</h4>
      <dl>{['ITP','RCA','Rovinietă','CASCO'].map(category=>{
        const row=homeDocument(rows,vehicle.id,category,today);
        const expiry=row?.expiresAt;
        const status=!row?(en?'Missing':'Lipsește'):row.date&&row.date>today?(en?'Starts later':'Începe în viitor'):
          !expiry?(en?'No expiry recorded':'Fără expirare'):(documentStatus(expiry,now,timezone).days??0)<0?(en?'Expired':'Expirat'):(en?'Valid':'Valabil');
        return <div key={category}><dt>{category==='Rovinietă'&&en?'Vignette':category}</dt><dd>{expiry?date(expiry)+' · ':''}{status}</dd></div>;
      })}</dl>
      <button type="button" onClick={()=>onNavigate('Documente')}>{en?'Open documents':'Vezi documentele'}</button>
      <button type="button" onClick={()=>onNavigate('Notificări')}>{en?'View reminders':'Vezi notificările'}</button>
    </section>;
  }
  if(/cheltu|costur|expenses|spending|financ|buget/.test(query)){
    const { buckets, count, totalBani }=financeTimeline(rows,today,3);
    const max=Math.max(1,...buckets.map(bucket=>bucket.bani));
    return <section className="ac-ai-insight"><h4>{en?'Recorded expenses · 3 months':'Cheltuieli înregistrate · 3 luni'}</h4>
      {count?<><strong>{money(totalBani)}</strong><dl>{buckets.map(bucket=><div key={bucket.key}><dt>{date(bucket.key+'-01').replace(/^1\s+/, '')}</dt><dd>{bucket.count?<><meter min={0} max={max} value={bucket.bani} aria-label={money(bucket.bani)}/>{money(bucket.bani)}</>:en?'No entries':'Fără date'}</dd></div>)}</dl></>:<p>{en?'No recorded expenses in this period.':'Nu există cheltuieli înregistrate în această perioadă.'}</p>}
      <button type="button" onClick={()=>onNavigate('Cheltuieli')}>{en?'Open expenses':'Vezi cheltuielile'}</button>
    </section>;
  }
  if(/revizi|intretin|maintenance|kilomet|mileage|service|istoric/.test(query)){
    const next=upcomingMaintenance(rows,vehicle.odometer,null,timezone)[0];
    return <section className="ac-ai-insight"><h4>{en?'Vehicle records':'Datele vehiculului'}</h4>
      <dl><div><dt>{en?'Recorded mileage':'Kilometraj înregistrat'}</dt><dd>{vehicle.odometer.toLocaleString(locale)} km</dd></div>
      {next&&<div><dt>{next.service.title}</dt><dd>{next.status.remainingKm!=null?Math.max(0,next.status.remainingKm).toLocaleString(locale)+' km':next.raw?date(next.raw):'—'}</dd></div>}</dl>
      <button type="button" onClick={()=>onNavigate('Întreținere')}>{en?'Open maintenance':'Vezi întreținerea'}</button>
      <button type="button" onClick={()=>onNavigate('Kilometraj')}>{en?'Open mileage':'Vezi kilometrajul'}</button>
    </section>;
  }
  return null;
}
