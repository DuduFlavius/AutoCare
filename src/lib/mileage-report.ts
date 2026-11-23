import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import assets from './report-assets.json';
import {reportBrandLogo} from './report-brand';
import type {mileageSeries} from './mileage-history';

export async function mileageReport(car:{brand:string;model:string;plate:string},series:ReturnType<typeof mileageSeries>,timezone:string,from='',to='',en=false){
  const t=(ro:string,english:string)=>en?english:ro;
  const locale=en?'en-GB':'ro-RO';
  const doc=await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const regular=await doc.embedFont(Buffer.from(assets.regular,'base64'),{subset:true});
  const bold=await doc.embedFont(Buffer.from(assets.bold,'base64'),{subset:true});
  const logo=await doc.embedPng(Buffer.from(reportBrandLogo,'base64'));
  const petrol=rgb(.035,.29,.35),pearl=rgb(.94,.97,.98),white=rgb(1,1,1);
  const title=t('Kilometraj & Istoric','Mileage & History');
  doc.setTitle('AutoCare Premium · '+title);
  const date=new Intl.DateTimeFormat(locale,{dateStyle:'short',timeStyle:'short',timeZone:timezone});
  const number=new Intl.NumberFormat(locale,{maximumFractionDigits:1});
  const km=(n:number|null|undefined)=>n==null?'—':number.format(n)+' km';
  const generated=date.format(new Date());
  function header(){
    const page=doc.addPage([595.28,841.89]);
    page.drawRectangle({x:40,y:731,width:515,height:70,color:petrol});
    page.drawImage(logo,{x:54,y:746,width:40,height:40});
    page.drawText('AutoCare Premium',{x:106,y:770,font:bold,size:19,color:white});
    page.drawText(title,{x:106,y:749,font:regular,size:12,color:white});
    return page;
  }
  let page=header(), y=706;
  function text(value:string,x:number,at:number,size=10,strong=false){
    page.drawText(value,{x,y:at,size,font:strong?bold:regular,color:petrol});
  }
  const identity=[car.brand,car.model,car.plate].join(' · ').replace(/[\r\n]/g,' ');
  text(Array.from(identity).slice(0,68).join(''),40,y,12,true);
  text(t('Perioada: ','Period: ')+(from||'—')+' – '+(to||'—'),40,y-=20);
  const cards=[[t('Inițial','Initial'),km(series.first?.odometer)],[t('Final','Final'),km(series.last?.odometer)],
    [t('Diferență','Distance'),km(series.distance)],[t('Medie zilnică','Daily average'),series.average==null?'—':km(series.average)+' / '+t('zi','day')]];
  cards.forEach(([label,value],index)=>{
    const x=40+index*130;
    page.drawRectangle({x,y:y-66,width:125,height:52,color:pearl});
    text(label,x+9,y-30,9);text(value,x+9,y-50,11,true);
  });
  y-=86;
  if(series.first&&series.last){
    text(t('Citiri analizate: ','Observed readings: ')+series.first.date+' – '+series.last.date,40,y,9);
    const min=Math.min(...series.rows.map(row=>row.odometer));
    const max=Math.max(...series.rows.map(row=>row.odometer));
    const start=+new Date(series.first.recordedAt),end=+new Date(series.last.recordedAt);
    const base=y-122;
    for(const fraction of [0,.5,1]){
      page.drawLine({start:{x:105,y:base+fraction*85},end:{x:550,y:base+fraction*85},color:pearl,thickness:1});
      text(number.format(min+(max-min)*fraction),42,base+fraction*85-2,8);
    }
    let previous:{x:number;y:number}|undefined;
    for(const row of series.rows){
      const point={x:105+(end===start?.5:(+new Date(row.recordedAt)-start)/(end-start))*445,y:base+(min===max?.5:(row.odometer-min)/(max-min))*85};
      if(previous)page.drawLine({start:previous,end:point,color:petrol,thickness:1.4});
      page.drawCircle({...point,size:1.8,color:petrol});
      previous=point;
    }
    y=base-27;
  }
  function table(){
    page.drawRectangle({x:40,y:y-20,width:515,height:22,color:pearl});
    [t('Data și ora','Date and time'),t('Kilometraj','Odometer'),t('Diferență','Change'),t('Sursă','Source')].forEach((label,i)=>text(label,[50,224,350,476][i],y-13,9,true));
    y-=36;
  }
  table();
  if(!series.rows.length)text(t('Nu există citiri în interval.','No readings in this period.'),50,y);
  for(const [index,row] of series.rows.entries()){
    if(y<65){page=header();y=705;table();}
    if(index%2)page.drawRectangle({x:40,y:y-7,width:515,height:21,color:pearl});
    [date.format(new Date(row.recordedAt)),km(row.odometer),km(row.delta),row.source==='gps'?'GPS':t('Manual','Manual')].forEach((value,i)=>text(value,[50,224,350,476][i],y,9));
    y-=21;
  }
  const pages=doc.getPages();
  pages.forEach((sheet,index)=>{
    page=sheet;
    text('AutoCare Premium · '+generated,40,35,8);
    text((index+1)+' / '+pages.length,515,35,8);
  });
  return Buffer.from(await doc.save());
}
