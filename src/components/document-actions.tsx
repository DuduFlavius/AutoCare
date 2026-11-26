'use client';
import {useMemo,useState} from 'react';
import {Eye,Download,LoaderCircle} from 'lucide-react';
import {DocumentPreview} from './document-preview';
import {documentDownloadError,downloadDocument} from '@/lib/document-download-client';
import {useApplicationLanguage} from './application-locale';
export function DocumentActions({file,compact=false,previewOnly=false,downloadOnly=false}:{file:{id:string;mime:string;name:string};compact?:boolean;previewOnly?:boolean;downloadOnly?:boolean}){
 const en=useApplicationLanguage()==='en',t=(ro:string,english:string)=>en?english:ro;
 const [preview,setPreview]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const source=useMemo(()=>({url:'/api/v1/files/'+file.id+'?view=1',name:file.name,mime:file.mime}),[file.id,file.name,file.mime]);
 const save=async()=>{if(saving)return;setError('');setSaving(true);try{await downloadDocument('/api/v1/files/'+file.id,file.name);}catch(reason){setError(documentDownloadError(reason,en));}finally{setSaving(false);}};
 return <span className="ac-document-actions" data-workspace-ui>{!downloadOnly&&<button className="ac-vault-preview" type="button" onClick={e=>{e.stopPropagation();setPreview(true);}} aria-label={t('Previzualizare ','Preview ')+file.name}><Eye size={17}/>{!compact&&t('Previzualizare','Preview')}</button>}{!previewOnly&&<button className="ac-document-download" type="button" disabled={saving} onClick={e=>{e.stopPropagation();void save();}} aria-label={t('Descarcă ','Download ')+file.name} title={t('Descarcă documentul','Download document')}>{saving?<LoaderCircle size={17}/>:<Download size={17}/>}</button>}{error&&<small role="alert">{error}</small>}{preview&&<DocumentPreview source={source} onClose={()=>setPreview(false)}/>}</span>;
}
