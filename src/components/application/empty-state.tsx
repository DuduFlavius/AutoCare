'use client';

import {ArrowUpRight, CalendarDays, Files, Gauge, KeyRound, MapPin, Route, Sparkles, Wallet, Wrench} from 'lucide-react';
import type {ReactNode} from 'react';
import {useApplicationLanguage} from '../application-locale';

const modules = {
  garage: {icon:KeyRound, accent:MapPin, title:['Garajul tău începe aici.','Your garage starts here.'], note:['Păstrează datele și istoricul fiecărui vehicul în același loc.','Keep each vehicle’s details and history in one place.'], action:['Adaugă primul vehicul','Add your first vehicle']},
  documents: {icon:Files, accent:KeyRound, title:['Documentele tale, mereu la îndemână.','Your documents, always at hand.'], note:['Păstrează actele și termenele de expirare în dosarul digital al mașinii.','Keep vehicle documents and expiry dates in your digital folder.'], action:['Adaugă primul document','Add your first document']},
  maintenance: {icon:Wrench, accent:CalendarDays, title:['Ai grijă de mașina ta, fără griji.','Look after your car with confidence.'], note:['Notează ce ai schimbat și urmărește când urmează următoarea intervenție.','Log completed work and see when your next service is due.'], action:['Adaugă prima revizie','Log your first service']},
  expenses: {icon:Wallet, accent:Files, title:['Preia controlul costurilor auto.','Take control of your vehicle costs.'], note:['Înregistrează alimentările, parcările și alte cheltuieli pentru a vedea unde se duc banii.','Log fuel, parking and other expenses to see where your money goes.'], action:['Adaugă prima cheltuială','Add your first expense']},
  mileage: {icon:Gauge, accent:Route, title:['Fiecare kilometru contează.','Every kilometre counts.'], note:['Salvează o citire de pe bord pentru a începe istoricul kilometrajului.','Add a confirmed odometer reading to start your mileage history.'], action:['Înregistrează kilometrajul','Record mileage']},
  calendar: {icon:CalendarDays, accent:Files, title:['Nu mai rata niciun termen important.','Never miss an important date.'], note:['Planifică o lucrare sau salvează termenul unui document. Îl vei găsi în calendar.','Schedule work or save a document deadline to see it on your calendar.'], action:['Adaugă un eveniment','Add an event']},
  smartdrive: {icon:Route, accent:MapPin, title:['Următoarea ta călătorie începe aici.','Your next journey starts here.'], note:['Traseele salvate vor apărea în istoricul SmartDrive.','Saved trips will appear in your SmartDrive history.'], action:['Deschide harta','Open the map']},
  ai: {icon:Sparkles, accent:Files, title:['Asistentul tău auto inteligent.','Your intelligent vehicle assistant.'], note:['Alege o întrebare sau scrie una despre mașina ta.','Choose a question or write your own about your car.'], action:['','']},
} as const;
type Module = keyof typeof modules;
type Text = readonly [string,string];

export function EmptyState({module,onAction,action,note,needsVehicle=false,children}:{
  module:Module;onAction?:()=>void;action?:Text;note?:Text;needsVehicle?:boolean;children?:ReactNode;
}) {
  const index=useApplicationLanguage()==='en'?1:0;
  const {icon:Icon,accent:Accent,title,note:defaultNote,action:defaultAction}=modules[module];
  const label=(needsVehicle?modules.garage.action:action??defaultAction)[index];
  return <section className="rg-empty-feature" data-empty-module={module} data-workspace-ui>
    <div className="rg-empty-copy">
      <h2>{title[index]}</h2>
      <p>{(needsVehicle?['Adaugă un vehicul pentru a începe.','Add a vehicle to get started.']:note??defaultNote)[index]}</p>
      {onAction&&<button type="button" className="rg-empty-cta" onClick={onAction}>{label}<ArrowUpRight size={17} aria-hidden="true"/></button>}
      {children}
    </div>
    <div className="rg-empty-art" aria-hidden="true">
      <span className="rg-empty-art-back"/><span className="rg-empty-art-main"><Icon strokeWidth={1.2}/></span>
      <span className="rg-empty-art-accent"><Accent size={23} strokeWidth={1.5}/></span>
    </div>
  </section>;
}

export function FirstVehicleBenefits({navigate}:{navigate:(tab:string)=>void}){
  const index=useApplicationLanguage()==='en'?1:0;
  const items=[
    {icon:Files,tab:'Documente',title:['Dosar digital','Digital folder'],note:['Actele și expirările, la îndemână.','Documents and expiry dates at hand.']},
    {icon:Wrench,tab:'Întreținere',title:['Întreținere planificată','Planned maintenance'],note:['Revizii și lucrări ușor de urmărit.','Keep track of servicing and repairs.']},
    {icon:Wallet,tab:'Cheltuieli',title:['Costuri la vedere','Clear costs'],note:['Alimentări și cheltuieli în același loc.','Fuel and expenses in one place.']},
  ];
  return <div className="rg-first-benefits" data-workspace-ui>
    {items.map(({icon:Icon,tab,title,note})=><button type="button" key={tab} onClick={()=>navigate(tab)}>
      <Icon size={31} strokeWidth={1.45} aria-hidden="true"/><strong>{title[index]}</strong><small>{note[index]}</small><ArrowUpRight size={17} aria-hidden="true"/>
    </button>)}
  </div>;
}
