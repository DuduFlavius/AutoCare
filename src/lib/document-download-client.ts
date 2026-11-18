'use client';
import {Capacitor,registerPlugin} from '@capacitor/core';
interface NativeDocuments{saveDocument(input:{name:string;mime:string;data:string}):Promise<{saved:boolean}>;}
const native=registerPlugin<NativeDocuments>('AutoCareTracking');
export async function downloadDocument(url:string,name:string){
 const response=await fetch(url,{cache:'no-store'});
 if(!response.ok)throw Error(response.status===401?'Sesiunea a expirat. Reconectează-te.':'Documentul nu a putut fi descărcat. Reîncearcă.');
 const disposition=response.headers.get('content-disposition')||'';const encoded=disposition.match(/filename\*=UTF-8''([^;]+)/i);if(encoded){try{name=decodeURIComponent(encoded[1]);}catch{/* Keep the safe fallback name. */}}
 const blob=await response.blob();
 if(Capacitor.getPlatform()==='android'){
  const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  try{await native.saveDocument({name,mime:blob.type.split(';')[0],data:btoa(binary)});return;}
  catch(error){const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';if(code==='DOCUMENT_SAVE_CANCELLED')return;if(code==='UNIMPLEMENTED'||code==='UNAVAILABLE')throw Error('Actualizează aplicația AutoCare pentru salvarea documentelor pe telefon.',{cause:error});throw Error('Documentul nu a putut fi salvat pe telefon. Reîncearcă.',{cause:error});}
 }
 const object=URL.createObjectURL(blob),anchor=document.createElement('a');anchor.href=object;anchor.download=name;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(object),60000);
}
