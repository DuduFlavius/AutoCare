import { reportAccent, reportLayout, reportMuted } from './report-layout';
import type { mileageSeries } from './mileage-history';

export async function mileageReport(car:{brand:string;model:string;plate:string},series:ReturnType<typeof mileageSeries>,timezone:string,from='',to='',en=false){
  const t=(ro:string,english:string)=>en?english:ro;
  const locale=en?'en-GB':'ro-RO';
  const number=new Intl.NumberFormat(locale,{maximumFractionDigits:1});
  const date=new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:timezone});
  const day=new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'});
  const dateLabel=(value:string)=>value?day.format(new Date(value+'T12:00:00Z')):'—';
  const km=(value:number|null|undefined)=>value==null?'—':number.format(value)+' km';
  const L=await reportLayout({title:t('Kilometraj & Istoric','Mileage & History'),subtitle:t('Citiri de bord și evoluția înregistrată','Odometer readings and recorded progression'),
    period:t('Perioada  ','Period  ')+dateLabel(from||series.first?.date||'')+' – '+dateLabel(to||series.last?.date||''),
    generated:date.format(new Date()),edition:t('EDIȚIE DE RAPORT','REPORT EDITION'),en});
  L.paragraph([car.brand,car.model,car.plate].join(' · '),{strong:true});
  if(!series.rows.length){
    L.paragraph(t('Nu există citiri în interval. Adaugă o citire sau alege o altă perioadă.','No readings in this period. Add a reading or select another period.'));
    return L.finish();
  }
  L.section('01',t('Rezumatul citirilor','Reading summary'));
  L.metrics([[t('CITIRE INIȚIALĂ','INITIAL READING'),km(series.first?.odometer)],
    [t('CITIRE FINALĂ','FINAL READING'),km(series.last?.odometer)],
    [t('DIFERENȚĂ OBSERVATĂ','OBSERVED DISTANCE'),km(series.distance)],
    ...(series.average!=null?[[t('MEDIE ZILNICĂ','DAILY AVERAGE'),km(series.average)+'/ '+t('zi','day')] as [string,string]]:[])]);
  if(series.distance==null)L.paragraph(t('Diferența rămâne indisponibilă când lipsesc citirile comparabile sau există o scădere a kilometrajului.','Distance is unavailable when comparable readings are missing or the odometer decreases.'));
  if(series.rows.length>1){
    L.section('02',t('Evoluția kilometrajului','Odometer progression'),162);
    L.graphic(154,(x,top,width,page)=>{
      const base=top-107, chartHeight=93;
      let min=Infinity,max=-Infinity;
      for(const row of series.rows){min=Math.min(min,row.odometer);max=Math.max(max,row.odometer);}
      const span=Math.max(1,max-min);
      const left=x+Math.max(62,L.measure(km(max),8)+10),right=x+width-3;
      const start=+new Date(series.first!.recordedAt),end=+new Date(series.last!.recordedAt);
      for(const fraction of [0,.5,1]){
        const y=base+fraction*chartHeight;
        L.line(left,y,right,y);
        L.text(km(min+fraction*span),x,y-2,8,false,reportMuted);
      }
      let previous:{x:number;y:number}|undefined;
      for(const row of series.rows){
        const point={x:left+(end===start?.5:(+new Date(row.recordedAt)-start)/(end-start))*(right-left),
          y:base+(row.odometer-min)/span*chartHeight};
        if(previous)page.drawLine({start:previous,end:point,color:reportAccent,thickness:1.55});
        if(series.rows.length<60)page.drawCircle({...point,size:1.7,color:reportAccent});
        previous=point;
      }
      const last=dateLabel(series.last!.date);
      L.text(dateLabel(series.first!.date),left,base-17,8,false,reportMuted);
      L.text(last,right-L.measure(last,8),base-17,8,false,reportMuted);
    });
  }
  L.section(series.rows.length>1?'03':'02',t('Jurnal de bord','Odometer log'));
  L.table([{label:t('Data și ora','Date and time'),ratio:.37},{label:t('Kilometraj','Odometer'),ratio:.23,right:true},
    {label:t('Diferență','Change'),ratio:.22,right:true},{label:t('Sursă','Source'),ratio:.18}],
    series.rows.map(row=>[date.format(new Date(row.recordedAt)),km(row.odometer),km(row.delta),row.source==='gps'?'GPS':t('Manual','Manual')]));
  return L.finish();
}
