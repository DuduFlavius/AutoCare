'use client';

import {useEffect,useState,type FormEvent} from 'react';
import {CalendarClock,Download,Gauge,Route,TrendingUp} from 'lucide-react';
import {localDate} from '@/lib/config';
import {mileageSeries,type MileageReading} from '@/lib/mileage-history';
import {useApplicationLanguage,useApplicationLocale} from './application-locale';
import {DocumentPreview,type PreviewSource} from './document-preview';
import {FilterSelect} from './filter-select';
import InlineMileageEditor from './inline-mileage-editor';
import {EmptyState} from './application/empty-state';
import {requestConfirmation} from './premium-dialogs';
import './mileage-dashboard.css';

type Reading=MileageReading&{corrected?:boolean};
type Car={id:string;brand:string;model:string;plate:string;odometer:number;archived:boolean};
const pageSize=10;

export default function MileageDashboard({cars,primaryId,timezone,preview,onUpdated,onAddVehicle}:{cars:Car[];primaryId:string;timezone:string;preview:boolean;onUpdated:()=>Promise<void>;onAddVehicle:()=>void}){
  const en=useApplicationLanguage()==='en', locale=useApplicationLocale();
  const t=(ro:string,english:string)=>en?english:ro;
  const [vehicle,setVehicle]=useState(primaryId);
  const car=cars.find(x=>x.id===vehicle&&!x.archived)??cars.find(x=>!x.archived);
  const url=car?'/api/v1/smartdrive/vehicles/'+encodeURIComponent(car.id)+'/readings':'';
  const [data,setData]=useState<{url:string;rows:Reading[];error?:string}>();
  const [revision,setRevision]=useState(0);
  const [range,setRange]=useState('30');
  const [from,setFrom]=useState(''),[to,setTo]=useState('');
  const [source,setSource]=useState(''),[search,setSearch]=useState(''),[sort,setSort]=useState('newest');
  const [page,setPage]=useState(0),[active,setActive]=useState<string|null>(null);
  const [pdf,setPdf]=useState<PreviewSource|null>(null);
  const [edit,setEdit]=useState<Reading|null>(null);
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{
    if(!url||preview)return;
    const abort=new AbortController();
    fetch(url+'?history=full',{signal:abort.signal,cache:'no-store'}).then(async response=>{
      const value=await response.json();
      if(!response.ok)throw Error(value.error);
      setData({url,rows:value});
    }).catch(reason=>{if(!abort.signal.aborted)setData({url,rows:[],error:reason.message||'Istoricul nu a putut fi încărcat.'});});
    return ()=>abort.abort();
  },[url,preview,revision,car?.odometer]);
  const all=data?.url===url?data.rows:[];
  const today=localDate(new Date(),timezone);
  const startDate=new Date(today+'T00:00:00Z');
  if(range==='7'||range==='30')startDate.setUTCDate(startDate.getUTCDate()-Number(range)+1);
  else if(range!=='custom'){
    const day=startDate.getUTCDate();
    startDate.setUTCDate(1);
    startDate.setUTCMonth(startDate.getUTCMonth()-Number(range.slice(1)));
    const lastDay=new Date(Date.UTC(startDate.getUTCFullYear(),startDate.getUTCMonth()+1,0)).getUTCDate();
    startDate.setUTCDate(Math.min(day,lastDay));
  }
  const start=range==='custom'?from:startDate.toISOString().slice(0,10),end=range==='custom'?to:today;
  const invalid=Boolean(start&&end&&start>end);
  const series=mileageSeries(all,timezone,start,end);
  const latest=mileageSeries(all,timezone).last;
  const number=new Intl.NumberFormat(locale,{maximumFractionDigits:1});
  const km=(n:number|null|undefined)=>n==null?'—':number.format(n)+' km';
  const timestamp=new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:timezone});
  const dateLabel=(value:string)=>new Date(value+'T12:00:00Z').toLocaleDateString(locale,{day:'numeric',month:'short',timeZone:'UTC'});
  const sourceLabel=(value:string)=>value==='gps'?'GPS':t('Manual','Manual');
  const change=(value:number|null)=>value===null?'—':(value>0?'+':'')+km(value);
  const history=series.rows.filter(row=>(!source||row.source===source)&&(!search||row.date===search));
  if(sort==='newest')history.reverse();
  if(sort==='highest')history.sort((a,b)=>b.odometer-a.odometer);
  const pageCount=Math.max(1,Math.ceil(history.length/pageSize)), current=Math.min(page,pageCount-1);
  const visible=history.slice(current*pageSize,(current+1)*pageSize);
  const refresh=async()=>{setRevision(value=>value+1);await onUpdated();};
  async function saveCorrection(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!edit||busy)return;
    const form=new FormData(event.currentTarget),odometer=Number(form.get('odometer')),reason=String(form.get('reason')??'');
    setBusy(true);setError('');
    try{
      if(!await requestConfirmation(t('Confirmi corectarea citirii manuale?','Confirm this correction to the manual reading?')))return;
      const response=await fetch(url,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:edit.id,previous:edit.odometer,odometer,reason})});
      if(!response.ok)throw Error((await response.json()).error);
      setEdit(null);await refresh();
    }catch(cause){setError(cause instanceof Error?cause.message:t('Corectarea a eșuat.','Correction failed.'));}
    finally{setBusy(false);}
  }
  const min=series.rows.reduce((value,row)=>Math.min(value,row.odometer),Infinity);
  const max=series.rows.reduce((value,row)=>Math.max(value,row.odometer),-Infinity);
  const firstTime=series.first?+new Date(series.first.recordedAt):0,lastTime=series.last?+new Date(series.last.recordedAt):0;
  const points=series.rows.map(row=>({row,x:8+(firstTime===lastTime?.5:(+new Date(row.recordedAt)-firstTime)/(lastTime-firstTime))*84,y:10+(min===max?.5:(max-row.odometer)/(max-min))*80}));
  const selected=points.find(point=>point.row.id===active)??points.at(-1);
  const columns=[t('Data și ora','Date and time'),t('Kilometraj','Odometer'),t('Diferență','Change'),t('Sursă','Source'),t('Status','Status'),t('Acțiuni','Actions')];
  if(!car) return <EmptyState module="mileage" needsVehicle onAction={onAddVehicle}/>;
  if(preview || (data?.url===url && !data.error && !all.length)) return <EmptyState module="mileage">
    <InlineMileageEditor key={car.id} vehicleId={car.id} currentKm={car.odometer} preview={preview}
      onSaved={refresh} triggerLabel={t('Înregistrează kilometrajul','Record mileage')}/>
  </EmptyState>;
  return <section className="ac-mileage-board" data-workspace-ui>
    <header className="ac-mileage-header">
      <div><h2>{t('Kilometraj & Istoric','Mileage & History')}</h2><p>{t('Monitorizează evoluția kilometrajului vehiculului tău.','Track your vehicle’s mileage over time.')}</p></div>
      {car&&<div className="ac-mileage-header-actions">
        <FilterSelect aria-label={t('Vehicul','Vehicle')} value={car.id} onChange={event=>{setVehicle(event.target.value);setPage(0);setEdit(null);setActive(null);}}>
          {cars.filter(x=>!x.archived).map(x=><option key={x.id} value={x.id}>{x.brand} {x.model} · {x.plate}</option>)}
        </FilterSelect>
        <InlineMileageEditor key={car.id} vehicleId={car.id} currentKm={car.odometer} preview={preview} onSaved={refresh} triggerLabel={t('Actualizează kilometraj','Update mileage')}/>
        <button type="button" disabled={preview||invalid} onClick={()=>setPdf({url:url+'?'+new URLSearchParams({format:'pdf',...(start&&{from:start}),...(end&&{to:end})}),name:t('Raport kilometraj','Mileage report'),mime:'application/pdf',nativeShare:true,downloadName:'autocare-kilometraj.pdf'})}><Download size={17}/>{t('Exportă raport PDF','Export PDF report')}</button>
      </div>}
    </header>
    {!car?<p>{t('Adaugă un vehicul pentru a vedea istoricul.','Add a vehicle to see its history.')}</p>:<>
      <div className="ac-mileage-stats">
        <article><Gauge/><span>{t('Kilometraj actual','Current odometer')}</span><strong>{km(car.odometer)}</strong></article>
        <article><Route/><span>{t('Kilometri parcurși','Distance driven')}</span><strong>{km(series.distance)}</strong></article>
        <article><TrendingUp/><span>{t('Media zilnică','Daily average')}</span><strong>{series.average==null?'—':km(series.average)+t('/zi','/day')}</strong><small>{series.span>0&&series.first&&series.last?dateLabel(series.first.date)+' – '+dateLabel(series.last.date)+' · '+series.span+t(' zile',' days'):t('Necesită citiri din zile diferite','Requires readings on different days')}</small></article>
        <article><CalendarClock/><span>{t('Ultima actualizare','Last update')}</span><strong>{latest?timestamp.format(new Date(latest.recordedAt)):'—'}</strong><small>{latest?sourceLabel(latest.source):null}</small></article>
      </div>
      <section className="ac-mileage-panel">
        <h3>{t('Evoluția kilometrajului','Mileage trend')}</h3>
        <div className="ac-mileage-controls">{[['7',t('7 zile','7 days')],['30',t('30 zile','30 days')],['m3',t('3 luni','3 months')],['m6',t('6 luni','6 months')],['m12',t('1 an','1 year')],['custom',t('Personalizat','Custom')]].map(([id,label])=><button type="button" key={id} aria-pressed={range===id} onClick={()=>{setRange(id);setPage(0);setActive(null);}}>{label}</button>)}</div>
        {range==='custom'&&<div className="ac-mileage-controls"><label>{t('De la','From')} <input type="date" value={from} onChange={event=>{setFrom(event.target.value);setPage(0);}}/></label><label>{t('Până la','To')} <input type="date" value={to} onChange={event=>{setTo(event.target.value);setPage(0);}}/></label></div>}
        {invalid?<p role="alert">{t('Interval invalid.','Invalid range.')}</p>:data?.url===url&&data.error?<p role="alert">{data.error}</p>:!preview&&data?.url!==url?<p role="status">{t('Se încarcă citirile…','Loading readings…')}</p>:selected?<figure className="ac-mileage-chart">
          <figcaption aria-live="polite">{timestamp.format(new Date(selected.row.recordedAt))} · <strong>{km(selected.row.odometer)}</strong> · {sourceLabel(selected.row.source)}</figcaption>
          <div className="ac-mileage-chart-grid"><div className="ac-mileage-y">{[...new Set([max,(max+min)/2,min])].map(value=><span key={value}>{km(value)}</span>)}</div><div className="ac-mileage-plot">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M0 10H100 M0 50H100 M0 90H100" stroke="#dde8eb" vectorEffect="non-scaling-stroke"/><polyline points={points.map(({x,y})=>x+','+y).join(' ')} fill="none" stroke="#075565" strokeWidth="2.5" vectorEffect="non-scaling-stroke"/></svg>
            {points.map(({row,x,y})=><button type="button" key={row.id} aria-pressed={selected.row.id===row.id} style={{left:x+'%',top:y+'%'}} aria-label={timestamp.format(new Date(row.recordedAt))+' · '+km(row.odometer)} onFocus={()=>setActive(row.id)} onClick={()=>setActive(row.id)}/>)}
          </div></div>
          <div className="ac-mileage-x">{[...new Set([series.first?.date,series.last?.date])].map(date=>date&&<span key={date}>{dateLabel(date)}</span>)}</div>
        </figure>:<p>{t('Nu există citiri confirmate în acest interval.','There are no confirmed readings in this period.')}</p>}
      </section>
      <section className="ac-mileage-panel">
        <h3>{t('Istoricul citirilor','Reading history')}</h3>
        <div className="ac-mileage-controls">
          <label>{t('Caută după dată','Search by date')} <input type="date" value={search} onChange={event=>{setSearch(event.target.value);setPage(0);}}/></label>
          <FilterSelect aria-label={columns[3]} value={source} onChange={event=>{setSource(event.target.value);setPage(0);}}><option value="">{t('Toate sursele','All sources')}</option><option value="manual">{t('Manual','Manual')}</option><option value="gps">GPS</option></FilterSelect>
          <FilterSelect aria-label={t('Sortare','Sort order')} value={sort} onChange={event=>{setSort(event.target.value);setPage(0);}}><option value="newest">{t('Recente','Newest')}</option><option value="oldest">{t('Vechi','Oldest')}</option><option value="highest">{t('Kilometraj descrescător','Highest mileage')}</option></FilterSelect>
          <button type="button" onClick={()=>{setSource('');setSearch('');setSort('newest');setRange('30');setFrom('');setTo('');setPage(0);setActive(null);}}>{t('Resetează filtrele','Reset filters')}</button>
        </div>
        <table className="ac-mileage-table"><thead><tr>{columns.map(column=><th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>
          {visible.map(row=><tr key={row.id}>
            <td data-label={columns[0]}>{timestamp.format(new Date(row.recordedAt))}</td><td data-label={columns[1]}><strong>{km(row.odometer)}</strong></td><td data-label={columns[2]}>{change(row.delta)}</td><td data-label={columns[3]}><span className="ac-mileage-badge">{sourceLabel(row.source)}</span></td><td data-label={columns[4]}>{(row as Reading).corrected?t('Corectată','Corrected'):t('Confirmată','Confirmed')}</td><td>{row.source==='manual'&&!preview?<button type="button" aria-label={t('Corectează citirea ','Correct reading ')+km(row.odometer)} onClick={()=>{setEdit(row);setError('');}}>⋯</button>:'—'}</td>
          </tr>)}
        </tbody></table>
        {!visible.length&&<p>{t('Nicio citire pentru filtrele selectate.','No readings match the selected filters.')}</p>}
        {pageCount>1&&<nav className="ac-mileage-controls" aria-label={t('Pagini istoric','History pages')}><button disabled={current===0} onClick={()=>setPage(current-1)}>{t('Anterior','Previous')}</button><span>{current+1} / {pageCount}</span><button disabled={current+1===pageCount} onClick={()=>setPage(current+1)}>{t('Următor','Next')}</button></nav>}
        {edit&&<form key={edit.id} className="ac-mileage-correction" onSubmit={saveCorrection}>
          <h4>{t('Corectează citirea manuală','Correct manual reading')} · {timestamp.format(new Date(edit.recordedAt))}</h4>
          <label>{columns[1]} <input name="odometer" type="number" min={0} max={99999999} step={1} defaultValue={edit.odometer} required autoFocus/></label>
          <label>{t('Motivul corectării','Reason for correction')} <input name="reason" minLength={3} maxLength={500} required/></label>
          <button type="submit" disabled={busy}>{t('Salvează corectarea','Save correction')}</button><button type="button" disabled={busy} onClick={()=>setEdit(null)}>{t('Anulează','Cancel')}</button>
          {error&&<p role="alert">{error}</p>}
        </form>}
      </section>
    </>}
    {pdf&&<DocumentPreview source={pdf} onClose={()=>setPdf(null)}/>}
  </section>;
}
