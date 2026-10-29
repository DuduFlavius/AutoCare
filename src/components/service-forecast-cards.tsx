'use client';
import { useEffect, useState } from 'react';
import { CalendarClock, TrendingUp } from 'lucide-react';
import { mileageMetrics } from '@/lib/smartdrive-metrics';
import { forecastService } from '@/lib/service-forecast';
type Reading = { odometer: number; recordedAt: string };
type Due = { id: string; title: string; nextKm: number; expiresAt?: string | Date | null };
export default function ServiceForecastCards({vehicleId,currentKm,services,preview}:{vehicleId:string;currentKm:number;services:Due[];preview:boolean}) {
 const [dailyKm,setDailyKm]=useState<number|null>(null);
 const [loading,setLoading]=useState(!preview);
 useEffect(()=>{if(preview){setLoading(false);return;}let cancelled=false;setLoading(true);
 fetch('/api/v1/smartdrive/vehicles/'+encodeURIComponent(vehicleId)+'/readings',{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('Citirile nu sunt disponibile');return r.json() as Promise<Reading[]>}).then(rows=>{if(!cancelled)setDailyKm(mileageMetrics(rows).dailyKm)}).catch(()=>{if(!cancelled)setDailyKm(null)}).finally(()=>{if(!cancelled)setLoading(false)});
 return()=>{cancelled=true};
 },[vehicleId,currentKm,preview]);
 if(!services.length)return null;
 return <section className="ac-forecast-list" aria-label="Estimări revizii" style={{display:'grid',gap:10,margin:'16px 0'}}>
  <div style={{display:'flex',alignItems:'center',gap:8,color:'#163e77',fontWeight:750}}><CalendarClock size={19}/> Estimare timp până la revizie</div>
  {services.map(service=>{const date=service.expiresAt?new Date(service.expiresAt):null;const dueDate=date&&!Number.isNaN(date.getTime())?date.toISOString().slice(0,10):null;
  const estimate=forecastService({currentKm,nextKm:Number(service.nextKm),averageKmPerDay:dailyKm,dueDate});
  if(!estimate)return null;
  return <article key={service.id} style={{padding:'15px',border:'1px solid #dbe7f6',borderRadius:14,background:'linear-gradient(125deg,#f7fbff,#eef5ff)'}}>
   <strong style={{display:'block',color:'#163251',marginBottom:8}}>{service.title||'Revizie programată'}</strong>
   <div style={{display:'flex',flexWrap:'wrap',gap:10,alignItems:'center'}}>
    <span style={{fontSize:20,fontWeight:800,color:estimate.remainingKm===0?'#b42318':'#1354b5'}}>{estimate.remainingKm.toLocaleString('ro-RO')} km rămași</span>
    <span style={{padding:'6px 10px',borderRadius:999,background:'#fff',color:'#244365',fontSize:13,fontWeight:700}}>{loading?'Se calculează…':estimate.days===null?'Timp necunoscut':estimate.days===0?'Revizie scadentă':estimate.days+' zile estimate'}</span>
   </div>
   <p style={{margin:'9px 0 0',fontSize:12,lineHeight:1.55,color:'#536681'}}><TrendingUp size={13} style={{verticalAlign:'middle',marginRight:4}}/>{dailyKm!==null&&dailyKm>0?'Medie confirmată: '+dailyKm.toFixed(1)+' km/zi. ':'Sunt necesare două citiri de bord în zile diferite pentru estimarea după kilometri. '}{estimate.estimatedDate?'Dată probabilă: '+new Date(estimate.estimatedDate+'T12:00:00Z').toLocaleDateString('ro-RO',{timeZone:'UTC'}):'Kilometrajul rămâne vizibil chiar fără o dată estimată.'}</p>
  </article>})}
  <p style={{margin:0,fontSize:12,color:'#52627b'}}>Estimare orientativă, nu termen garantat. Respectă recomandarea producătorului și termenul calendaristic, dacă există. GPS-ul nu modifică kilometrajul confirmat.</p>
 </section>;
}
