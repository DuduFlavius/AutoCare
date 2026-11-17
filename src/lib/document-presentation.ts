export const documentAccept='application/pdf,image/jpeg,image/png';
export function attachmentError(file:{size:number;type:string;name:string},english=false){
 if(!file.size)return english?'The file is empty. Choose another document.':'Fișierul este gol. Alege alt document.';
 if(file.size>2097152)return english?'Choose a file up to 2 MB.':'Alege un fișier de maximum 2 MB.';
 if(!['application/pdf','image/jpeg','image/png'].includes(file.type)&&!((file.type===''||file.type==='application/octet-stream')&&/\.(pdf|jpe?g|png)$/i.test(file.name)))return english?'Choose a PDF, JPEG or PNG.':'Alege un PDF, JPEG sau PNG.';
 return '';
}
function safePart(value:string){return value.normalize('NFC').replace(/[\x00-\x1f\x7f<>:"/\\|?*]/g,' ').replace(/\s+/g,' ').trim().slice(0,70);}
const stamp=(value:string|null|undefined)=>value&&/^\d{4}-\d{2}-\d{2}$/.test(value)?value.slice(8,10)+'.'+value.slice(5,7)+'.'+value.slice(0,4):null;
export function documentDownloadName(record:{category:string;title?:string;date:string|null;expiresAt:string|null},vehicle:{plate:string},mime:string){
 const parts=[safePart(vehicle.plate),safePart(record.category||record.title||'Document')];
 const issued=stamp(record.date),expires=stamp(record.expiresAt);
 if(issued)parts.push('emis '+issued);
 if(expires)parts.push('expira '+expires);
 const extension=mime==='application/pdf'?'pdf':mime==='image/png'?'png':'jpg';
 return parts.filter(Boolean).join(' ') +'.'+extension;
}
export function documentDisposition(name:string,inline=false){
 const safe=safePart(name).replace(/[^\x20-\x7e]/g,'_');
 return `${inline?'inline':'attachment'}; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(name).replace(/['()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase())}`;
}
export function calendarCells(year:number,month:number){
 const start=new Date(Date.UTC(year,month,1,12));
 const offset=(start.getUTCDay()+6)%7;
 return Array.from({length:42},(_,index)=>{const day=new Date(Date.UTC(year,month,1-offset+index,12));return {iso:day.toISOString().slice(0,10),day:day.getUTCDate(),outside:day.getUTCMonth()!==month};});
}
