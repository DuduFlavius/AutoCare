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
 return <span className="ac-document-actions" data-workspace-ui>{!downloadOnly&&<button className="ac-vault-preview" type="button" onClick={e=>{e.stopPropagation();setPreview(true);}} aria-label={t('Previzualizare ','Preview ')+file.name}><Eye size={17}/>{!compact&&t('Vezi originalul','View original')}</button>}{!previewOnly&&<button className="ac-document-download" type="button" disabled={saving} onClick={e=>{e.stopPropagation();void save();}} aria-label={t('Descarcă ','Download ')+file.name} title={t('Descarcă originalul','Download original')}>{saving?<LoaderCircle size={17}/>:<Download size={17}/>}</button>}{error&&<small role="alert">{error}</small>}{preview&&<DocumentPreview source={source} onClose={()=>setPreview(false)}/>}</span>;
}

export function DocumentSheetAction({ id }: { id: string }) {
  const en = useApplicationLanguage() === 'en', t = (ro: string, english: string) => en ? english : ro;
  const [open, setOpen] = useState(false);
  const name = t('Fișă AutoCare', 'AutoCare sheet');
  return <>
    <button type="button" className="sc-sheet-action" onClick={() => setOpen(true)}><Eye size={16}/>{name}</button>
    {open && <DocumentPreview source={{ url: '/api/v1/records/' + id + '/sheet?view=1&language=' + (en ? 'en' : 'ro'), name, mime: 'application/pdf', nativeShare: true }} onClose={() => setOpen(false)} />}
  </>;
}
