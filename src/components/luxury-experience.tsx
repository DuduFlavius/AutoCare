'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight,ArrowRight,ShieldCheck,FileText,Wrench,Wallet,Route,Gauge,Check,Bell,Layers,CalendarDays} from 'lucide-react';
const features=[
 {id:'care',title:'Întreținere',Icon:Wrench,heading:'Fiecare intervenție. În context.',copy:'Ulei, distribuție, filtre și frâne. Păstrezi data, kilometrajul, piesele și costul fiecărei lucrări. Vezi următorul prag doar după configurarea intervalului.',label:'PLANUL MAȘINII TALE',items:['Istoric de service','Praguri de timp și kilometraj','Estimări din datele confirmate'],href:'/intretinere-auto'},
 {id:'documents',title:'Documente',Icon:FileText,heading:'Actele în ordine. Mintea la drum.',copy:'Un dosar privat pentru documentele mașinii. RCA, ITP, rovinietă și CASCO, împreună cu datele de expirare introduse de tine.',label:'DOSARUL TĂU DIGITAL',items:['Documente și atașamente','Scadențe organizate','Notificări configurabile'],href:'/documente-auto'},
 {id:'costs',title:'Cheltuieli',Icon:Wallet,heading:'Claritate pentru fiecare cost.',copy:'Înțelegi cheltuielile pe care le înregistrezi: întreținere, combustibil și restul costurilor. Compari perioadele și consulți rapoartele disponibile în planul tău.',label:'CONTROL ASUPRA COSTURILOR',items:['Totaluri lunare și anuale','Filtre și categorii','Rapoarte PDF și CSV cu Premium'],href:'/cheltuieli-auto'},
 {id:'drive',title:'SmartDrive',Icon:Route,heading:'Kilometrii dau sens planului.',copy:'Actualizezi kilometrajul manual sau înregistrezi o sesiune GPS. AutoDrive este disponibil în aplicația nativă, după asocierea explicită a Bluetooth-ului mașinii și acordarea permisiunilor.',label:'SMARTDRIVE · DATE CONFIRMATE',items:['Citiri manuale și istoric','Sesiuni GPS pe dispozitiv','Estimări, fără kilometri inventați'],href:'/aplicatie-auto'},
];
export function LuxuryMotion(){
 useEffect(()=>{
  const elements=document.querySelectorAll<HTMLElement>('.ac-lux-public [data-reveal]');
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}}),{threshold:.08});
  elements.forEach(element=>{element.classList.add('will-reveal');observer.observe(element);});
  const motion=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('motion-visible',entry.isIntersecting)),{rootMargin:'100px'});
  document.querySelectorAll('.ac-lux-public .lux-hero,.ac-lux-public .lux-feature-section').forEach(element=>motion.observe(element));
  return()=>{observer.disconnect();motion.disconnect();elements.forEach(element=>element.classList.remove('will-reveal'));};
 },[]);
 return null;
}
export default function LuxuryExperience(){
 const [selected,setSelected]=useState(0);
 const active=features[selected];
 const stage=useRef<HTMLDivElement>(null);
 return <>
 <section className="lux-feature-section" id="functii" data-reveal>
  <div className="lux-section-heading"><p className="lux-eyebrow">O MAȘINĂ. UN SINGUR SPAȚIU.</p><h2>Mai puține griji.<br/><span>Mai multă perspectivă.</span></h2><p>Tot ce ține de mașina ta, organizat într-un garaj digital privat. Explorează ce poți face.</p></div>
  <div className="lux-tabs" role="tablist" aria-label="Explorează funcționalitățile">{features.map((feature,index)=><button key={feature.id} id={'feature-tab-'+feature.id} role="tab" aria-selected={index===selected} aria-controls="feature-panel" tabIndex={index===selected?0:-1} onClick={()=>setSelected(index)} onKeyDown={event=>{let next:number;if(event.key==='ArrowRight')next=(index+1)%features.length;else if(event.key==='ArrowLeft')next=(index+features.length-1)%features.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=features.length-1;else return;event.preventDefault();setSelected(next);document.getElementById('feature-tab-'+features[next].id)?.focus();}}><feature.Icon size={18}/>{feature.title}</button>)}</div>
  <div className="lux-feature-panel" id="feature-panel" role="tabpanel" aria-labelledby={'feature-tab-'+active.id}>
   <div className="lux-technical-stage" ref={stage} onPointerMove={event=>{if(event.pointerType!=='mouse'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const box=event.currentTarget.getBoundingClientRect();event.currentTarget.style.setProperty('--tilt',(((event.clientX-box.left)/box.width-.5)*8)+'deg');}} onPointerLeave={()=>stage.current?.style.setProperty('--tilt','0deg')}>
    <div className="lux-orbit lux-orbit--outer"/><div className="lux-orbit lux-orbit--inner"/>
    <div className="lux-instrument"><active.Icon size={58} strokeWidth={1}/><span>AUTOCARE</span></div>
    <span className="lux-stage-label">{active.label}</span>
    <div className="lux-stage-chips">{active.items.map(item=><span key={item}><Check size={13}/>{item}</span>)}</div>
   </div>
   <div className="lux-feature-copy" key={active.id}><p className="lux-eyebrow">{active.title.toUpperCase()}</p><h3>{active.heading}</h3><p>{active.copy}</p><Link href={active.href}>Descoperă funcția <ArrowUpRight size={18}/></Link></div>
  </div>
 </section>
 <section className="lux-drive-section" data-reveal>
  <div><p className="lux-eyebrow">SMARTDRIVE</p><h2>Un cockpit digital.<br/><span>Pentru datele tale reale.</span></h2><p>De la kilometrajul confirmat la următoarea lucrare. Istoric, sesiuni GPS și estimări într-un spațiu care îți arată ce contează.</p><Link href="/aplicatie-auto" className="lux-text-link">Vezi aplicația și compatibilitatea <ArrowRight size={17}/></Link></div>
  <div className="lux-cockpit" aria-label="Prezentarea funcțiilor SmartDrive, fără date de traseu simulate"><div className="lux-cockpit-top"><Route size={18}/><span>SMARTDRIVE</span><span className="lux-live-caption">Controlul tău. Datele tale.</span></div><div className="lux-gauge" aria-hidden="true"><Gauge size={78} strokeWidth={.8}/><span>km</span></div><p>Kilometraj confirmat</p><div className="lux-cockpit-footer"><span><CalendarDays size={17}/>Istoric</span><span><Wrench size={17}/>Întreținere</span><span><ShieldCheck size={17}/>Confidențial</span></div></div>
 </section>
 <section className="lux-product-tour" data-reveal>
  <div className="lux-section-heading"><p className="lux-eyebrow">CONSTRUIT ÎN JURUL MAȘINII TALE</p><h2>O imagine de ansamblu.<br/><span>Fără lucruri pierdute printre aplicații.</span></h2></div>
  <div className="lux-tour-grid">{[
   {Icon:Layers,title:'Garajul tău',copy:'Selectezi mașina și regăsești documentele, lucrările și kilometrajul asociate ei.'},
   {Icon:Bell,title:'Ce urmează',copy:'Vezi documentele care expiră și lucrările pentru care ai configurat un termen.'},
   {Icon:Wallet,title:'Costuri explicabile',copy:'Totaluri calculate din înregistrările tale, cu acces la sursa fiecărei cheltuieli.'},
  ].map(item=><article key={item.title}><item.Icon size={23}/><h3>{item.title}</h3><p>{item.copy}</p></article>)}</div>
  <Link href="/cum-functioneaza" className="lux-text-link">Cum arată un garaj organizat <ArrowUpRight size={17}/></Link>
 </section>
 <section className="lux-faq" data-reveal><div><p className="lux-eyebrow">RĂSPUNSURI CLARE</p><h2>Înainte de<br/>următorul drum.</h2><p>Fără promisiuni ascunse în detalii.</p></div><div>{[
  ['Pot începe gratuit?','Da. Planul gratuit permite o mașină activă. Compară limitele și funcțiile actuale pe pagina de prețuri.'],
  ['Sunt datele și documentele mele publice?','Nu. Garajul este asociat contului tău. Documentele și înregistrările personale nu apar în paginile publice ale site-ului.'],
  ['AutoDrive pornește la orice conexiune Bluetooth?','Nu. Se configurează explicit mașina și dispozitivul ei Bluetooth. În aplicația nativă, înregistrarea automată cere permisiunile necesare și confirmarea deplasării. Browserul nu oferă această automatizare.'],
  ['Cum sunt calculate zilele până la service?','Din termenul introdus sau din kilometrajul confirmat, intervalul configurat și media de utilizare disponibilă. Când lipsesc datele necesare, aplicația nu inventează o estimare.'],
 ].map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
 </>;
}
