'use client';
import { useState } from 'react';
type Field = { key: string; label: string; type?: 'number'|'date'|'select'|'textarea'; options?: string[]; unit?: string; placeholder?: string };
const field = (key:string,label:string,type?:Field['type'],options?:string[],unit?:string):Field=>({key,label,type,options,unit});
const definitions: Record<string,{heading:string;advice:string;fields:Field[]}> = {
 'Schimb ulei':{heading:'Detalii schimb ulei',advice:'Folosește intervalul recomandat pentru motorul și regimul tău de utilizare. Nu există un interval universal.',fields:[field('tipUlei','Tip / vâscozitate ulei'),field('marcaUlei','Marca uleiului'),field('specificatieUlei','Specificație / omologare'),field('cantitateUlei','Cantitate utilizată','number',undefined,'litri'),field('ambalajUlei','Cod / lot ulei (opțional)')]},
 'Filtre':{heading:'Detalii schimb filtre',advice:'Intervalele diferă după motor, filtru și condițiile de utilizare. Poți introduce fiecare filtru separat.',fields:[]},
 'Frâne':{heading:'Detalii sistem de frânare',advice:'Plăcuțele și discurile se înlocuiesc în funcție de uzură și verificare, nu la un kilometraj fix.',fields:[field('lucrareFrane','Tip lucrare','select',['Plăcuțe','Discuri','Lichid de frână','Etriere','Conducte','Altă lucrare']),field('pozitieFrane','Poziție','select',['Față','Spate','Ambele','Nu se aplică']),field('marcaFrane','Marcă / piese folosite'),field('verificareFrane','Următoarea verificare','date')]},
 'Anvelope':{heading:'Detalii anvelope',advice:'Verifică periodic presiunea, uzura și starea anvelopelor. Păstrează separat detaliile seturilor de vară și iarnă.',fields:[field('operatieAnvelope','Operațiune','select',['Schimb sezonier','Montaj','Echilibrare','Reparație','Înlocuire']),field('sezonAnvelope','Tip anvelope','select',['Vară','Iarnă','All-season']),field('dimensiuneAnvelope','Dimensiune'),field('marcaAnvelope','Marcă')]},
 'Baterie':{heading:'Detalii baterie',advice:'Verifică starea bateriei periodic, în special înaintea sezonului rece. Durata de viață depinde de utilizare.',fields:[field('operatieBaterie','Operațiune','select',['Înlocuire','Verificare','Încărcare','Altă intervenție']),field('marcaBaterie','Marcă / model'),field('capacitateBaterie','Capacitate','number',undefined,'Ah'),field('tipBaterie','Tip','select',['AGM','EFB','Plumb-acid','Gel','Alt tip']),field('garantieBaterie','Garanție / termen'),field('verificareBaterie','Următoarea verificare','date')]},
 'Distribuție':{heading:'Detalii distribuție',advice:'Consultă intervalul specific motorului și tipului de distribuție. Nu toate motoarele au același termen.',fields:[field('sistemDistributie','Sistem','select',['Curea','Lanț','Nu știu']),field('lucrareDistributie','Tip intervenție'),field('pieseDistributie','Piese schimbate')]},
 'Revizie generală':{heading:'Detalii revizie generală',advice:'Notează verificările și problemele observate, pentru a le putea urmări la următoarea revizie.',fields:[field('verificariRevizie','Verificări efectuate','textarea'),field('pieseRevizie','Piese înlocuite','textarea'),field('problemeRevizie','Probleme identificate','textarea')]},
 'Reparație':{heading:'Detalii reparație',advice:'Descrie simptomele și piesele înlocuite; aceste informații pot ajuta la diagnosticări viitoare.',fields:[field('titluReparatie','Titlul reparației'),field('categorieReparatie','Sistem','select',['Motor','Transmisie','Suspensie','Direcție','Electrică','Răcire','Climatizare','Altele']),field('problemaReparatie','Descrierea problemei','textarea'),field('pieseReparatie','Piese înlocuite','textarea'),field('garantieReparatie','Garanție, dacă există')]},
 'ITP':{heading:'Detalii ITP',advice:'Introdu data expirării la „Următoarea intervenție” pentru a putea primi notificări potrivit setărilor contului.',fields:[field('rezultatITP','Rezultat','select',['Admis','Respins','În așteptare']),field('statieITP','Stația ITP')]},
 'Altă operațiune':{heading:'Detalii operațiune',advice:'Poți salva rapid operațiunea și completa ulterior detaliile.',fields:[field('categorieAlta','Categorie'),field('descriereAlta','Descriere','textarea')]}
};
const prefix='AutoCare · ';
export function parseServiceDetails(parts:string){const out:Record<string,string>={};for(const line of parts.split('\n')){if(line.startsWith(prefix)){const i=line.indexOf(': ',prefix.length);if(i>0)out[line.slice(prefix.length,i)]=line.slice(i+2)}}return out}
export function serializeServiceDetails(parts:string,form:FormData){
 const old=parts.split('\n').filter(x=>!x.startsWith(prefix)).join('\n').trim();
 const lines:string[]=[];
 for(const [key,value] of form.entries()){if(!key.startsWith('ac_'))continue;const v=String(value).trim();if(v)lines.push(prefix+key.slice(3)+': '+v.replace(/\r?\n/g,' / '))}
 return [old,...lines].filter(Boolean).join('\n');
}
export default function ServiceDetailFields({category,parts}:{category:string;parts:string}){
 const config=definitions[category];const saved=parseServiceDetails(parts);
 const [filters,setFilters]=useState(()=>Math.max(1,...Object.keys(saved).filter(x=>/^filtru\d+Tip$/.test(x)).map(x=>Number(x.match(/\d+/)?.[0]||0)+1)));
 if(!config)return null;
 const render=(f:Field)=> <label key={f.key}>{f.label}{f.unit?' · '+f.unit:''}
 {f.type==='select'?<select name={'ac_'+f.key} defaultValue={saved[f.key]||''}><option value="">Alege (opțional)</option>{f.options?.map(x=><option key={x}>{x}</option>)}</select>
 :f.type==='textarea'?<textarea name={'ac_'+f.key} defaultValue={saved[f.key]||''} maxLength={800} rows={2}/>
 :<input name={'ac_'+f.key} type={f.type||'text'} step={f.type==='number'?'0.01':undefined} min={f.type==='number'?0:undefined} defaultValue={saved[f.key]||''} placeholder={f.placeholder||'Opțional'}/>}</label>;
 return <section className="ac-service-details" aria-label={config.heading}>
 <div className="ac-service-heading"><h3>{config.heading}</h3><span>Completează ce cunoști</span></div>
 {category==='Filtre'&&<div className="ac-filter-list">{Array.from({length:filters},(_,i)=><div className="ac-filter-item" key={i}><strong>Filtrul {i+1}</strong><div className="form-grid">
 {render(field('filtru'+i+'Tip','Tip filtru','select',['Ulei','Aer','Habitaclu','Combustibil','Alt filtru']))}
 {render(field('filtru'+i+'Marca','Marcă / cod piesă'))}
 {render(field('filtru'+i+'Cost','Cost filtru','number',undefined,'RON'))}
 {render(field('filtru'+i+'Km','Următorul schimb','number',undefined,'km'))}
 {render(field('filtru'+i+'Data','Data următoarei schimbări','date'))}
 </div></div>)}
 <button type="button" className="ac-add-filter" onClick={()=>setFilters(x=>Math.min(x+1,8))} disabled={filters>=8}>+ Adaugă încă un filtru</button></div>}
 {config.fields.length>0&&<div className="form-grid">{config.fields.map(render)}</div>}
 <div className="ac-service-advice"><strong>Recomandare AutoCare</strong><p>{config.advice}</p></div>
 </section>
}