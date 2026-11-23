'use client';
import './reference-home.css';
import {ArrowRight,Navigation} from 'lucide-react';
import type {dashboard} from '@/lib/service';
import {selectActiveVehicle,upcomingMaintenance} from '@/lib/application-home';
import {useApplicationLanguage} from '../application-locale';
import {useMileageUsage} from '../use-mileage-usage';
import {MobileCockpit} from './mobile-cockpit';
type Data=Awaited<ReturnType<typeof dashboard>>;
type Row=Data['records'][number];
type Props={androidSmartDrive?:boolean;data:Data;name:string;selectedVehicle:string;onSelectVehicle:(id:string)=>void;onDrill:(tab:string,vehicleId:string,ids:string[],label:string)=>void;navigate:(tab:string)=>void;onVehicle:(id:string)=>void;onCreate:(kind:'vehicle'|'service'|'document'|'expense',vehicleId?:string)=>void;onRecord:(row:Row)=>void;onRefresh:()=>Promise<void>;currency:'RON'|'EUR';preview:boolean};
export default function ApplicationHome(props:Props){
 const {data,name,selectedVehicle,navigate,onRecord,preview}=props;
 const en=useApplicationLanguage()==='en',t=(ro:string,english:string)=>en?english:ro;
 const car=selectActiveVehicle(data.vehicles.filter(v=>!v.archived),selectedVehicle);
 const usage=useMileageUsage(car?.id??'',car?.odometer??0,preview);
 const rows=data.records.filter(r=>!r.cancelled&&r.vehicleId===car?.id);
 const next=car?upcomingMaintenance(rows,car.odometer,usage.dailyKm,data.profile.timezone)[0]:undefined;
 const openNext=()=>{const r=rows.find(r=>r.id===next?.service.id||next?.service.id.startsWith(r.id+':'));if(r)onRecord(r);else navigate('Întreținere');};
 return <section className="rg-home-reference"><header className="rg-home-welcome"><div><h1 id="workspace-page-title" tabIndex={-1}>{t('Bine ai revenit,','Welcome back,')} {name.trim().split(/\s+/)[0]}! <span aria-hidden="true">👋</span></h1><p className="ac-home-title">{t('Garajul tău digital','Your digital garage')}</p><p>{t('Totul despre mașinile tale, într-un singur loc.','Everything about your vehicles, in one place.')}</p></div><button onClick={()=>navigate('Garaj')}>{t('Garajul meu','My garage')}</button></header>{props.androidSmartDrive&&<section className="ac-home-smartdrive">
 <header><span className="ac-home-smartdrive-icon"><Navigation size={25}/></span><div><h2>SmartDrive GPS</h2><p>{t('Navigație, trasee și kilometri înregistrați','Navigation, routes and recorded mileage')}</p></div></header>
 <div className="ac-home-smartdrive-map" aria-hidden="true"><svg viewBox="0 0 400 100" preserveAspectRatio="xMidYMid slice"><path d="M-5 77 53 53l43 19 78-13 34-30 62 9 59-21 77 8M-5 29l83 1 30 27 66 2 24 55M63 108l32-36M221-5l-13 34 18 66M294-5l-25 42 40 71M358-8l-29 25 9 68" stroke="#80adb4" opacity=".35" strokeWidth="3" fill="none"/><path d="M53 53q16-6 32 12t62-1l27-5 34-30 62 9 59-21" stroke="#78edf2" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none"/><circle cx="53" cy="53" r="7" fill="#f6fbfd"/><circle cx="329" cy="17" r="7" fill="#78edf2" stroke="white" strokeWidth="2"/></svg></div>
 <button type="button" className="primary" onClick={()=>navigate('Plan întreținere')}>{t('Deschide GPS','Open GPS')}<ArrowRight size={16}/></button>
 </section>}<MobileCockpit {...props} onNextService={openNext}/></section>;
}
