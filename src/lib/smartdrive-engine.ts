/** SmartDrive calculations. Pure functions; never treat GPS distance as confirmed odometer. */
export type OdometerReading={date:string;km:number};
export type DrivingEstimate={dailyKm:number;weeklyKm:number;monthlyKm:number;sampleDays:number;confidence:'limited'|'moderate'|'good'};
export type MaintenanceInput={lastKm:number|null;lastDate:string|null;intervalKm:number|null;intervalDays:number|null;currentKm:number|null;dailyKm:number|null};
export type MaintenanceProjection={nextKm:number|null;remainingKm:number|null;dueDateByDistance:string|null;dueDateByCalendar:string|null;expectedDueDate:string|null;confidence:'unavailable'|'limited'|'estimated'};
const DAY=86400000;
function parseDay(s:string):number|null{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;const t=Date.parse(s+'T00:00:00Z');return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===s?t:null}
function formatDay(t:number){return new Date(t).toISOString().slice(0,10)}
export function calculateDrivingEstimate(readings:OdometerReading[]):DrivingEstimate|null{
 const rows=readings.map(r=>({...r,t:parseDay(r.date)})).filter((r):r is OdometerReading&{t:number}=>r.t!==null&&Number.isSafeInteger(r.km)&&r.km>=0).sort((a,b)=>a.t-b.t);
 if(rows.length<2)return null;
 for(let i=1;i<rows.length;i++)if(rows[i].t<=rows[i-1].t||rows[i].km<rows[i-1].km)return null;
 const days=(rows[rows.length-1].t-rows[0].t)/DAY;if(days<=0)return null;
 const dailyKm=(rows[rows.length-1].km-rows[0].km)/days;
 return {dailyKm,weeklyKm:dailyKm*7,monthlyKm:dailyKm*30.4375,sampleDays:days,confidence:rows.length>=4&&days>=21?'good':rows.length>=3&&days>=7?'moderate':'limited'};
}
export function projectMaintenance(x:MaintenanceInput,asOf:string):MaintenanceProjection{
 const blank:MaintenanceProjection={nextKm:null,remainingKm:null,dueDateByDistance:null,dueDateByCalendar:null,expectedDueDate:null,confidence:'unavailable'};
 const now=parseDay(asOf),last=x.lastDate?parseDay(x.lastDate):null;if(now===null)return blank;
 const valid=(v:number|null)=>v!==null&&Number.isSafeInteger(v)&&v>=0;
 const nextKm=valid(x.lastKm)&&valid(x.intervalKm)&&x.intervalKm!>0?x.lastKm!+x.intervalKm!:null;
 const remainingKm=nextKm!==null&&valid(x.currentKm)?nextKm-x.currentKm!:null;
 const calendar=last!==null&&valid(x.intervalDays)&&x.intervalDays!>0?formatDay(last+x.intervalDays!*DAY):null;
 const byDistance=remainingKm!==null&&x.dailyKm!==null&&Number.isFinite(x.dailyKm)&&x.dailyKm>0?formatDay(now+Math.max(0,Math.ceil(remainingKm/x.dailyKm))*DAY):null;
 const expected=[calendar,byDistance].filter((v):v is string=>v!==null).sort()[0]||null;
 return {nextKm,remainingKm,dueDateByDistance:byDistance,dueDateByCalendar:calendar,expectedDueDate:expected,confidence:expected===null?'unavailable':byDistance!==null?'estimated':'limited'};
}
