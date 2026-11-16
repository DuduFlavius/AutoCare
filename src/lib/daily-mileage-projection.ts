/** Calendar-day declaration, never a measured or confirmed GPS/odometer reading. */
export function dailyMileageProjection(currentKm:number,dailyKm:number|null,anchorDay:string,today:string){
 const day=(s:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;const value=Date.parse(s+'T00:00:00Z');return Number.isFinite(value)&&new Date(value).toISOString().slice(0,10)===s?value:NaN;};
 const elapsed=Math.floor((day(today)-day(anchorDay))/86400000);
 const days=Number.isFinite(elapsed)?Math.max(0,elapsed):0;
 const added=dailyKm!=null&&Number.isFinite(dailyKm)&&dailyKm>0?Math.floor(days*dailyKm):0;
 return {days,addedKm:added,projectedKm:Math.min(99999999,currentKm+added),source:'declared-estimate' as const};
}
