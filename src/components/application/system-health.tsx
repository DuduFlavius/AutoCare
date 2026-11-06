'use client';
import {Filter,Disc3,CircleDot,Battery,SlidersHorizontal,ArrowUpRight} from 'lucide-react';
import {useApplicationLanguage,useApplicationLocale} from '../application-locale';
import {currentHomeMaintenance,upcomingMaintenance} from '@/lib/application-home';
import {forecastDuration} from '@/lib/service-forecast';
import type {dashboard} from '@/lib/service';
type Row=Awaited<ReturnType<typeof dashboard>>['records'][number];
export default function SystemHealth({rows,currentKm,dailyKm,timezone,premium,onRecord,onCreate}:{rows:Row[];currentKm:number;dailyKm:number|null;timezone:string;premium:boolean;onRecord:(row:Row)=>void;onCreate:()=>void}){
 const en=useApplicationLanguage()==='en',locale=useApplicationLocale();
 const latest=currentHomeMaintenance(rows);
 return <details className="ac-system-checks" data-workspace-ui><summary><SlidersHorizontal size={17}/>{en?'Other systems · filters, brakes, tires and battery':'Alte sisteme · filtre, frâne, anvelope și baterie'}</summary><div className="ac-system-check-grid">{[
  {category:'Filtre',ro:'Filtre',en:'Filters',Icon:Filter},
  {category:'Frâne',ro:'Frâne',en:'Brakes',Icon:Disc3},
  {category:'Anvelope',ro:'Anvelope',en:'Tires',Icon:CircleDot},
  {category:'Baterie',ro:'Baterie',en:'Battery',Icon:Battery},
 ].map(item=>{
  const record=latest.find(row=>row.category===item.category);
  const forecast=record&&premium?upcomingMaintenance([record],currentKm,dailyKm,timezone)[0]:undefined;
  const km=forecast?.status.remainingKm;
  return <button type="button" key={item.category} onClick={()=>record?onRecord(record):onCreate()}><item.Icon size={21}/><span>{en?item.en:item.ro}</span><small>{record?(en?'Service recorded':'Intervenție înregistrată'):(en?'No service recorded':'Fără intervenție înregistrată')}</small>{km!=null&&<strong>{Math.abs(km).toLocaleString(locale)} km {km<0?(en?'overdue':'peste prag'):(en?'remaining':'rămași')}</strong>}{forecast?.estimate?.days!=null&&<small>{forecastDuration(forecast.estimate.days,en?'en':'ro')}</small>}<ArrowUpRight size={15}/></button>;
 })}</div></details>;
}
