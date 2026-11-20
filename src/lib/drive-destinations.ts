export type SavedDestination={name:string;details?:string;latitude:number;longitude:number;kind?:'home'|'work'|'favorite'};
export function destinationIdentity(point:SavedDestination){return `${point.latitude.toFixed(5)}:${point.longitude.toFixed(5)}`;}
/** Validate device storage before displaying it or sending coordinates to routing. */
export function parseSavedDestinations(value:unknown):SavedDestination[]{
 if(!Array.isArray(value))return [];
 return value.filter((p):p is SavedDestination=>!!p&&typeof p==='object'&&typeof p.name==='string'&&p.name.length>0&&p.name.length<=250&&Number.isFinite(p.latitude)&&Math.abs(p.latitude)<=85&&Number.isFinite(p.longitude)&&Math.abs(p.longitude)<=180&&(p.details==null||typeof p.details==='string'&&p.details.length<=500)&&(!p.kind||['home','work','favorite'].includes(p.kind))).slice(0,12);
}
export function rememberDestination(previous:SavedDestination[],next:SavedDestination){return [next,...previous.filter(p=>destinationIdentity(p)!==destinationIdentity(next))].slice(0,8);}
