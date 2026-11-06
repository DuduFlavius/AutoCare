'use client';
import {useApplicationLanguage,useApplicationLocale} from './application-locale';
export default function ServiceMileage({currentKm,lastKm,nextKm}:{currentKm:number;lastKm:number|null;nextKm:number|null}){
 const en=useApplicationLanguage()==='en',locale=useApplicationLocale(),km=(n:number)=>n.toLocaleString(locale)+' km';
 return <div className="small" data-workspace-ui>
 <div><strong>{en?'Current mileage: ':'Kilometraj actual: '}{km(currentKm)}</strong></div>
 <div>{en?'At service: ':'La intervenție: '}{lastKm==null?(en?'Not recorded':'Necompletat'):km(lastKm)}</div>
 {lastKm!=null&&<div>{currentKm<lastKm?(en?'Check the recorded service mileage.':'Verifică kilometrajul intervenției.'):(en?'Since service: ':'Parcurși de la intervenție: ')+km(currentKm-lastKm)}</div>}
 {nextKm!=null&&<><div>{en?'Next service at: ':'Următoarea intervenție la: '}{km(nextKm)}</div><div>{nextKm<currentKm?(en?'Overdue by: ':'Prag depășit cu: '):(en?'Remaining: ':'Rămași: ')}{km(Math.abs(nextKm-currentKm))}</div></>}
 </div>;
}
