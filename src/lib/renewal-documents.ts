import { documentStatus } from './config';
export const renewalCategories = ['RCA', 'Rovinietă'] as const;
export type RenewalCategory = typeof renewalCategories[number];
export const renewalOffsets = [30, 15, 7, 1, 0] as const;
export const roadPortals = {
 buy: 'https://www.erovinieta.ro/',
 verify: 'https://portal.etoll.ro/web/guest/verificare-rovinieta',
 toll: 'https://www.etoll.ro/',
 registry: 'https://asfromania.ro/ro/a/1740/registrul-intermediarilor-secundari',
};
export const insuranceProviders = [
 {name:'RCA.ro',url:'https://www.rca.ro/',ro:'Consultă ofertele RCA pentru mașina și perioada alese.',en:'Request RCA quotes for your vehicle and chosen period.',operator:'Online Insurance Solutions · RAJ 506995 / MaxyGo · RBK-179'},
 {name:'PrețulMeu.ro',url:'https://pretulmeu.ro/asigurare-rca',ro:'Compară polițele disponibile pentru profilul tău.',en:'Compare policies available for your profile.',operator:'ABA Digitech · RAJ-554685 / Safety Broker · RBK-293'},
 {name:'Asigra',url:'https://asigra.ro/asigurare-rca',ro:'Explorează ofertele asigurătorilor parteneri.',en:'Explore quotes from participating insurers.',operator:'E Montido · 564659 / Transilvania Broker · RBK-374'},
] as const;
type RenewalRecord={id:string;kind:string;vehicleId:string;category:string;cancelled:boolean;date:string|null;expiresAt:string|null;createdAt?:Date|string};
/** Prefer the latest issued policy. Future and older policies remain available in Documents. */
export function renewalDocument<T extends RenewalRecord>(records:T[],vehicleId:string,category:RenewalCategory,now=new Date(),timezone='Europe/Bucharest') {
 const candidates=records.filter(r=>r.kind==='document'&&!r.cancelled&&r.vehicleId===vehicleId&&r.category===category);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const started=candidates.filter(r=>!r.date||r.date<=today);
 const row=[...(started.length?started:candidates)].sort((a,b)=>(b.date||'').localeCompare(a.date||'')||(b.expiresAt||'').localeCompare(a.expiresAt||'')||String(b.createdAt||'').localeCompare(String(a.createdAt||''))||a.id.localeCompare(b.id))[0];
 return row?{record:row,status:documentStatus(row.expiresAt,now,timezone),future:!!row.date&&row.date>today}:null;
}
