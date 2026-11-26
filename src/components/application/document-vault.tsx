'use client';
import {translateApplicationCopy} from '@/lib/application-language';
import {ActionMenu} from '../action-menu';
import {FilterSelect} from '../filter-select';
import {DocumentActions, DocumentSheetAction} from '../document-actions';
import {PremiumAttachment} from '../premium-attachment';
import { useState, useRef } from 'react';
import { SignatureActions, SignatureDialog } from '../signature-form';
import { requestConfirmation } from '../premium-dialogs';
import { CarFront, CheckCheck, Clock3, Download, FileText, Files, Plus, Search, ShieldCheck, Upload, Pencil, Trash2, ClipboardCheck, Route, CreditCard } from 'lucide-react';
import type { dashboard } from '@/lib/service';
import { documentCounts, filterRecords } from '@/lib/record-filters';
import { useApplicationLanguage, useApplicationLocale } from '../application-locale';
type Data=Awaited<ReturnType<typeof dashboard>>;
type Row=Data['records'][number];
export function DocumentVault({data,vehicleId,onVehicle,onEdit,onCreate,onArchive,onDelete,onRestore,onHistory,onUpload,onDeleteFile,onRenewals,preview,busy}:{
 onDelete?:(row:Row)=>void;onRenewals?:()=>void;data:Data;vehicleId:string;onVehicle:(id:string)=>void;onEdit:(row:Row)=>void;onCreate:()=>void;onArchive:(row:Row)=>void;onRestore:(row:Row)=>void;onHistory:(row:Row)=>void;onUpload:(row:Row,file:File,uploadId:string)=>Promise<void>;onDeleteFile:(file:Data['attachments'][number])=>void;preview:boolean;busy:boolean;
}){
 const en=useApplicationLanguage()==='en',locale=useApplicationLocale(),t=(ro:string,english:string)=>en?english:ro;
 const [uploadRow,setUploadRow]=useState<Row|null>(null),[uploadFile,setUploadFile]=useState<File|null>(null),[uploadError,setUploadError]=useState(''),[uploading,setUploading]=useState(false);
 const uploadRequest=useRef<{ id: string; file: File } | null>(null);
 const uploadLock=useRef(false);
 async function closeUpload() {
   if(uploadLock.current)return;
   if(uploadFile && !await requestConfirmation(t('Renunți la atașamentul nesalvat?', 'Discard the unsaved attachment?'))) return;
   uploadRequest.current=null;
   setUploadRow(null);
 }
 const [query,setQuery]=useState(''),[category,setCategory]=useState(''),[state,setState]=useState(''),[archived,setArchived]=useState(false);
 const scoped=data.records.filter(row=>row.kind==='document'&&(!vehicleId||row.vehicleId===vehicleId));
 const stats=documentCounts(scoped,new Date(),data.profile.timezone);
 const categories=[...new Set(['ITP','RCA','CASCO','Rovinietă',...scoped.map(row=>row.category)])];
 const rows=filterRecords(scoped,{q:query,category,status:state,archived:archived?'all':'active'},new Date(),data.profile.timezone).sort((a,b)=>(a.status.days??Infinity)-(b.status.days??Infinity));
 const exportUrl=(format:string)=>'/api/v1/export?'+new URLSearchParams({format,kind:'document',...(vehicleId?{vehicleId}:{}),...(category?{category}:{}),...(state?{status:state}:{}),...(query?{q:query}:{}),archived:archived?'all':'active'});
 const day=(date:string|null)=>date?new Date(date+'T12:00:00Z').toLocaleDateString(locale,{day:'2-digit',month:'2-digit',year:'numeric',timeZone:'UTC'}):t('Necompletat','Not provided');
 return <div className="rg-document-screen" data-workspace-ui>
<div className="rg-vault-topline"><div className="rg-vault-category-tabs" role="group" aria-label={t('Categorie document','Document category')}><button type="button" aria-pressed={!category} onClick={()=>setCategory('')}>{t('Toate','All')}</button>{categories.map(value=><button type="button" key={value} aria-pressed={category===value} onClick={()=>setCategory(value)}>{translateApplicationCopy(value,en?'en':'ro')}</button>)}</div><button className="primary rg-desktop-upload" onClick={onCreate} disabled={!data.vehicles.some(v=>!v.archived)}><Plus size={18}/>{t("Încarcă document","Upload document")}</button></div>
<details className="rg-vault-tools"><summary><Search size={17}/>{t("Căutare și filtre","Search & filters")}</summary>  <div className="rg-vault-toolbar"><label className="rg-vault-car"><CarFront size={26}/><FilterSelect value={vehicleId} aria-label={t('Dosar vehicul','Vehicle folder')} onChange={e=>onVehicle(e.target.value)}><option value="">{t('Toate vehiculele','All vehicles')}</option>{data.vehicles.map(car=><option key={car.id} value={car.id}>{car.brand} {car.model} · {car.plate}</option>)}</FilterSelect></label><button className="rg-m-round" onClick={onCreate} disabled={!data.vehicles.some(car=>!car.archived)} aria-label={t('Adaugă document','Add document')}><Plus size={21}/></button></div>
  <details className="rg-vault-options"><summary>{t('Statistici și reînnoiri','Statistics & renewals')}</summary>  {onRenewals&&<button type="button" onClick={onRenewals}><ShieldCheck size={18}/>{t('RCA & Rovinietă','RCA & Road vignette')}</button>}
  <div className="rg-vault-overview">{[
   {Icon:Files,label:t('Total','Total'),value:stats.total,key:''},
   {Icon:CheckCheck,label:t('Valabile','Valid'),value:stats.valid,key:'valid'},
   {Icon:Clock3,label:t('Expiră curând','Expiring soon'),value:stats.soon,key:'soon'},
  ].map(({Icon,label,value,key})=><button key={label} aria-pressed={state===key} onClick={()=>setState(state===key?'':key)}><span><Icon size={22}/></span><small>{label}</small><strong>{value}</strong></button>)}</div>
  {(stats.expired>0||stats.incomplete>0)&&<div className="rg-vault-attention">{stats.expired>0&&<button onClick={()=>setState(state==='expired'?'':'expired')}>{stats.expired} {t('expirate','expired')}</button>}{stats.incomplete>0&&<span>{stats.incomplete} {t('fără termen completat','without expiry date')}</span>}</div>}
</details>
  <div className="rg-vault-filters"><label className="rg-m-search"><Search size={17}/><input type="search" maxLength={200} value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('Caută documente…','Search documents…')} aria-label={t('Caută documente','Search documents')}/></label><FilterSelect value={state} onChange={e=>setState(e.target.value)} aria-label={t('Starea documentului','Document status')}>{[['',t('Toate stările','All statuses')],['valid',t('Valabile','Valid')],['soon',t('Expiră curând','Expiring soon')],['expired',t('Expirate','Expired')],['incomplete',t('Fără termen','No expiry date')],['archived',t('Arhivate','Archived')]].map(([value,label])=><option key={value} value={value}>{label}</option>)}</FilterSelect><label className="rg-vault-archive-filter"><input type="checkbox" checked={archived} onChange={e=>setArchived(e.target.checked)}/>{t('Include arhivate','Include archived')}</label></div>
  {data.premium&&<div className="rg-vault-exports"><span>{t('Exportă dosarul','Export folder')}</span><a href={exportUrl('pdf')}><Download size={15}/> PDF</a><a href={exportUrl('csv')}><Download size={15}/> CSV</a></div>}
</details>
  <div className="rg-vault-table-wrap"><table className="rg-vault-table"><thead><tr>{[t('Document','Document'),t('Vehicul','Vehicle'),t('Data expirării','Expiry date'),t('Zile rămase','Days remaining'),t('Stare','Status'),t('Acțiuni','Actions')].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(row=>{const car=data.vehicles.find(v=>v.id===row.vehicleId),files=data.attachments.filter(f=>f.recordId===row.id),status=row.cancelled?t('Arhivat','Archived'):row.status.state==='valid'?t('Valabil','Valid'):row.status.state==='soon'?t('Atenție','Attention'):row.status.state==='expired'?t('Expirat','Expired'):t('Fără termen','No expiry');return <tr key={row.id} data-state={row.status.state}><td><span className="rg-doc-name"><FileText size={22}/><span><strong data-user-content>{translateApplicationCopy(row.category,en?'en':'ro')}</strong>{row.title!==row.category&&<small data-user-content>{row.title}</small>}</span></span></td><td data-user-content>{car?.plate||'—'}</td><td>{day(row.expiresAt)}</td><td>{row.status.days==null?'—':row.status.days>=0?row.status.days+' '+t('zile','days'):Math.abs(row.status.days)+' '+t('zile de la expirare','days overdue')}</td><td><span className="rg-vault-status">{status}</span></td><td><div className="rg-table-actions">{!preview&&<DocumentSheetAction id={row.id}/>}
          {files[0]&&<DocumentActions file={files[0]}/>}<button aria-label={t('Editează ','Edit ')+row.title} title={t('Editează','Edit')} onClick={()=>onEdit(row)}><Pencil size={17}/></button>{onDelete&&<button disabled={busy} aria-label={t('Șterge ','Delete ')+row.title} title={t('Șterge','Delete')} onClick={()=>onDelete(row)}><Trash2 size={17}/></button>}<ActionMenu label={t('Mai multe acțiuni','More actions')+' '+row.title}><button onClick={()=>onHistory(row)}>{t('Istoric modificări','Change history')}</button><button disabled={preview||busy} onClick={()=>{setUploadRow(row);setUploadFile(null);setUploadError('');}}>{t('Atașează document','Attach document')}</button><button disabled={preview||busy} onClick={()=>row.cancelled?onRestore(row):onArchive(row)}>{row.cancelled?t('Restaurează','Restore'):t('Arhivează','Archive')}</button>{files.map(file=><span key={file.id}><strong data-user-content>{file.name}</strong><DocumentActions file={file}/><button disabled={preview||busy} onClick={()=>onDeleteFile(file)}>{t('Șterge atașamentul','Delete attachment')}</button></span>)}</ActionMenu></div></td></tr>;})}</tbody></table></div>
  <div className="rg-vault-cards">{rows.map(row=>{
   const car=data.vehicles.find(vehicle=>vehicle.id===row.vehicleId),files=data.attachments.filter(file=>file.recordId===row.id);
   const Icon=row.category==='RCA'||row.category==='CASCO'?ShieldCheck:row.category==='ITP'?ClipboardCheck:row.category==='Rovinietă'?Route:row.category==='Permis'||row.category==='CIV'?CreditCard:FileText;
   const status=row.cancelled?t('Arhivat','Archived'):row.status.state==='valid'?t('Valabil','Valid'):row.status.state==='soon'?t('Expiră curând','Expiring soon'):row.status.state==='expired'?t('Expirat','Expired'):t('Termen necunoscut','Expiry unknown');
   return <article key={row.id} className="rg-vault-document" data-state={row.cancelled?'archived':row.status.state}>
    <header><span className="rg-vault-type"><Icon size={26}/></span><div><h2 data-user-content>{translateApplicationCopy(row.category,en?'en':'ro')}</h2><span className="rg-vault-status">{status}</span></div></header>
    <strong className="rg-vault-vehicle-name" data-user-content>{car?car.brand+' '+car.model+' · '+car.plate:'—'}</strong>
    {row.title!==row.category&&<p className="rg-vault-document-title" data-user-content>{row.title}</p>}{row.provider&&<p data-user-content>{row.provider}</p>}{row.notes&&<p data-user-content>{row.notes}</p>}
    <dl><div><dt>{t('Emis','Issued')}</dt><dd>{day(row.date)}</dd></div><div><dt>{t('Expiră','Expires')}</dt><dd>{day(row.expiresAt)}</dd></div></dl>
    <p className="rg-vault-days"><Clock3 size={15}/>{row.status.days==null?t('Adaugă data de expirare','Add an expiry date'):row.status.days<0?Math.abs(row.status.days)+' '+t('zile de la expirare','days since expiry'):row.status.days+' '+t('zile rămase','days remaining')}</p>
    <footer>{!preview&&<DocumentSheetAction id={row.id}/>} {files[0]&&<DocumentActions file={files[0]} compact/>}
     <ActionMenu label={t('Acțiuni pentru ','Actions for ')+row.category}><button onClick={()=>onEdit(row)}>{t('Editează','Edit')}</button><button disabled={preview||busy} onClick={()=>{setUploadRow(row);setUploadFile(null);setUploadError('');}}><Upload size={15}/>{t('Atașează document','Attach document')}</button><button onClick={()=>onHistory(row)}>{t('Istoric modificări','Change history')}</button><button disabled={preview||busy} onClick={()=>row.cancelled?onRestore(row):onArchive(row)}>{row.cancelled?t('Restaurează','Restore'):t('Arhivează','Archive')}</button>{files.map(file=><span className="ac-action-file" key={file.id}><strong data-user-content>{file.name}</strong><DocumentActions file={file}/><button disabled={preview||busy} onClick={()=>onDeleteFile(file)}>{t('Șterge atașamentul','Delete attachment')}</button></span>)}{onDelete&&<button className="ac-action-danger" disabled={busy} onClick={()=>onDelete(row)}>{t('Șterge definitiv','Delete permanently')}</button>}</ActionMenu>
    </footer>
   </article>;
  })}</div>
  <button className="rg-vault-upload" onClick={onCreate} disabled={!data.vehicles.some(v=>!v.archived)}><Plus size={18}/>{t("Încarcă document","Upload document")}</button>
  {!rows.length&&<section className="rg-m-empty"><Files size={42}/><h2>{t('Dosarul este pregătit','Your folder is ready')}</h2><p>{t('Adaugă un document sau schimbă filtrele.','Add a document or change your filters.')}</p><button className="rg-m-primary" onClick={onCreate}>{t('Adaugă document','Add document')}</button></section>}
 {uploadRow&&<SignatureDialog title={t('Atașează document','Attach document')} icon={Upload} compact busy={uploading} onClose={closeUpload}>
   <form className="sf-form" aria-busy={uploading} onSubmit={async event=>{
     event.preventDefault();
     if(!uploadFile || uploadLock.current || preview)return;
     uploadLock.current=true;
     if(uploadRequest.current?.file!==uploadFile)uploadRequest.current={id:crypto.randomUUID(),file:uploadFile};
     setUploading(true);
     setUploadError('');
     try {
       await onUpload(uploadRow,uploadFile,uploadRequest.current.id);
       uploadRequest.current=null;
       setUploadRow(null);
     } catch(cause) {
       setUploadError(cause instanceof Error ? cause.message : t('Încărcarea a eșuat. Reîncearcă.', 'Upload failed. Try again.'));
     } finally {
       uploadLock.current=false;
       setUploading(false);
     }
   }}>
     <div className="sf-body sf-stage">
       <p data-user-content>{uploadRow.category} · {data.vehicles.find(v=>v.id===uploadRow.vehicleId)?.plate}</p>
       <PremiumAttachment file={uploadFile} onChange={setUploadFile} disabled={uploading} uploading={uploading}/>
       {uploadError&&<p role="alert" className="sf-error">{uploadError}</p>}
     </div>
     <SignatureActions onCancel={closeUpload} disabled={!uploadFile||preview} busy={uploading}
       label={t('Salvează atașamentul','Save attachment')} status={t('Se încarcă…','Uploading…')}/>
   </form>
 </SignatureDialog>}
 </div>;
}
