'use client';
import type {dashboard} from '@/lib/service';
import {selectActiveVehicle,upcomingMaintenance} from '@/lib/application-home';
import {useApplicationLanguage} from '../application-locale';
import {useMileageUsage} from '../use-mileage-usage';
import {MobileCockpit} from './mobile-cockpit';
type Data=Awaited<ReturnType<typeof dashboard>>;
type Row=Data['records'][number];
type Props={data:Data;name:string;selectedVehicle:string;onSelectVehicle:(id:string)=>void;onDrill:(tab:string,vehicleId:string,ids:string[],label:string)=>void;navigate:(tab:string)=>void;onVehicle:(id:string)=>void;onCreate:(kind:'vehicle'|'service'|'document'|'expense',vehicleId?:string)=>void;onRecord:(row:Row)=>void;onRefresh:()=>Promise<void>;currency:'RON'|'EUR';preview:boolean};
export default function ApplicationHome(props:Props){
 const {data,name,selectedVehicle,navigate,onRecord,preview}=props;
 const en=useApplicationLanguage()==='en',t=(ro:string,english:string)=>en?english:ro;
 const car=selectActiveVehicle(data.vehicles.filter(v=>!v.archived),selectedVehicle);
 const usage=useMileageUsage(car?.id??'',car?.odometer??0,preview);
 const rows=data.records.filter(r=>!r.cancelled&&r.vehicleId===car?.id);
 const next=car?upcomingMaintenance(rows,car.odometer,usage.dailyKm,data.profile.timezone)[0]:undefined;
 const openNext=()=>{const r=rows.find(r=>r.id===next?.service.id||next?.service.id.startsWith(r.id+':'));if(r)onRecord(r);else navigate('Întreținere');};
 return <section className="rg-home-reference"><header className="rg-hero"><div><h1 id="workspace-page-title" tabIndex={-1}>{t('Bun venit,','Welcome,')} {name.trim().split(/\s+/)[0]}! <span aria-hidden="true">👋</span></h1><p>{t('Garajul tău inteligent, mereu la zi.','Your smart garage, always up to date.')}</p></div><button onClick={()=>navigate('Garaj')}>{t('Garajul meu','My garage')}</button></header><MobileCockpit {...props} onNextService={openNext}/></section>;
}
