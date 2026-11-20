'use client';
import {PremiumDateInput} from './premium-date-input';
import {FilterSelect} from './filter-select';
import './premium-reports-green.css';
import { useState } from 'react';
import { ReportOverview } from './application/report-overview';
import {upcomingMaintenance} from '@/lib/application-home';
import { localDate } from '@/lib/config';
import { Download, FileText, Table2 } from 'lucide-react';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
export default function PremiumDownloads({
  data,
  language,
  preview,
}: {
  data: Data;
  language: 'ro' | 'en';
  preview: boolean;
}) {
  const en = language === 'en',
    [vehicle, setVehicle] = useState(''),
    [reportView,setReportView]=useState('general'),
    [kind, setKind] = useState(''),
    [from, setFrom] = useState(''),
    [to, setTo] = useState('');
  if (!data.premium) return null;
  const invalidRange = !!from && !!to && from > to;
  const includedCars=data.vehicles.filter(car=>!car.archived&&(!vehicle||car.id===vehicle));
  const includedIds=new Set(includedCars.map(car=>car.id));
  const reportRows=data.records.filter(row=>includedIds.has(row.vehicleId)&&!row.cancelled&&(!kind||row.kind===kind)&&(!from||(row.date!=null&&row.date>=from))&&(!to||(row.date!=null&&row.date<=to)));
  const nextDistances=includedCars.flatMap(car=>upcomingMaintenance(data.records.filter(r=>r.vehicleId===car.id&&!r.cancelled),car.odometer,null,data.profile.timezone).flatMap(item=>item.status.remainingKm==null?[]:[Math.max(0,item.status.remainingKm)]));
  const nextKm=nextDistances.length?Math.min(...nextDistances):null;
  const previewQuery=new URLSearchParams({format:'pdf',view:'1',archived:'active',...(vehicle?{vehicleId:vehicle}:{}),...(kind?{kind}:{}),...(from?{from}:{}),...(to?{to}:{})});
  const reportDate=localDate(new Date(),data.profile.timezone);
  function quickReport(months:number,kind:'service'|'expense'|'',format:'pdf'|'csv'){
    const [year,month]=reportDate.split('-').map(Number);
    const start=new Date(Date.UTC(year,month-months,1)).toISOString().slice(0,10);
    return '/api/v1/export?'+new URLSearchParams({format,archived:'active',from:start,to:reportDate,...(kind?{kind}:{})});
  }
  function exportLink(format:'pdf'|'csv'){
    const query=new URLSearchParams({format,archived:'active'});
    if(vehicle)query.set('vehicleId',vehicle);
    if(kind)query.set('kind',kind);
    if(from)query.set('from',from);
    if(to)query.set('to',to);
    return '/api/v1/export?'+query.toString();
  }
  return (
    <section className="rg-premium-downloads" data-workspace-ui>
      <div className="ac-garage-report-library">
        <div><span className="ac-garage-report-kicker">{en?'GARAGE REPORT LIBRARY':'BIBLIOTECA RAPOARTELOR'}</span><h3>{en?'Your garage dossier':'Dosarul garajului tău'}</h3><p>{en?'Your vehicle records, organized by period and ready for export.':'Istoricul mașinilor, organizat pe perioade și pregătit pentru export.'}</p></div>
        <div className="ac-garage-report-links">
          <a href={quickReport(1,'service','pdf')} download><span>{en?'LAST MONTH':'ULTIMA LUNĂ'}</span><strong>{en?'Monthly service dossier':'Fișa reviziilor lunare'}</strong><small>PDF ↗</small></a>
          <a href={quickReport(3,'expense','csv')} download><span>{en?'LAST 3 MONTHS':'ULTIMELE 3 LUNI'}</span><strong>{en?'Expense overview':'Situația cheltuielilor'}</strong><small>CSV ↗</small></a>
          <a href={quickReport(12,'','pdf')} download><span>{en?'LAST 12 MONTHS':'ULTIMELE 12 LUNI'}</span><strong>{en?'Complete garage dossier':'Dosarul garajului pe 12 luni'}</strong><small>PDF ↗</small></a>
        </div>
      </div>
      
      <div className="rg-report-tabs" role="group" aria-label={en?'Report view':'Vizualizare raport'}><button aria-pressed={reportView==='general'} onClick={()=>setReportView('general')}>{en?'General':'General'}</button><button aria-pressed={reportView==='details'} onClick={()=>setReportView('details')}>{en?'Details & export':'Detalii și export'}</button></div>
      <ReportOverview nextKm={nextKm} rows={reportRows} vehicleCount={includedCars.length} today={localDate(new Date(),data.profile.timezone)} en={en}/>
      <div className="rg-report-details" hidden={reportView!=='details'}>
      <h3>
        <Download size={20} />
        {en ? 'Your reports & exports' : 'Rapoartele și exporturile tale'}
      </h3>
      <p className="micro">
        {en
          ? 'Use the PDF with your mechanic or a buyer. CSV contains the selected records for further analysis.'
          : 'Trimite raportul PDF mecanicului sau unui cumpărător. Exportul CSV conține înregistrările selectate pentru analiză.'}
      </p>
      <div className="ac-report-filters">
      <label>
        {en ? 'Vehicles included' : 'Mașini incluse'}
        <FilterSelect value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
          <option value="">{en ? 'All my vehicles' : 'Toate mașinile mele'}</option>
          {data.vehicles.map((car) => (
            <option key={car.id} value={car.id}>
              {car.brand} {car.model} · {car.plate}
            </option>
          ))}
        </FilterSelect>
      </label>
      <label>
        {en ? 'Record type' : 'Tip de înregistrare'}
        <FilterSelect value={kind} onChange={event => setKind(event.target.value)}>
          <option value="">{en ? 'All records' : 'Toate înregistrările'}</option>
          <option value="document">{en ? 'Documents' : 'Documente'}</option>
          <option value="service">{en ? 'Service sheet' : 'Fișă de service'}</option>
          <option value="expense">{en ? 'Expenses' : 'Cheltuieli'}</option>
        </FilterSelect>
      </label>
      <label>{en ? 'From' : 'De la'}<PremiumDateInput type="date" value={from} onChange={event => setFrom(event.target.value)}/></label>
      <label>{en ? 'To' : 'Până la'}<PremiumDateInput type="date" value={to} onChange={event => setTo(event.target.value)}/></label>
      </div>
      {invalidRange && <p role="alert">{en ? 'The end date must follow the start date.' : 'Data finală trebuie să fie egală cu sau după data de început.'}</p>}
      <div className="ac-premium-download-actions">
        {!preview&&!invalidRange&&<a className="button" href={'/api/v1/export?'+previewQuery} target="_blank" rel="noopener noreferrer">{en?'Preview / Print PDF':'Previzualizează / Imprimă PDF'}</a>}
        {!preview&&!invalidRange?<><a className="button" href={exportLink('pdf')} download="autocare-raport.pdf"><FileText size={18}/>{en?'Download vehicle PDF':'Descarcă raport auto PDF'}</a><a className="button" href={exportLink('csv')} download="autocare-istoric.csv"><Table2 size={18}/>{en?'Export CSV data':'Exportă datele CSV'}</a></>:<><button type="button" disabled>{en?'Download PDF':'Descarcă PDF'}</button><button type="button" disabled>{en?'Export CSV':'Exportă CSV'}</button></>}
      </div>
      <p className="micro">
        {en
          ? 'Account data is synchronized on the server. This export contains records, not a full attachment backup.'
          : 'Datele contului sunt sincronizate pe server. Exportul conține înregistrări, nu un backup complet al atașamentelor.'}
      </p>
      </div>
    </section>
  );
}
