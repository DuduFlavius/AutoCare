export type MapLightMode = 'auto' | 'day' | 'night' | 'schedule';
export type MapLightSettings = {mode:MapLightMode; day:string; night:string; lead:number};
export const defaultMapLight:MapLightSettings = {mode:'auto',day:'07:00',night:'19:00',lead:0};
const rad=Math.PI/180;
const minute=60_000;
const clockPattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function readMapLight(value:string|null): MapLightSettings {
  try {
    const input=JSON.parse(value??'null');
    if(input&&['auto','day','night','schedule'].includes(input.mode)&&clockPattern.test(input.day)&&
        clockPattern.test(input.night)&&[0,10,20,30].includes(input.lead))
      return {mode:input.mode,day:input.day,night:input.night,lead:input.lead};
  } catch { /* Invalid stored preferences use defaults. */ }
  return defaultMapLight;
}

/** Approximate apparent sunrise and sunset in UTC using the NOAA solar equations. */
export function solarWindow(now:Date, latitude:number, longitude:number): {constant:boolean}|{sunrise:number;sunset:number} {
  const date=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate());
  const days=(date-Date.UTC(now.getFullYear(),0,1))/86_400_000;
  const yearDays=(Date.UTC(now.getFullYear()+1,0,1)-Date.UTC(now.getFullYear(),0,1))/86_400_000;
  const g=2*Math.PI*days/yearDays;
  const equation=229.18*(.000075+.001868*Math.cos(g)-.032077*Math.sin(g)-.014615*Math.cos(2*g)-.040849*Math.sin(2*g));
  const decl=.006918-.399912*Math.cos(g)+.070257*Math.sin(g)-.006758*Math.cos(2*g)+.000907*Math.sin(2*g)-.002697*Math.cos(3*g)+.00148*Math.sin(3*g);
  const lat=Math.max(-89.9999,Math.min(latitude,89.9999))*rad;
  const angle=(Math.cos(90.833*rad)-Math.sin(lat)*Math.sin(decl))/(Math.cos(lat)*Math.cos(decl));
  if(angle>=1)return {constant:false} as const;
  if(angle<=-1)return {constant:true} as const;
  const noon=720-4*longitude-equation;
  const radius=4*Math.acos(angle)/rad;
  const localNoon=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12).getTime();
  const shift=Math.round((localNoon-(date+noon*minute))/86_400_000)*86_400_000;
  return {sunrise:date+shift+(noon-radius)*minute,sunset:date+shift+(noon+radius)*minute};
}

export function mapIsDay(settings:MapLightSettings,now:Date,location:{ latitude:number; longitude:number }) {
  if(settings.mode==='day'||settings.mode==='night')return settings.mode==='day';
  if(settings.mode==='schedule'){
    const current=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
    return settings.day<=settings.night?current>=settings.day&&current<settings.night:current>=settings.day||current<settings.night;
  }
  const window=solarWindow(now,location.latitude,location.longitude);
  if('constant' in window)return window.constant;
  return now.getTime()>=window.sunrise&&now.getTime()<window.sunset-settings.lead*minute;
}
