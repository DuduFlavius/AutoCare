import { expenseDate, expenseSelection } from './finance-selection';
import { financeGroup, isFinancialEntry } from './finance-overview';
import { mileageSeries, type MileageReading } from './mileage-history';
import { isPlannedService } from './planned-service';

export const reportKinds = ['service','finance','annual','documents','journal'] as const;
export type ReportKind = typeof reportKinds[number];
export type ReportMileage = MileageReading & { vehicleId:string };
export type ReportVehicle = {id:string;brand:string;model:string;plate:string;odometer:number};
export type ReportRecord = {id?:string;vehicleId:string;kind:string;title:string;category:string;date:string|null;expiresAt:string|null;nextKm:number|null;odometer:number|null;amountBani:number;amountKnown:boolean;provider:string|null;notes:string|null;parts:string|null;cancelled?:boolean;createdAt?:string|Date};
export const vehicleName = (car:ReportVehicle)=>[car.brand,car.model,car.plate].filter(Boolean).join(' · ');

export function buildReportAnalysis(records:ReportRecord[],vehicles:ReportVehicle[],mileage:ReportMileage[],today:string,timezone:string,from?:string,to?:string) {
  const end=to&&to<today?to:today;
  const unique=[...new Map(records.map((row,i)=>[row.id??'row:'+i,{...row,id:row.id??'row:'+i,cancelled:!!row.cancelled}])).values()]
    .filter(row=>(!from||!!row.date&&row.date>=from)&&(!to||!!row.date&&row.date<=to));
  const eligible=unique.filter(row=>isFinancialEntry(row,today));
  const finance=expenseSelection(eligible,end,from);
  const byVehicle=new Map<string,number>();
  const months=new Map<string,number>();
  const groups=new Map<string,number>();
  for(const row of finance.known){
    byVehicle.set(row.vehicleId,(byVehicle.get(row.vehicleId)??0)+row.amountBani);
    const month=row.date!.slice(0,7);
    months.set(month,(months.get(month)??0)+row.amountBani);
    const group=financeGroup(row);
    groups.set(group,(groups.get(group)??0)+row.amountBani);
  }
  const monthKeys:string[]=[];
  const first=expenseDate(Math.min(finance.start,finance.end)).slice(0,7);
  const monthDate=new Date(first+'-01T12:00:00Z');
  const last=end.slice(0,7);
  const monthCount=Math.max(1,(Number(last.slice(0,4))-monthDate.getUTCFullYear())*12+Number(last.slice(5,7))-monthDate.getUTCMonth());
  for(let i=Math.max(0,monthCount-12);i<monthCount;i++){
    const month=new Date(Date.UTC(monthDate.getUTCFullYear(),monthDate.getUTCMonth()+i,1)).toISOString().slice(0,7);
    monthKeys.push(month);
  }
  const mileageByVehicle = vehicles.map(car=>({car,...mileageSeries(mileage.filter(read=>read.vehicleId===car.id),timezone,from,end)}));
  const confirmed=mileageByVehicle.filter(row=>row.distance!=null);
  const distance=confirmed.length ? confirmed.reduce((sum,row)=>sum+row.distance!,0) : null;
  const enoughForRate=byVehicle.size>0&&[...byVehicle.keys()].every(id=>confirmed.some(observed=>observed.car.id===id&&observed.distance!>0));
  const rateDistance=confirmed.reduce((sum,row)=>sum+(byVehicle.has(row.car.id)?row.distance!:0),0);
  const planned=unique.filter(row=>!row.cancelled&&row.kind==='service'&&isPlannedService(row,today));
  const completed=unique.filter(row=>!row.cancelled&&row.kind==='service'&&row.date&&row.date<=end&&!isPlannedService(row,today));
  const documents=unique.filter(row=>!row.cancelled&&row.kind==='document');
  const active=unique.filter(row=>!row.cancelled);
  return {finance,eligible,active,byVehicle,groups,monthCount,monthKeys,months,mileageByVehicle,distance,confirmed:confirmed.length,
    costPerKm:enoughForRate&&rateDistance>0?finance.total/rateDistance:null,planned,completed,documents};
}

export function reportPeriod(preset:string,today:string) {
  const [year,month]=today.split('-').map(Number);
  const at=(offset:number,day:number)=>new Date(Date.UTC(year,month-1+offset,day)).toISOString().slice(0,10);
  if(preset==='previous')return {from:at(-1,1),to:at(0,0)};
  if(preset==='year')return {from:year+'-01-01',to:today};
  if(preset==='all')return {from:'',to:today};
  const months=Number(preset)||1;
  return {from:at(1-months,1),to:today};
}
