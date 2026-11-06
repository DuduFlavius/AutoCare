export function driveDistance(meters:number,locale='ro-RO'){
 const rounded=Math.max(0,Math.round(Number.isFinite(meters)?meters:0));
 return {value:rounded<1000?rounded.toLocaleString(locale):(rounded/1000).toLocaleString(locale,{minimumFractionDigits:2,maximumFractionDigits:2}),unit:rounded<1000?'m':'km',meters:rounded};
}
export function driveDuration(seconds:number){
 const total=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 return [Math.floor(total/3600),Math.floor(total%3600/60),total%60].map(n=>String(n).padStart(2,'0')).join(':');
}
