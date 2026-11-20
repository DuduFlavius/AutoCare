import { financeGroup, isFinancialEntry } from './finance-overview';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import assets from './report-assets.json';
import {reportBrandLogo} from './report-brand';
export type ReportVehicle={id:string;brand:string;model:string;plate:string;odometer:number};
export type ReportRecord={id?:string;vehicleId:string;kind:string;title:string;category:string;date:string|null;expiresAt:string|null;nextKm:number|null;odometer:number|null;amountBani:number;amountKnown:boolean;provider:string|null;notes:string|null;parts:string|null;cancelled?:boolean};
export async function vehicleReport({vehicles,records,generatedAt,language='ro',title,period,asOf=new Date().toISOString().slice(0,10)}:{vehicles:ReportVehicle[];records:ReportRecord[];generatedAt:string;language?:'ro'|'en';title?:string;period?:string;asOf?:string}){
 const en=language==='en',t=(ro:string,english:string)=>en?english:ro,locale=en?'en-GB':'ro-RO';
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(Buffer.from(assets.regular,'base64'),{subset:true}),bold=await doc.embedFont(Buffer.from(assets.bold,'base64'),{subset:true});
 const logo=await doc.embedPng(Buffer.from(reportBrandLogo,'base64'));
 const heading=title||t('Raport auto','Vehicle report');doc.setTitle('AutoCare Premium - '+heading);doc.setAuthor('AutoCare Premium');doc.setSubject(t('Datele înregistrate în cont','Recorded account data'));
 const navy=rgb(5/255,14/255,11/255),blue=rgb(28/255,128/255,98/255),muted=rgb(.26,.36,.31),line=rgb(.80,.88,.84),white=rgb(1,1,1);
 const W=595.28,H=841.89,L=40,R=555.28;let page!:PDFPage,y=0;
 // Strip unsafe control bytes from user-entered report copy.
 // eslint-disable-next-line no-control-regex
 const clean=(s:string)=>s.replace(/[\u0000-\u0008\u000B-\u001F]/g,' ').replace(/\t/g,'  ');
 function wrap(value:string,width:number,size=10,font:PDFFont=regular){const result:string[]=[];for(const paragraph of clean(value).split('\n')){let current='';for(const word of paragraph.split(/\s+/)){if(!word)continue;const candidate=current?current+' '+word:word;if(font.widthOfTextAtSize(candidate,size)<=width){current=candidate;continue;}if(current)result.push(current);current='';for(const char of word){if(current&&font.widthOfTextAtSize(current+char,size)>width){result.push(current);current='';}current+=char;}}result.push(current);}return result;}
 function fresh(){page=doc.addPage([W,H]);page.drawImage(logo,{x:L,y:H-75,width:38,height:38});page.drawText('AutoCare',{x:86,y:H-53,size:20,font:bold,color:navy});page.drawText('PREMIUM',{x:87,y:H-67,size:8,font:bold,color:blue});page.drawText(generatedAt,{x:R-regular.widthOfTextAtSize(generatedAt,8),y:H-48,size:8,font:regular,color:muted});page.drawLine({start:{x:L,y:H-91},end:{x:R,y:H-91},thickness:1.4,color:blue});let size=16;while(bold.widthOfTextAtSize(heading,size)>R-L&&size>10)size--;page.drawText(heading,{x:L,y:H-120,size,font:bold,color:navy});y=H-143;}
 function need(height:number){if(y-height<58)fresh();}
 function paragraph(value:string,strong=false,size=10){const font=strong?bold:regular;for(const valueLine of wrap(value,R-L,size,font)){need(16);page.drawText(valueLine,{x:L,y,size,font,color:strong?navy:muted});y-=15;}y-=4;}
 function section(value:string){need(62);y-=9;page.drawText(value,{x:L,y,size:12,font:bold,color:navy});y-=9;page.drawLine({start:{x:L,y},end:{x:R,y},thickness:.5,color:line});y-=21;}
 const money=(bani:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'RON'}).format(bani/100);
 const unique=[...new Map(records.map((row,i)=>[row.id||'row:'+i,row])).values()];
 const financial=unique.filter(row=>isFinancialEntry({...row,id:row.id||'report-row',cancelled:row.cancelled??false},asOf));
 const known=financial.filter(row=>row.amountKnown),total=known.reduce((sum,row)=>sum+row.amountBani,0);
 fresh();
 paragraph(period||t('Perioadă: toate înregistrările selectate','Period: all selected records'));
 section(t('01  Sinteză','01  Summary'));
 const metrics=[[t('Vehicule','Vehicles'),String(vehicles.length)],[t('Înregistrări','Records'),String(unique.length)],[t('Cheltuieli cunoscute','Known expenses'),known.length?money(total):t('Necompletat','Not recorded')],[t('Kilometraj confirmat cumulat','Combined confirmed odometers'),vehicles.reduce((sum,row)=>sum+row.odometer,0).toLocaleString(locale)+' km']];
 for(let i=0;i<metrics.length;i+=2){need(62);for(let j=0;j<2;j++){const metric=metrics[i+j];if(!metric)continue;const x=L+j*264;page.drawRectangle({x,y:y-42,width:249,height:58,color:rgb(.95,.98,.96),borderColor:line,borderWidth:.5});page.drawText(metric[0],{x:x+12,y:y-1,size:8,font:regular,color:muted});let size=15;while(bold.widthOfTextAtSize(metric[1],size)>222&&size>10)size--;page.drawText(metric[1],{x:x+12,y:y-24,size,font:bold,color:navy});}y-=72;}
 paragraph(t('Kilometrajul cumulat este suma valorilor de pe bord, nu distanța parcursă în perioada raportului. Costurile planificate și cele necunoscute nu sunt inventate.','Combined odometers are not the distance driven in the selected period. Planned and unknown costs are not fabricated.'),false,9);
 if(total>0){section(t('02  Distribuția costurilor','02  Cost distribution'));const groups=new Map<string,number>();for(const row of known){const group=financeGroup(row);groups.set(group,(groups.get(group)||0)+row.amountBani);}for(const [group,amount]of [...groups].sort((a,b)=>b[1]-a[1])){need(39);page.drawText(group,{x:L,y,size:10,font:bold,color:navy});const value=money(amount);page.drawText(value,{x:R-bold.widthOfTextAtSize(value,10),y,size:10,font:bold,color:navy});y-=14;page.drawRectangle({x:L,y,width:R-L,height:5,color:line});page.drawRectangle({x:L,y,width:(R-L)*amount/total,height:5,color:blue});y-=22;}}
 const widths=[64,78,205,70,98.28],labels=[t('Data','Date'),t('Categorie','Category'),t('Descriere','Description'),t('Kilometraj','Odometer'),t('Cost','Cost')];
 function tableHead(){need(55);let x=L;page.drawRectangle({x:L,y:y-11,width:R-L,height:25,color:navy});labels.forEach((label,i)=>{page.drawText(label,{x:x+6,y:y-2,size:8,font:bold,color:white});x+=widths[i];});y-=31;}
 for(const car of vehicles){section(car.brand+' '+car.model+' · '+car.plate);paragraph(t('Kilometraj confirmat: ','Confirmed odometer: ')+car.odometer.toLocaleString(locale)+' km');const rows=unique.filter(row=>row.vehicleId===car.id).sort((a,b)=>(a.date||'').localeCompare(b.date||''));if(!rows.length){paragraph(t('Nu există înregistrări în selecție.','No records in the selection.'));continue;}tableHead();
 for(const row of rows){const cells=[(row.date?row.date.split('-').reverse().join('.'):null)||'—',row.category,row.title+(row.provider?'\n'+row.provider:''),row.odometer==null?'—':row.odometer.toLocaleString(locale)+' km',row.amountKnown?money(row.amountBani):t('Necunoscut','Unknown')];const lines=cells.map((value,i)=>wrap(value,widths[i]-12,9,i===4?bold:regular));let cursor=0;const count=Math.max(...lines.map(row=>row.length));while(cursor<count){if(y<100){fresh();tableHead();}const take=Math.max(1,Math.min(count-cursor,Math.floor((y-65)/14)-1));const height=take*14+16;let x=L;for(let col=0;col<lines.length;col++){for(let k=0;k<take;k++){const text=lines[col][cursor+k];if(text)page.drawText(text,{x:x+6,y:y-4-k*14,size:9,font:col===4?bold:regular,color:navy});}x+=widths[col];}page.drawLine({start:{x:L,y:y-height+8},end:{x:R,y:y-height+8},thickness:.5,color:line});y-=height;cursor+=take;}
 if(row.nextKm!=null||row.expiresAt)paragraph([row.nextKm==null?'':t('Prag următor: ','Next threshold: ')+row.nextKm.toLocaleString(locale)+' km',row.expiresAt?t('Expiră: ','Expires: ')+row.expiresAt:''].filter(Boolean).join(' · '),false,9);
 if(row.parts)paragraph(t('Lucrări / piese: ','Work / parts: ')+row.parts.split('\n').filter(line=>!line.startsWith('AutoCare · ')).join('\n'),false,9);
 if(row.notes)paragraph(t('Observații: ','Notes: ')+row.notes,false,9);
 }
 }
 if(!vehicles.length)paragraph(t('Nicio înregistrare pentru filtrele selectate.','No records match these filters.'));
 const pages=doc.getPages();pages.forEach((sheet,i)=>{sheet.drawLine({start:{x:L,y:44},end:{x:R,y:44},thickness:.5,color:line});sheet.drawText('AutoCare Premium · '+t('Generat din datele contului','Generated from account data'),{x:L,y:29,size:8,font:regular,color:muted});const count=(i+1)+' / '+pages.length;sheet.drawText(count,{x:R-regular.widthOfTextAtSize(count,8),y:29,size:8,font:regular,color:muted});});
 return Buffer.from(await doc.save());
}
