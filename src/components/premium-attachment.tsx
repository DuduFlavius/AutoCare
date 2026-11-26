'use client';
import {useRef,useState} from 'react';
import {Paperclip,UploadCloud,FileText,Eye,X,Camera} from 'lucide-react';
import {useApplicationLanguage} from './application-locale';
import {attachmentError,documentAccept} from '@/lib/document-presentation';
import {DocumentPreview,type PreviewSource} from './document-preview';
export function PremiumAttachment({file=null,onChange,disabled=false,compact=false,uploading=false}:{file?:File|null;onChange:(file:File|null)=>void;disabled?:boolean;compact?:boolean;uploading?:boolean}){
 const en=useApplicationLanguage()==='en',t=(ro:string,english:string)=>en?english:ro,input=useRef<HTMLInputElement>(null), camera=useRef<HTMLInputElement>(null);
 const [error,setError]=useState(''),[dragging,setDragging]=useState(false),[preview,setPreview]=useState<PreviewSource|null>(null);
 const choose=(next:File)=>{const message=attachmentError(next,en);if(message){setError(message);return;}setError('');onChange(next);};
 return <section className={'ac-attachment'+(compact?' is-compact':'')+(dragging?' is-dragging':'')} data-workspace-ui aria-label={t('Atașare document','Document attachment')} onDragOver={e=>{e.preventDefault();if(!disabled)setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={e=>{e.preventDefault();setDragging(false);if(!disabled&&e.dataTransfer.files[0])choose(e.dataTransfer.files[0]);}}>
  <input ref={input} className="sr-only" type="file" accept={documentAccept} disabled={disabled} tabIndex={-1} aria-label={t('Alege PDF sau fotografie','Choose PDF or photo')} onChange={e=>{const next=e.target.files?.[0];e.target.value='';if(next)choose(next);}}/>
  <input ref={camera} className="sr-only" type="file" accept="image/*" capture="environment" disabled={disabled} tabIndex={-1} aria-label={t('Cameră','Camera')} onChange={e=>{const next=e.target.files?.[0];e.target.value='';if(next)choose(next);}}/>
  {uploading&&<progress aria-label={t('Încărcare atașament','Uploading attachment')}/>}
  <div className="ac-attachment-intro"><span className="ac-attachment-icon">{file?<FileText size={26}/>:<UploadCloud size={27}/>}</span><div><strong data-user-content>{file?file.name:t('Atașează documentul','Attach your document')}</strong><p>{file?(file.size/1024).toLocaleString(en?'en-GB':'ro-RO',{maximumFractionDigits:0})+' KB':t('PDF, JPG sau PNG · maximum 2 MB','PDF, JPG or PNG · up to 2 MB')}</p></div></div>
  <div className="ac-attachment-actions"><button type="button" disabled={disabled} onClick={()=>input.current?.click()}><Paperclip size={17}/>{file?t('Înlocuiește','Replace'):t('Alege fișierul','Choose file')}</button><button className="sf-camera" type="button" disabled={disabled} onClick={()=>camera.current?.click()}><Camera size={17}/>{t('Fotografiază','Take photo')}</button>{file&&<><button type="button" onClick={()=>setPreview({file,name:file.name,mime:['application/pdf','image/jpeg','image/png'].includes(file.type)?file.type:(/\.pdf$/i.test(file.name)?'application/pdf':/\.png$/i.test(file.name)?'image/png':'image/jpeg')})}><Eye size={17}/>{t('Previzualizare','Preview')}</button><button type="button" disabled={disabled} onClick={()=>{onChange(null);setError('');}} aria-label={t('Elimină atașamentul selectat','Remove selected attachment')}><X size={17}/></button></>}</div>
  {!file&&!compact&&<small>{t('Poți trage fișierul aici. Documentul rămâne privat în contul tău.','You can drop a file here. Your document stays private in your account.')}</small>}{error&&<p role="alert" className="ac-attachment-error">{error}</p>}{preview&&<DocumentPreview source={preview} onClose={()=>setPreview(null)}/>}
 </section>;
}
