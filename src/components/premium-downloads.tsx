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
    [to, setTo] = useState(''),
    [busy, setBusy] = useState(''),
    [error, setError] = useState('');
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
  async function downloadQuick(months:number,kind:'service'|'expense'|'',format:'pdf'|'csv'){
    if(preview){setError(en?'Sign in to download your reports.':'Autentifică-te pentru a descărca rapoartele.');return;}
    const key='quick-'+months;
    setBusy(key);setError('');
    try{
      const response=await fetch(quickReport(months,kind,format),{credentials:'same-origin',cache:'no-store'});
      if(!response.ok){
        const body=await response.json().catch(()=>null);
        throw new Error(body?.error|| (en?'Report download failed.':'Descărcarea raportului nu a reușit.'));
      }
      const blob=await response.blob();
      if(!blob.size)throw new Error(en?'The report is empty.':'Raportul generat este gol.');
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement('a');
      anchor.href=url;
      anchor.download='autocare-'+(months===12?'dosar-garaj-12-luni':months===3?'cheltuieli-3-luni':'revizii-lunare')+'.'+format;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(err){setError(err instanceof Error?err.message:String(err));}
    finally{setBusy('');}
  }
  async function download(format: 'pdf' | 'csv') {
    if (preview) {
      setError(
        en
          ? 'Downloads are available in your signed-in account.'
          : 'Descărcările sunt disponibile în contul autentificat.',
      );
      return;
    }
    setBusy(format);
    setError('');
    try {
      const query = new URLSearchParams({ format, archived: 'active' });
      if (vehicle) query.set('vehicleId', vehicle);
      if (kind) query.set('kind', kind);
      if (from) query.set('from', from);
      if (to) query.set('to', to);
      const response = await fetch('/api/v1/export?' + query, { cache: 'no-store' });
      if (!response.ok) {
        const payload = await response.json();
        throw Error(payload.error || 'Export failed');
      }
      const blob = await response.blob(),
        url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = 'autocare-raport.' + format;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy('');
    }
  }
  return (
    <section className="rg-premium-downloads" data-workspace-ui>
      <div className="ac-garage-report-library">
        <div><span className="ac-garage-report-kicker">{en?'GARAGE REPORT LIBRARY':'BIBLIOTECA RAPOARTELOR'}</span><h3>{en?'Your garage dossier':'Dosarul garajului tău'}</h3><p>{en?'Your vehicle records, organized by period and ready for export.':'Istoricul mașinilor, organizat pe perioade și pregătit pentru export.'}</p></div>
        <div className="ac-garage-report-links">
          <button type="button" disabled={!!busy} onClick={()=>void downloadQuick(1,'service','pdf')}><span>{en?'LAST MONTH':'ULTIMA LUNĂ'}</span><strong>{en?'Monthly service dossier':'Fișa reviziilor lunare'}</strong><small>PDF ↗</small></button>
          <button type="button" disabled={!!busy} onClick={()=>void downloadQuick(3,'expense','csv')}><span>{en?'LAST 3 MONTHS':'ULTIMELE 3 LUNI'}</span><strong>{en?'Expense overview':'Situația cheltuielilor'}</strong><small>CSV ↗</small></button>
          <button type="button" disabled={!!busy} onClick={()=>void downloadQuick(12,'','pdf')}><span>{en?'LAST 12 MONTHS':'ULTIMELE 12 LUNI'}</span><strong>{en?'Complete garage dossier':'Dosarul garajului pe 12 luni'}</strong><small>PDF ↗</small></button>
        </div>
      </div>
      {error&&<p role="alert" className="error">{error}</p>}
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
        <button type="button" disabled={!!busy || invalidRange} onClick={() => void download('pdf')}>
          <FileText size={18} />
          {busy === 'pdf'
            ? en
              ? 'Preparing…'
              : 'Se pregătește…'
            : en
              ? 'Download vehicle PDF'
              : 'Descarcă raport auto PDF'}
        </button>
        <button type="button" disabled={!!busy || invalidRange} onClick={() => void download('csv')}>
          <Table2 size={18} />
          {busy === 'csv'
            ? en
              ? 'Preparing…'
              : 'Se pregătește…'
            : en
              ? 'Export CSV data'
              : 'Exportă datele CSV'}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="micro">
        {en
          ? 'Account data is synchronized on the server. This export contains records, not a full attachment backup.'
          : 'Datele contului sunt sincronizate pe server. Exportul conține înregistrări, nu un backup complet al atașamentelor.'}
      </p>
      </div>
    </section>
  );
}
