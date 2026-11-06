import {parseServiceDetails} from './service-details';
export function isOilMaintenance(record:{category:string;title:string;parts?:string|null}){
 const category=record.category.trim().toLocaleLowerCase('ro-RO'),label=category+' '+record.title.toLocaleLowerCase('ro-RO');
 if(/cutie|transmisie|diferențial|diferential|servodirec|gearbox|transmission/.test(label))return false;
 return !!parseServiceDetails(record.parts||'').intervalUlei || /^(?:ulei|oil)(?:$|[ +&])/.test(category) || (/ulei/.test(label)&&/schimb|motor|revizie/.test(label)) || /\b(?:engine oil|oil change|oil & filters|oil and filters)\b/.test(label);
}
