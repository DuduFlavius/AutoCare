import {randomUUID} from 'node:crypto';
import { financeGroup, isFinancialEntry } from './finance-overview';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import assets from './report-assets.json';
import {reportBrandLogo} from './report-brand';
export type ReportVehicle={id:string;brand:string;model:string;plate:string;odometer:number};
export type ReportRecord={id?:string;vehicleId:string;kind:string;title:string;category:string;date:string|null;expiresAt:string|null;nextKm:number|null;odometer:number|null;amountBani:number;amountKnown:boolean;provider:string|null;notes:string|null;parts:string|null;cancelled?:boolean};
export async function vehicleReport({vehicles,records,generatedAt,language='ro',title,period,finance=false,asOf=new Date().toISOString().slice(0,10)}:{vehicles:ReportVehicle[];records:ReportRecord[];generatedAt:string;language?:'ro'|'en';title?:string;period?:string;finance?:boolean;asOf?:string}){
 const en=language==='en',t=(ro:string,english:string)=>en?english:ro,locale=en?'en-GB':'ro-RO';
 const doc=await PDFDocument.create();doc.registerFontkit(fontkit);
 const regular=await doc.embedFont(Buffer.from(assets.regular,'base64'),{subset:true}),bold=await doc.embedFont(Buffer.from(assets.bold,'base64'),{subset:true});
 const logo=await doc.embedPng(Buffer.from(reportBrandLogo,'base64'));
 const reportId=finance?randomUUID():null;
 const heading=title||t('Raport auto','Vehicle report');doc.setTitle('AutoCare Premium - '+heading);doc.setAuthor('AutoCare Premium');doc.setSubject(t('Datele înregistrate în cont','Recorded account data'));
 const navy=rgb(8/255,59/255,74/255),emerald=rgb(7/255,83/255,101/255),bright=rgb(32/255,166/255,166/255),muted=rgb(101/255,117/255,132/255),line=rgb(227/255,235/255,240/255),white=rgb(1,1,1);
 const W=595.28,H=841.89,L=40,R=555.28;let page!:PDFPage,y=0;
 // Strip unsafe control bytes from user-entered report copy.
 // eslint-disable-next-line no-control-regex
 const clean=(s:string)=>s.replace(/[\u0000-\u0008\u000B-\u001F]/g,' ').replace(/\t/g,'  ');
 function wrap(value:string,width:number,size=10,font:PDFFont=regular){const result:string[]=[];for(const paragraph of clean(value).split('\n')){let current='';for(const word of paragraph.split(/\s+/)){if(!word)continue;const candidate=current?current+' '+word:word;if(font.widthOfTextAtSize(candidate,size)<=width){current=candidate;continue;}if(current)result.push(current);current='';for(const char of word){if(current&&font.widthOfTextAtSize(current+char,size)>width){result.push(current);current='';}current+=char;}}result.push(current);}return result;}
 function fresh(){
  page=doc.addPage([W,H]);
  page.drawRectangle({x:L,y:H-98,width:R-L,height:66,color:navy});
  page.drawRectangle({x:L,y:H-98,width:3,height:66,color:bright});
  page.drawImage(logo,{x:L+16,y:H-84,width:40,height:40});
  page.drawText('AutoCare',{x:L+66,y:H-59,size:21,font:bold,color:white});
  page.drawText('P R E M I U M',{x:L+67,y:H-76,size:8,font:bold,color:bright});
  const dateLabel=t('GENERAT LA','GENERATED ON');
  page.drawText(dateLabel,{x:R-16-regular.widthOfTextAtSize(dateLabel,6.5),y:H-55,size:6.5,font:regular,color:rgb(.66,.75,.71)});
  page.drawText(generatedAt,{x:R-16-regular.widthOfTextAtSize(generatedAt,9),y:H-73,size:9,font:regular,color:white});
  let size=19;while(bold.widthOfTextAtSize(heading,size)>R-L&&size>10)size--;
  const titleLines=wrap(heading,R-L,size,bold);
  y=H-128;for(const text of titleLines){page.drawText(text,{x:L,y,size,font:bold,color:navy});y-=size+5;}y-=2;
  if(reportId){
   page.drawText(t('Raport financiar auto','Vehicle financial report'),{x:L,y,size:10,font:bold,color:navy});y-=15;
   page.drawText(t('Nr. raport: ','Report ID: ')+reportId,{x:L,y,size:8,font:regular,color:muted});y-=16;
  }
 }
 function need(height:number){if(y-height<58)fresh();}
 function paragraph(value:string,strong=false,size=10){const font=strong?bold:regular;for(const valueLine of wrap(value,R-L,size,font)){need(16);page.drawText(valueLine,{x:L,y,size,font,color:strong?navy:muted});y-=15;}y-=4;}
 function section(value:string){need(62);y-=9;page.drawText(value,{x:L,y,size:12,font:bold,color:emerald});y-=9;page.drawLine({start:{x:L,y},end:{x:R,y},thickness:.5,color:line});y-=21;}
 const money=(bani:number)=>new Intl.NumberFormat(locale,{style:'currency',currency:'RON'}).format(bani/100);
 const unique=[...new Map(records.map((row,i)=>[row.id||'row:'+i,row])).values()];
 const financial=unique.filter(row=>isFinancialEntry({...row,id:row.id||'report-row',cancelled:row.cancelled??false},asOf));
 const known=financial.filter(row=>row.amountKnown),total=known.reduce((sum,row)=>sum+row.amountBani,0);
 fresh();
 paragraph(period||t('Perioadă: toate înregistrările selectate','Period: all selected records'));
 section(t('01  Sinteză','01  Summary'));
 if(finance){
  page.drawRectangle({x:L,y:y-54,width:R-L,height:67,color:navy});
  page.drawText(t('TOTAL CHELTUIELI ÎNREGISTRATE','TOTAL RECORDED EXPENSES'),{x:L+16,y:y-7,size:9,font:bold,color:white});
  page.drawText(known.length?money(total):'—',{x:L+16,y:y-36,size:24,font:bold,color:white});
  y-=76;
 }
 const monthly=new Map<string,number>();
 if(finance)for(const row of known){if(row.date){const month=row.date.slice(0,7);monthly.set(month,(monthly.get(month)??0)+row.amountBani);}}
 const peak=known.reduce<number|null>((value,row)=>value==null?row.amountBani:Math.max(value,row.amountBani),null);
 const metrics=finance?[[t('Vehicule','Vehicles'),String(vehicles.length)],[t('Tranzacții','Transactions'),String(financial.length)],[t('Media lunilor cu costuri','Average across recorded months'),monthly.size?money(Math.round(total/monthly.size)):'—'],[t('Cea mai mare cheltuială','Largest expense'),peak==null?'—':money(peak)]]:[[t('Vehicule','Vehicles'),String(vehicles.length)],[t('Înregistrări','Records'),String(unique.length)],[t('Cheltuieli cunoscute','Known expenses'),known.length?money(total):t('Necompletat','Not recorded')],[t('Kilometraj confirmat cumulat','Combined confirmed odometers'),vehicles.reduce((sum,row)=>sum+row.odometer,0).toLocaleString(locale)+' km']];
 if(finance){
  metrics.forEach(([label,value],index)=>{
   const x=L+130*index;
   page.drawRectangle({x,y:y-35,width:122,height:48,color:rgb(.93,.96,.97)});
   page.drawText(label,{x:x+8,y:y-3,size:7,font:regular,color:muted});
   let size=14;while(bold.widthOfTextAtSize(value,size)>106&&size>8)size--;
   page.drawText(value,{x:x+8,y:y-24,size,font:bold,color:navy});
  });
  y-=52;
 }else for(let i=0;i<metrics.length;i+=2){need(78);for(let j=0;j<2;j++){
  const metric=metrics[i+j];if(!metric)continue;const x=L+j*264;
  page.drawRectangle({x,y:y-47,width:249,height:63,color:rgb(237/255,244/255,247/255),borderColor:line,borderWidth:.6});
  page.drawRectangle({x,y:y-47,width:2.5,height:63,color:emerald});
  page.drawText(metric[0],{x:x+14,y:y-3,size:8,font:regular,color:muted});
  let size=17;while(bold.widthOfTextAtSize(metric[1],size)>220&&size>10)size--;
  page.drawText(metric[1],{x:x+14,y:y-29,size,font:bold,color:i+j===2?emerald:navy});
 }y-=78;}
 if(finance&&monthly.size){
  const bars=[...monthly.entries()].sort(([a],[b])=>a.localeCompare(b)).slice(-6);
  need(128);
  section(t('Evoluția costurilor · luni cu înregistrări','Expense trend · months with entries'));
  const bound=Math.max(1,...bars.map(([,value])=>value)),width=(R-L)/bars.length,base=y-52;
  for(const [index,[month,amount]] of bars.entries()){
   const h=amount/bound*46,x=L+index*width+8;
   page.drawRectangle({x,y:base,width:Math.min(width-16,90),height:h,color:emerald});
   page.drawText(month,{x,y:base-14,size:8,font:regular,color:muted});
   page.drawText(money(amount),{x,y:base+h+5,size:7,font:bold,color:navy});
  }
  y=base-27;
 }
 paragraph(finance?t('Sumele includ costurile cunoscute, înregistrate în RON.','Amounts include known expenses recorded in RON.'):t('Kilometrajul reprezintă suma valorilor de bord confirmate, nu distanța parcursă în perioadă. Totalul include numai cheltuielile cunoscute și realizate.','Mileage is the sum of confirmed odometer readings, not distance travelled during the period. The total includes only known, completed expenses.'),false,9);
 if(total>0){section(t('02  Distribuția costurilor','02  Cost distribution'));const groups=new Map<string,number>();for(const row of known){const group=financeGroup(row);groups.set(group,(groups.get(group)||0)+row.amountBani);}for(const [group,amount]of [...groups].sort((a,b)=>b[1]-a[1])){need(39);page.drawText(group,{x:L,y,size:10,font:bold,color:navy});const value=money(amount);page.drawText(value,{x:R-bold.widthOfTextAtSize(value,10),y,size:10,font:bold,color:navy});y-=14;page.drawRectangle({x:L,y,width:R-L,height:5,color:line});page.drawRectangle({x:L,y,width:(R-L)*amount/total,height:5,color:emerald});y-=22;}}
 const widths=finance?[28,64,100,225,98.28]:[64,78,205,70,98.28],labels=finance?[t('Nr.','No.'),t('Data','Date'),t('Categorie','Category'),t('Descriere','Description'),t('Suma','Amount')]:[t('Data','Date'),t('Categorie','Category'),t('Descriere','Description'),t('Kilometraj','Odometer'),t('Cost','Cost')];
 function tableHead(){need(55);let x=L;page.drawRectangle({x:L,y:y-11,width:R-L,height:25,color:navy});labels.forEach((label,i)=>{page.drawText(label,{x:x+6,y:y-2,size:8,font:bold,color:white});x+=widths[i];});y-=31;}
 let transactionNumber=0;
 for(const car of vehicles){section(car.brand+' '+car.model+' · '+car.plate);paragraph(t('Kilometraj confirmat: ','Confirmed odometer: ')+car.odometer.toLocaleString(locale)+' km');const rows=(finance?financial:unique).filter(row=>row.vehicleId===car.id).sort((a,b)=>(a.date||'').localeCompare(b.date||''));if(!rows.length){paragraph(t('Nu există înregistrări în selecție.','No records in the selection.'));continue;}tableHead();
 for(const [rowIndex,row] of rows.entries()){const baseCells=[(row.date?row.date.split('-').reverse().join('.'):null)||'—',row.category,row.title+(row.provider?'\n'+row.provider:''),row.odometer==null?'—':row.odometer.toLocaleString(locale)+' km',row.amountKnown?money(row.amountBani):t('Necunoscut','Unknown')];const cells=finance?[String(++transactionNumber),baseCells[0],baseCells[1],baseCells[2],baseCells[4]]:baseCells;const lines=cells.map((value,i)=>wrap(value,widths[i]-12,9,i===4?bold:regular));let cursor=0;const count=Math.max(...lines.map(row=>row.length));while(cursor<count){if(y<100){fresh();tableHead();}const take=Math.max(1,Math.min(count-cursor,Math.floor((y-65)/14)-1));const height=take*14+16;if(rowIndex%2===1)page.drawRectangle({x:L,y:y-height+8,width:R-L,height:height,color:rgb(.975,.986,.98)});let x=L;for(let col=0;col<lines.length;col++){for(let k=0;k<take;k++){const text=lines[col][cursor+k];if(text)page.drawText(text,{x:x+6,y:y-4-k*14,size:9,font:col===4?bold:regular,color:navy});}x+=widths[col];}page.drawLine({start:{x:L,y:y-height+8},end:{x:R,y:y-height+8},thickness:.5,color:line});y-=height;cursor+=take;}
 if(!finance&&(row.nextKm!=null||row.expiresAt))paragraph([row.nextKm==null?'':t('Prag următor: ','Next threshold: ')+row.nextKm.toLocaleString(locale)+' km',row.expiresAt?t('Expiră: ','Expires: ')+row.expiresAt:''].filter(Boolean).join(' · '),false,9);
 if(row.parts&&!finance)paragraph(t('Lucrări / piese: ','Work / parts: ')+row.parts.split('\n').filter(line=>!line.startsWith('AutoCare · ')).join('\n'),false,9);
 if(row.notes&&!finance)paragraph(t('Observații: ','Notes: ')+row.notes,false,9);
 }
 }
 if(!vehicles.length)paragraph(t('Nicio înregistrare pentru filtrele selectate.','No records match these filters.'));
 const pages=doc.getPages();pages.forEach((sheet,i)=>{sheet.drawLine({start:{x:L,y:44},end:{x:R,y:44},thickness:.5,color:line});sheet.drawText(finance?t('Generat cu AutoCare Premium','Generated with AutoCare Premium')+' · '+generatedAt:'AutoCare Premium · autocareapp.ro',{x:L,y:29,size:8,font:regular,color:muted});if(finance)sheet.drawText(t('Document informativ — nu reprezintă factură fiscală','Informational document — not a tax invoice'),{x:L,y:16,size:7,font:regular,color:muted});const count=(i+1)+' / '+pages.length;sheet.drawText(count,{x:R-regular.widthOfTextAtSize(count,8),y:29,size:8,font:regular,color:muted});});
 return Buffer.from(await doc.save());
}
