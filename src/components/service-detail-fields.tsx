'use client';
import {repairCategories} from '@/lib/record-categories';
import { useState } from 'react';
type Field = { key: string; label: string; type?: 'number'|'date'|'select'|'textarea'; options?: string[]; unit?: string; placeholder?: string };
const field = (key:string,label:string,type?:Field['type'],options?:string[],unit?:string):Field=>({key,label,type,options,unit});
const definitions: Record<string,{heading:string;advice:string;fields:Field[]}> = {
 'Schimb ulei':{heading:'Detalii schimb ulei',advice:'Folosește intervalul recomandat pentru motorul și regimul tău de utilizare. Nu există un interval universal.',fields:[field('tipUlei','Tip / vâscozitate ulei'),field('marcaUlei','Marca uleiului'),field('specificatieUlei','Specificație / omologare'),field('cantitateUlei','Cantitate utilizată','number',undefined,'litri'),field('ambalajUlei','Cod / lot ulei (opțional)'),field('intervalUlei','Interval recomandat de producător','number',undefined,'km'),field('conditiiUlei','Condiții de utilizare','select',['Normal','Urban / drumuri scurte','Solicitant / tractare','Nu știu'])]},
 'Filtre':{heading:'Detalii schimb filtre',advice:'Intervalele diferă după motor, filtru și condițiile de utilizare. Poți introduce fiecare filtru separat.',fields:[]},
 'Frâne':{heading:'Detalii sistem de frânare',advice:'Plăcuțele și discurile se înlocuiesc în funcție de uzură și verificare, nu la un kilometraj fix.',fields:[field('lucrareFrane','Tip lucrare','select',['Plăcuțe','Discuri','Lichid de frână','Etriere','Conducte','Altă lucrare']),field('pozitieFrane','Poziție','select',['Față','Spate','Ambele','Nu se aplică']),field('marcaFrane','Marcă / piese folosite'),field('pieseFrane','Piese înlocuite'),field('verificareFrane','Următoarea verificare','date')]},
 'Anvelope':{heading:'Detalii anvelope',advice:'Verifică periodic presiunea, uzura și starea anvelopelor. Păstrează separat detaliile seturilor de vară și iarnă.',fields:[field('operatieAnvelope','Operațiune','select',['Schimb sezonier','Montaj','Echilibrare','Reparație','Înlocuire']),field('sezonAnvelope','Tip anvelope','select',['Vară','Iarnă','All-season']),field('dimensiuneAnvelope','Dimensiune'),field('marcaAnvelope','Marcă'),field('costAnvelope','Cost anvelope','number',undefined,'RON'),field('costServiciiAnvelope','Cost montaj / servicii','number',undefined,'RON'),field('anvelopeVara','Set anvelope vară (opțional)'),field('anvelopeIarna','Set anvelope iarnă (opțional)')]},
 'Baterie':{heading:'Detalii baterie',advice:'Verifică starea bateriei periodic, în special înaintea sezonului rece. Durata de viață depinde de utilizare.',fields:[field('operatieBaterie','Operațiune','select',['Înlocuire','Verificare','Încărcare','Altă intervenție']),field('marcaBaterie','Marcă / model'),field('capacitateBaterie','Capacitate','number',undefined,'Ah'),field('tipBaterie','Tip','select',['AGM','EFB','Plumb-acid','Gel','Alt tip']),field('garantieBaterie','Garanție / termen'),field('dataGarantieBaterie','Data expirării garanției','date'),field('verificareBaterie','Următoarea verificare','date')]},
 'Distribuție':{heading:'Detalii distribuție',advice:'Consultă intervalul specific motorului și tipului de distribuție. Nu toate motoarele au același termen.',fields:[field('sistemDistributie','Sistem','select',['Curea','Lanț','Nu știu']),field('lucrareDistributie','Tip intervenție'),field('pieseDistributie','Piese schimbate'),field('urmatoareaDataDistributie','Data următoarei verificări / înlocuiri','date'),field('intervalDistributie','Interval conform producătorului (km)','number',undefined,'km')]},
 'Revizie generală':{heading:'Detalii revizie generală',advice:'Notează verificările și problemele observate, pentru a le putea urmări la următoarea revizie.',fields:[field('verificariRevizie','Verificări efectuate','textarea'),field('verificareUlei','Verificat nivel ulei','select',['Da','Nu']),field('verificareFraneRevizie','Verificat frâne','select',['Da','Nu']),field('verificareAnvelopeRevizie','Verificat anvelope','select',['Da','Nu']),field('verificareLichideRevizie','Verificat lichide','select',['Da','Nu']),field('pieseRevizie','Piese înlocuite','textarea'),field('verificareDirectie','Verificat direcția','select',['Da','Nu']),field('verificareSuspensie','Verificat suspensia','select',['Da','Nu']),field('problemeRevizie','Probleme identificate','textarea')]},
 'Reparație':{heading:'Detalii reparație',advice:'Descrie simptomele și piesele înlocuite; aceste informații pot ajuta la diagnosticări viitoare.',fields:[field('titluReparatie','Titlul reparației'),field('categorieReparatie','Sistem','select',['Motor','Transmisie','Suspensie','Direcție','Electrică','Răcire','Climatizare','Altele']),field('problemaReparatie','Descrierea problemei','textarea'),field('pieseReparatie','Piese înlocuite','textarea'),field('garantieReparatie','Garanție, dacă există'),field('dataGarantieReparatie','Data expirării garanției','date')]},
 'ITP':{heading:'Detalii ITP',advice:'Introdu data expirării la „Următoarea intervenție” pentru a putea primi notificări potrivit setărilor contului.',fields:[field('rezultatITP','Rezultat','select',['Admis','Respins','În așteptare']),field('statieITP','Stația ITP'),field('mentiuniITP','Mențiuni / observații','textarea'),field('expirareITP','Data expirării ITP','date')]},
 'Altă operațiune':{heading:'Detalii operațiune',advice:'Poți salva rapid operațiunea și completa ulterior detaliile.',fields:[field('categorieAlta','Categorie'),field('descriereAlta','Descriere','textarea'),field('mementoAlta','Doresc să urmăresc această operațiune','select',['Da','Nu'])]}
};
export {parseServiceDetails,serializeServiceDetails} from '@/lib/service-details';
import {parseServiceDetails} from '@/lib/service-details';
export default function ServiceDetailFields({category,parts}:{category:string;parts:string}){
 const specific=repairCategories.has(category)&&category!=='Reparație'?{
 heading:'Detalii '+category.toLocaleLowerCase('ro'),
 advice:'Descrie lucrarea efectuată și urmează intervalele recomandate de producător pentru mașina ta.',
 fields:[field('diagnostic','Diagnostic / simptome','textarea'),field('lucrareEfectuata','Lucrarea efectuată','textarea'),field('pieseInlocuite','Piese înlocuite','textarea'),...(category==='Cutie de viteze și transmisie'?[field('tipTransmisie','Tip cutie de viteze','select',['Manuală','Automată','CVT','Dublu ambreiaj','Alt tip']),field('uleiTransmisie','Ulei / specificație'),field('cantitateTransmisie','Cantitate utilizată','number',undefined,'litri')]:category==='Sistem de răcire'?[field('lichidRacire','Lichid / specificație'),field('cantitateRacire','Cantitate utilizată','number',undefined,'litri')]:category==='Aer condiționat'?[field('agentFrigorific','Agent frigorific'),field('cantitateAgent','Cantitate utilizată','number',undefined,'g')]:category==='Caroserie și vopsitorie'?[field('elementeCaroserie','Elemente reparate'),field('codCuloare','Cod culoare')]:[]),field('garantieLucrare','Garanție / termen'),field('urmatoareaVerificare','Următoarea verificare','date')]
 }:undefined;
 const config=specific||definitions[category];const saved=parseServiceDetails(parts);
 const [filters,setFilters]=useState(()=>Math.max(1,...Object.keys(saved).filter(x=>/^filtru\d+Tip$/.test(x)).map(x=>Number(x.match(/\d+/)?.[0]||0)+1)));
 if(!config)return null;
 const render=(f:Field)=> <label key={f.key}>{f.label}{f.unit?' · '+f.unit:''}
 {f.type==='select'?<select name={'ac_'+f.key} defaultValue={saved[f.key]||''}><option value="">Alege (opțional)</option>{f.options?.map(x=><option key={x} value={x}>{x}</option>)}</select>
 :f.type==='textarea'?<textarea name={'ac_'+f.key} defaultValue={saved[f.key]||''} maxLength={800} rows={2}/>
 :<input name={'ac_'+f.key} type={f.type||'text'} step={f.type==='number'?'0.01':undefined} min={f.type==='number'?0:undefined} defaultValue={saved[f.key]||''} placeholder={f.placeholder||'Opțional'}/>}</label>;
 return <section className="ac-service-details" aria-label={config.heading}>
 <div className="ac-service-heading"><h3>{config.heading}</h3><span>Completează ce cunoști</span></div>
 {config.fields.length>0&&<div className="form-grid">{config.fields.filter(f=>!(category==='Schimb ulei'&&f.key==='intervalUlei')).map(render)}</div>}
 {['Filtre','Schimb ulei'].includes(category)&&<div className="ac-filter-list">{Array.from({length:filters},(_,i)=><div className="ac-filter-item" key={i}><strong>Filtrul {i+1}</strong><div className="form-grid">
 {render(field('filtru'+i+'Tip','Tip filtru','select',['Ulei','Aer','Habitaclu','Combustibil','Alt filtru']))}
 {render(field('filtru'+i+'Marca','Marcă / cod piesă'))}
 {render(field('filtru'+i+'Cod','Cod piesă (opțional)'))}
 {render(field('filtru'+i+'Cost','Cost filtru','number',undefined,'RON'))}
 {render(field('filtru'+i+'Interval','Interval recomandat','number',undefined,'km'))}
 {render(field('filtru'+i+'Km','Următorul schimb','number',undefined,'km'))}
 {render(field('filtru'+i+'Data','Data următoarei schimbări','date'))}
 </div></div>)}
 <button type="button" className="ac-add-filter" onClick={()=>setFilters(x=>Math.min(x+1,8))} disabled={filters>=8}>+ Adaugă încă un filtru</button></div>}

 <div className="ac-service-advice"><strong>Recomandare AutoCare</strong><p>{config.advice}</p></div>
 </section>
}