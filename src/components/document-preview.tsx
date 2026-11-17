'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {X,Download,FileText,ChevronLeft,ChevronRight,LoaderCircle} from 'lucide-react';
import {useApplicationLanguage} from './application-locale';
import {downloadDocument} from '@/lib/document-download-client';
export type PreviewSource={url?:string;file?:File;name:string;mime:string;downloadName?:string};
export function DocumentPreview({source,onClose}:{source:PreviewSource;onClose:()=>void}){
 const en=useApplicationLanguage()==='en',t=(ro:string,english:string)=>en?english:ro;
 const root=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null),pdf=useRef<import('pdfjs-dist').PDFDocumentProxy|null>(null);
 const [image,setImage]=useState(''),[pages,setPages]=useState(0),[page,setPage]=useState(1),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(false);
 useEffect(()=>{const old=document.activeElement as HTMLElement,overflow=document.body.style.overflow;document.body.style.overflow='hidden';root.current?.querySelector<HTMLButtonElement>('button')?.focus();return()=>{document.body.style.overflow=overflow;old?.focus();};},[]);
 useEffect(()=>{
  let disposed=false,object='',task:import('pdfjs-dist').PDFDocumentLoadingTask|undefined;
  setLoading(true);setError('');
  void(async()=>{try{
   const blob=source.file??await fetch(source.url!,{cache:'no-store'}).then(async response=>{if(!response.ok)throw Error(t('Documentul nu este disponibil. Verifică sesiunea și încearcă din nou.','The document is unavailable. Check your session and try again.'));return response.blob();});
   if(disposed)return;if(!blob)throw Error('Document unavailable');
   if(source.mime==='application/pdf'||blob.type==='application/pdf'){
    const engine=await import('pdfjs-dist');engine.GlobalWorkerOptions.workerSrc='/pdf.worker.min.mjs';
    if(disposed)return;task=engine.getDocument({data:new Uint8Array(await blob.arrayBuffer()),disableWorkerRendering:true,useSystemFonts:true,disableFontFace:true,useWasm:false,cMapUrl:"/pdfjs/cmaps/",cMapPacked:true,standardFontDataUrl:"/pdfjs/standard_fonts/"});
    const document=await task.promise;if(disposed){await task.destroy();return;}pdf.current=document;setPages(document.numPages);setPage(1);
   }else if(['image/jpeg','image/png'].includes(source.mime)||/^image\/(jpeg|png)$/.test(blob.type)){
    object=URL.createObjectURL(blob);setImage(object);setLoading(false);
   }else throw Error(t('Acest format nu poate fi previzualizat. Descarcă documentul.','This format cannot be previewed. Download the document.'));
  }catch(reason){if(!disposed){setError(t('Documentul nu poate fi previzualizat. Verifică fișierul sau descarcă-l pentru a-l deschide.','This document cannot be previewed. Check the file or download it to open it.'));setLoading(false);}}})();
  return()=>{disposed=true;if(object)URL.revokeObjectURL(object);if(task)void task.destroy();pdf.current=null;};
 },[source]);
 useEffect(()=>{
  if(!pages||!pdf.current)return;let disposed=false,render:import('pdfjs-dist').RenderTask|undefined;
  setLoading(true);
  void(async()=>{try{const pdfPage=await pdf.current!.getPage(page);if(disposed||!canvas.current)return;const target=canvas.current,base=pdfPage.getViewport({scale:1}),width=Math.min(1500,(root.current?.clientWidth??800)*Math.min(window.devicePixelRatio||1,2)),viewport=pdfPage.getViewport({scale:width/base.width});target.width=viewport.width;target.height=viewport.height;render=pdfPage.render({canvas:target,viewport});await render.promise;if(!disposed)setLoading(false);}catch(reason){if(!disposed){setLoading(false);setError(t('Pagina PDF nu a putut fi afișată. Descarcă documentul pentru a-l deschide.','This PDF page could not be displayed. Download the document to open it.'));}}})();
  return()=>{disposed=true;render?.cancel();};
 },[pages,page]);
 const save=async()=>{if(!source.url||saving)return;setSaving(true);try{await downloadDocument(source.url,source.downloadName||source.name);}catch(reason){setError(en?'The document could not be saved. Retry or update the Android app.':reason instanceof Error?reason.message:'Nu s-a putut salva documentul.');}finally{setSaving(false);}};
 return createPortal(<div className="ac-document-overlay"><section ref={root} role="dialog" aria-modal="true" aria-label={t('Previzualizare document','Document preview')} className="ac-document-preview" onKeyDown={e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();onClose();}if(e.key==='Tab'){const nodes=Array.from(root.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')),first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}>
  <header><FileText size={24}/><div><h2>{t('Previzualizare document','Document preview')}</h2><p data-user-content>{source.name}</p></div><button type="button" onClick={onClose} aria-label={t('Închide previzualizarea','Close preview')}><X size={22}/></button></header>
  <div className="ac-document-preview-toolbar">{source.url?<button type="button" disabled={saving} onClick={()=>void save()}><Download size={17}/>{saving?t('Se salvează…','Saving…'):t('Descarcă documentul','Download document')}</button>:<span>{t('Previzualizare locală · se încarcă după salvare','Local preview · uploaded when you save')}</span>}{pages>0&&<nav aria-label={t('Paginile documentului','Document pages')}><button type="button" disabled={page<=1} onClick={()=>setPage(p=>p-1)} aria-label={t('Pagina anterioară','Previous page')}><ChevronLeft size={19}/></button><span aria-live="polite">{page} / {pages}</span><button type="button" disabled={page>=pages} onClick={()=>setPage(p=>p+1)} aria-label={t('Pagina următoare','Next page')}><ChevronRight size={19}/></button></nav>}</div>
  {error&&<p className="ac-document-preview-error" role="alert">{error}</p>}
  <div className="ac-document-preview-surface" aria-busy={loading}>{loading&&<p role="status" className="ac-document-preview-loading"><LoaderCircle size={24}/>{t('Se pregătește documentul…','Preparing document…')}</p>}{pages>0&&<canvas ref={canvas} aria-label={t('Pagina documentului ','Document page ')+page}/>} {image&&<img src={image} alt={t('Documentul selectat','Selected document')} onError={()=>setError(t('Imaginea nu a putut fi afișată.','The image could not be displayed.'))}/>}</div>
 </section></div>,document.body);
}
