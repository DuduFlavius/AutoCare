import {localDate} from './config';

export type MileageReading = {id:string;odometer:number;recordedAt:string|Date;createdAt:string|Date;source:string};
const dayMs=86400000;
export function mileageOrder(a:MileageReading,b:MileageReading){
  return +new Date(a.recordedAt)-+new Date(b.recordedAt)||+new Date(a.createdAt)-+new Date(b.createdAt)||a.id.localeCompare(b.id);
}
export function mileageSeries(readings:MileageReading[],timezone:string,from='',to=''){
  const sorted=[...readings].sort(mileageOrder);
  const rows=sorted.map((row,index)=>{
    const date=localDate(new Date(row.recordedAt),timezone);
    return {...row,date,delta:index?row.odometer-sorted[index-1].odometer:null};
  }).filter(row=>(!from||row.date>=from)&&(!to||row.date<=to));
  const first=rows[0],last=rows.at(-1);
  const span=first&&last?(Date.parse(last.date)-Date.parse(first.date))/dayMs:0;
  const distance=rows.length>1&&last&&rows.slice(1).every(row=>(row.delta??0)>=0)?last.odometer-first.odometer:null;
  return {rows,first,last,span,distance,average:span>0&&distance!=null?distance/span:null};
}
