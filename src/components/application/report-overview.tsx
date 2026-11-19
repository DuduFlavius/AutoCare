'use client';
import { useState } from 'react';
import { Gauge, ReceiptText, Wrench } from 'lucide-react';
import { financeTimeline, isFinancialEntry, type FinanceEntry } from '@/lib/finance-overview';
import { isPlannedService } from '@/lib/planned-service';
import { MobileFinanceOverview } from './mobile-finance-overview';
export function ReportOverview({rows,vehicleCount,today,en,nextKm}:{rows:FinanceEntry[];vehicleCount:number;today:string;en:boolean;nextKm?:number|null}){
 const [period,setPeriod]=useState('12');
 const locale=en?'en-GB':'ro-RO';
 const money=(bani:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'RON',maximumFractionDigits:2}).format(bani/100);
 const report=financeTimeline(rows,today,period==='all'?null:Number(period));
 const selectedRows=rows.filter(row=>row.date&&row.date>=report.from&&row.date<=today);
 const categoryTotals=new Map<string,number>();for(const row of new Map(selectedRows.map(r=>[r.id,r])).values())if(isFinancialEntry(row,today)&&row.amountKnown!==false)categoryTotals.set(row.category,(categoryTotals.get(row.category)||0)+row.amountBani);
 const services=[...new Map(selectedRows.map(row=>[row.id,row])).values()].filter(row=>row.kind==='service'&&!row.cancelled&&row.date&&row.date<=today&&!isPlannedService(row,today));
 return <section className="ac-report-overview" aria-label={en?'Report summary':'Sinteza raportului'}>
  <div className="ac-report-summary-grid">{[
   {Icon:ReceiptText,label:en?'Recorded costs':'Costuri înregistrate',value:report.count?money(report.totalBani):'—'},
   {Icon:Wrench,label:en?'Completed service records':'Intervenții înregistrate',value:String(services.length)},
   {Icon:Gauge,label:en?'Next maintenance':'Următoarea revizie',value:nextKm!=null?nextKm.toLocaleString(locale)+' km':'—'},
  ].map(({Icon,label,value})=><div key={label}><Icon size={23}/><span>{label}</span><strong>{value}</strong></div>)}</div>
  <p className="rg-report-vehicle-count"><span>{en?'Vehicles included':'Vehicule incluse'}</span><strong>{vehicleCount}</strong></p>
  <MobileFinanceOverview rows={rows} today={today} money={money} period={period} onPeriod={setPeriod} onFilters={()=>{}} filtersOpen={false}/>
  {categoryTotals.size>0&&<div className="rg-report-categories"><h3>{en?'Recorded categories':'Categorii înregistrate'}</h3>{[...categoryTotals].sort((a,b)=>b[1]-a[1]).map(([category,bani])=><div key={category}><span>{category}</span><strong>{money(bani)}</strong><progress aria-label={category} value={bani} max={Math.max(1,report.totalBani)}/></div>)}</div>}
 </section>;
}
