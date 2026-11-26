'use client';
import { useMemo, useState } from 'react';
import { CarFront, ChartNoAxesCombined, Fuel, Gauge, ReceiptText, ShieldCheck, Wallet, Wrench } from 'lucide-react';
import { financeGroup, isFinancialEntry, type FinanceEntry } from '@/lib/finance-overview';
import { expenseSelection } from '@/lib/finance-selection';
import { reportPeriod, vehicleName, type ReportVehicle } from '@/lib/report-analysis';
import { isPlannedService } from '@/lib/planned-service';
import { translateApplicationCopy } from '@/lib/application-language';
import { ExpenseStepChart } from './expense-step-chart';

const colors=['#237b7d','#5076b4','#489173','#bd745c','#8469b4','#a28c4b'];
const groupIcons={Combustibil:Fuel,Service:Wrench,Frâne:Gauge,RCA:ShieldCheck,ITP:ShieldCheck,Anvelope:Gauge,Distribuție:Wrench,'Alte cheltuieli':ReceiptText};
type Props={rows:FinanceEntry[];vehicleCount:number;today:string;en:boolean;nextKm?:number|null;money:(bani:number)=>string;from?:string;to?:string;vehicles?:ReportVehicle[];distance?:Record<string,number>};
export function ReportOverview({rows,vehicleCount,today,en,nextKm,money,from,to,vehicles=[],distance}:Props){
  const locale=en?'en-GB':'ro-RO';
  const t=(ro:string,english:string)=>en?english:ro;
  const end=to&&to<today?to:today;
  const start=from??reportPeriod('12',today).from;
  const date=(value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'}).format(new Date(value+'T12:00:00Z'));
  const monthLabel=(value:string)=>new Intl.DateTimeFormat(locale,{month:'short',timeZone:'UTC'}).format(new Date(value+'-01T12:00:00Z'));
  const tx=(value:string)=>translateApplicationCopy(value,en?'en':'ro');
  const [expanded,setExpanded]=useState(false);
  const [monthFocus,setMonthFocus]=useState('');
  const overview=useMemo(()=>{
    const filtered=[...new Map(rows.map(row=>[row.id,row])).values()].filter(row=>!row.cancelled&&row.date&&row.date<=end&&(!start||row.date>=start));
    const ledger=filtered.filter(row=>isFinancialEntry(row,today)).sort((a,b)=>(b.date??'').localeCompare(a.date??''));
    const selected=expenseSelection(ledger,end,start||undefined);
    const months=new Map<string,number>(), costs=new Map<string,number>(), groups=new Map<string,number>(), counts=new Map<string,number>();
    for(const row of selected.known){
      const month=row.date!.slice(0,7);
      months.set(month,(months.get(month)??0)+row.amountBani);
      costs.set(row.vehicleId,(costs.get(row.vehicleId)??0)+row.amountBani);
      const group=row.kind==='document'?'Documente':financeGroup(row);
      groups.set(group,(groups.get(group)??0)+row.amountBani);
      counts.set(row.category,(counts.get(row.category)??0)+1);
    }
    const first=new Date(selected.start*86400000),last=new Date(selected.end*86400000);
    const monthsInPeriod=Math.max(1,(last.getUTCFullYear()-first.getUTCFullYear())*12+last.getUTCMonth()-first.getUTCMonth()+1);
    const columns=Array.from({length:Math.min(12,monthsInPeriod)},(_,index)=>{
      const offset=Math.max(0,monthsInPeriod-12)+index;
      const key=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+offset,1)).toISOString().slice(0,7);
      return {key,bani:months.get(key)??0};
    });
    const service=filtered.filter(row=>row.kind==='service'&&!isPlannedService(row,today)).length;
    return {filtered,ledger,selected,costs,groups,counts,months,monthsInPeriod,columns,service};
  },[rows,today,end,start]);
  const {selected,ledger,groups,counts,costs,months,monthsInPeriod,columns,service}=overview;
  const total=selected.total, recorded=selected.known.length>0;
  const names=new Map(vehicles.map(car=>[car.id,vehicleName(car)]));
  const kmComplete=costs.size>0&&[...costs.keys()].every(id=>(distance?.[id]??0)>0);
  const measured=kmComplete?[...costs.keys()].reduce((sum,id)=>sum+(distance?.[id]??0),0):0;
  const byVehicle=[...costs].sort((a,b)=>b[1]-a[1]);
  const percent=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:2});
  const positive=selected.categories.filter(row=>row.bani>0);
  const colorsForCategories=new Map(positive.map((row,index)=>[row.name,colors[index%colors.length]]));
  let offset=0;
  const gradient=positive.map((row,index)=>{const begin=offset;offset+=row.bani/total*100;return colors[index%colors.length]+' '+begin+'% '+offset+'%';}).join(',');
  const max=Math.max(1,...columns.map(col=>col.bani));
  const focus=columns.find(col=>col.key===monthFocus)??columns.at(-1);
  const shown=expanded?ledger:ledger.slice(0,12);
  const month=end.slice(0,7);
  const year=end.slice(0,4);
  const toValue=(bani:number|undefined)=>bani==null?'—':money(bani);
  return <section className="ac-report-overview ed-report-overview" aria-label={t('Sinteza raportului','Report summary')}>
    <div className="ed-report-section-title"><ChartNoAxesCombined size={20}/><div><h3>{t('Analiza garajului','Garage analysis')}</h3>
      <p>{start?date(start)+' – ':''}{date(end)}</p></div></div>
    {recorded ? <>
      <div className="ed-report-metrics">
        <article className="ed-report-total"><Wallet size={20}/><span>{t('Total în selecție','Selection total')}</span><strong>{money(total)}</strong><small>{ledger.length} {t('tranzacții în interval','transactions in period')}</small></article>
        {[
          [ReceiptText,t('Ultima lună din selecție','Final month in selection'),toValue(months.get(month))],
          [ChartNoAxesCombined,t('Anul selectat','Selected year'),toValue([...months].some(([key])=>key.startsWith(year))?[...months].filter(([key])=>key.startsWith(year)).reduce((sum,[,value])=>sum+value,0):undefined)],
          [ReceiptText,t('Media lunară în interval','Monthly period average'),money(total/monthsInPeriod)],
          [Gauge,t('Cost pe kilometru','Cost per kilometre'),measured>0?money(total/measured)+' / km':'—'],
          [Fuel,t('Combustibil','Fuel'),toValue(groups.get('Combustibil'))],
          [Wrench,t('Service','Service'),toValue(groups.get('Service'))],
          [ShieldCheck,t('Documente','Documents'),toValue(groups.get('Documente'))],
        ].map(([Icon,label,value])=>{const Metric=Icon as typeof Wallet;return <article key={String(label)}><Metric size={17}/><span>{String(label)}</span><strong>{String(value)}</strong></article>;})}
      </div>
      <div className="ed-report-bento">
        <article className="ed-report-card ed-report-step">
          <h4>{t('Evoluția cumulativă','Cumulative spending')}</h4>
          <ExpenseStepChart key={start+end} selection={selected} en={en} locale={locale} money={money}/>
        </article>
        <article className="ed-report-card ed-report-months">
          <h4>{t('Comparație lunară','Monthly comparison')}</h4>
          {monthsInPeriod>12&&<p>{t('Ultimele 12 luni din interval','Last 12 months in period')}</p>}
          <div className="ed-report-columns">
            {columns.map(col=><button key={col.key} aria-label={col.key+' · '+money(col.bani)} aria-pressed={focus?.key===col.key} onClick={()=>setMonthFocus(col.key)}>
              <i style={{height:(col.bani/max)*100+'%'}}/><span>{monthLabel(col.key)}</span>
            </button>)}
          </div>
          {focus&&<p className="ed-report-month-value">{focus.key} <strong>{money(focus.bani)}</strong></p>}
        </article>
        {selected.categories.length>0&&<article className="ed-report-card ed-report-categories">
          <h4>{t('Distribuție pe categorii','Expense distribution')}</h4>
          <div className="ed-report-ring" style={gradient?{background:`conic-gradient(${gradient})`}:undefined}><div>
            <span>{t('Total în selecție','Selection total')}</span><strong>{money(total).replaceAll('\u00a0',' ')}</strong>
          </div></div>
          <ul className="ed-report-breakdown">
            {selected.categories.map(row=>{const Icon=groupIcons[financeGroup({category:row.name,kind:row.kind})],share=total?row.bani/total:0;return <li key={row.name}>
              <span><Icon size={17}/>{tx(row.name)}</span><strong>{money(row.bani).replaceAll('\u00a0',' ')}</strong>
              <progress style={{accentColor:colorsForCategories.get(row.name)}} max={1} value={share} aria-label={tx(row.name)}/>
              <small>{counts.get(row.name)} · {share>0&&share<.0001?'<'+percent.format(.0001):percent.format(share)}</small>
            </li>;})}
          </ul>
        </article>}
        {byVehicle.length>0&&names.size>0&&<article className="ed-report-card ed-report-vehicles">
          <h4>{t('Costuri pe vehicule','Costs by vehicle')}</h4>
          <ul className="ed-report-breakdown">{byVehicle.map(([id,bani])=><li key={id}>
            <span><CarFront size={17}/>{names.get(id)??'—'}</span><strong>{money(bani).replaceAll('\u00a0',' ')}</strong>
            <progress max={1} value={total?bani/total:0} aria-label={names.get(id)??'—'}/><small>{percent.format(total?bani/total:0)}</small>
          </li>)}</ul>
        </article>}
      </div>
    </>:<div className="ed-report-empty ed-report-card"><Wallet size={21}/><h4>{t('Încă nu sunt costuri în selecție','No costs in this selection yet')}</h4>
      <p>{t('Înregistrează o cheltuială sau alege un alt interval pentru a vedea analiza.','Record an expense or select another period to see the analysis.')}</p></div>}
    {vehicleCount>0&&<div className="ed-report-operational">
      <article><Wrench size={17}/><span>{t('Intervenții înregistrate','Completed service records')}</span><strong>{service}</strong></article>
      <article><CarFront size={17}/><span>{t('Vehicule incluse','Vehicles included')}</span><strong>{vehicleCount}</strong></article>
      {nextKm!=null&&<article><Gauge size={17}/><span>{t('Până la următoarea revizie','Until next service')}</span><strong>{nextKm.toLocaleString(locale)} km</strong></article>}
    </div>}
    {!!shown.length&&<article className="ed-report-card">
      <h4>{t('Registrul cheltuielilor','Expense ledger')}</h4>
      <table className="ed-report-ledger">
        <thead><tr>{[t('Data','Date'),t('Descriere','Description'),t('Vehicul','Vehicle'),t('Sumă','Amount')].map(title=><th key={title} scope="col">{title}</th>)}</tr></thead>
        <tbody>{shown.map(row=>{const Icon=groupIcons[financeGroup(row)];return <tr key={row.id}>
          <td>{date(row.date!)}</td><td><span><Icon size={16}/>{row.title}</span><small>{tx(row.category)}</small></td>
          <td>{names.get(row.vehicleId)??'—'}</td><td>{row.amountKnown===false?'—':money(row.amountBani)}</td>
        </tr>;})}</tbody>
      </table>
      {ledger.length>12&&<button type="button" className="ed-report-secondary" onClick={()=>setExpanded(open=>!open)}>{expanded?t('Arată mai puține','Show fewer'):t('Arată toate tranzacțiile','Show all transactions')}</button>}
    </article>}
  </section>;
}
