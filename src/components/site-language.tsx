'use client';
import {useEffect} from 'react';
const dictionary:Record<string,string>={
'Acasă':'Home','Garaj personal':'Personal garage','Garajul meu':'My garage','Garaj':'Garage','Documente':'Documents','Calendar':'Calendar','Intervenții':'Maintenance','Întreținere':'Maintenance','Plan întreținere':'Maintenance planner','SmartDrive GPS':'SmartDrive GPS','Kilometraj':'Mileage','Cheltuieli':'Expenses','Centru de suport':'Support center','Istoric auto':'Vehicle history','Notificări':'Notifications','Premium':'Premium','Setări':'Settings','Abonament':'Subscription','Administrare':'Administration','Deconectare':'Sign out','Deschide meniul':'Open menu','Activează locația':'Enable location','Adaugă o mașină':'Add a vehicle','Adaugă prima mașină':'Add your first vehicle','Mașina ta':'Your vehicle','MAȘINA TA':'YOUR VEHICLE','Activă':'Active','Activ':'Active','Benzină':'Petrol','Motorină':'Diesel','Electric':'Electric','Hibrid':'Hybrid','Deschide garajul':'Open garage','Kilometraj actual':'Current mileage','Kilometraj înregistrat':'Recorded mileage','Documente înregistrate':'Saved documents','Vezi detalii':'View details','Următorul schimb de ulei':'Next oil change','URMĂTORUL SCHIMB DE ULEI':'NEXT OIL CHANGE','URMĂTORUL TERMEN':'NEXT DEADLINE','Nu există un termen viitor':'No upcoming deadline','Documente în atenție':'Documents needing attention','Termene prioritare':'Priority deadlines','Vezi calendarul':'View calendar','Vezi toate':'View all','Documente care expiră':'Expiring documents','Ultimele intervenții':'Recent maintenance','Cheltuieli recente':'Recent expenses','Ultimul schimb':'Last change','Interval setat':'Configured interval','Ulei utilizat':'Oil used','Neconfigurat':'Not configured','Vezi istoricul intervențiilor':'View maintenance history','Plan gratuit':'Free plan','ACCESUL TĂU ACTUAL':'YOUR CURRENT ACCESS','Facturare recurentă lunară':'Monthly recurring billing','Facturare recurentă anuală':'Annual recurring billing','Alege lunar':'Choose monthly','Alege anual':'Choose annual','Vezi în cont':'View in account','PREMIUM LUNAR':'MONTHLY PREMIUM','PREMIUM ANUAL':'ANNUAL PREMIUM','PREMIUM 3 LUNI':'3-MONTH PREMIUM','CEL MAI BUN RAPORT PREȚ–BENEFICII':'BEST VALUE','Flexibil, lună de lună.':'Flexible, month to month.','Mai multă valoare.':'More value.','Un trimestru fără griji.':'Three months of peace of mind.','Toate funcțiile Premium':'All Premium features','Gestionare din portalul de facturare':'Manage in billing portal','Următoarea întreținere':'Upcoming maintenance','Kilometrajul mașinilor':'Vehicle mileage','Actualizează kilometrajul':'Update mileage','Actualizează km':'Update mileage','Kilometraj actual (km)':'Current mileage (km)','Anulează':'Cancel','Se salvează…':'Saving…','AUTOCARE · PLANIFICARE':'AUTOCARE · PLANNING','Ești sigur că ai parcurs atât?':'Are you sure you drove this far?','Introdu km acum':'Enter mileage now','Următoarea citire de kilometraj':'Next mileage reading','Revizie scadentă':'Maintenance due','Timp necunoscut':'Time unknown','Estimare timp până la revizie':'Estimated time until maintenance','Se calculează…':'Calculating…','km rămași':'km remaining','Înregistrează intervenția':'Record maintenance','Adaugă document':'Add document','Salvează':'Save','Editează':'Edit','Șterge':'Delete','Caută':'Search','Închide':'Close','Confirmă':'Confirm','Profil':'Profile','Preferințe':'Preferences','Ajutor':'Help','Autentificare':'Sign in','Înregistrare':'Sign up','Parolă':'Password','Email':'Email','Nume':'Name','Data':'Date','Status':'Status','Descriere':'Description','Observații':'Notes','Sumă':'Amount','Preț':'Price','Valoare':'Value','Încarcă':'Upload','Trimite':'Send','Înapoi':'Back','Continuă':'Continue','Detalii':'Details','Istoric':'History','Atenție':'Attention','ESENȚIAL':'ESSENTIAL','ORGANIZARE':'ORGANIZATION','CONT ȘI AJUTOR':'ACCOUNT & HELP'};
Object.assign(dictionary,{
"Bună,":"Hello,",
"Acasă, în garaj.":"Home, in your garage.",
"Total despre mașinile tale, într-un singur loc.":"Everything about your vehicles, all in one place.",
"Mașinile tale, organizate într-un singur loc":"Your vehicles, all in one place",
"Documente, kilometraj și întreținere — informații din contul tău.":"Documents, mileage and maintenance — all your vehicle information.",
"GARAJUL MEU":"MY GARAGE",
"mașini active":"active vehicles",
"mașină activă":"active vehicle",
"Mai ai o mașină?":"Have another vehicle?",
"Completează datele și gestionează totul dintr-un singur loc.":"Add your vehicle and manage everything in one place.",
"Vezi mașina":"View vehicle",
"Arhivează":"Archive",
"De completat":"Not set",
"Documente active":"Active documents",
"Total documente":"Total documents",
"În termen":"Valid",
"Expiră în 30 de zile":"Expiring in 30 days",
"Expirate":"Expired",
"Caută titlu, categorie sau service...":"Search title, category or workshop...",
"Filtre și exporturi":"Filters and exports",
"Nu ai documente încă. Adaugă primul act al mașinii.":"No documents yet. Add your first vehicle document.",
"Adaugă primul document":"Add your first document",
"Lună":"Month",
"Listă":"List",
"Toate mașinile":"All vehicles",
"Nu ai termene înregistrate în luna selectată.":"No deadlines recorded for the selected month.",
"Scadențele documentelor și lucrărilor active":"Upcoming document and maintenance deadlines",
"Cost înregistrat":"Recorded cost",
"Operațiuni":"Operations",
"Următoarea intervenție":"Next maintenance",
"Ultimul kilometraj":"Last recorded mileage",
"Neplanificată":"Not scheduled",
"ÎNGRIJIRE LA TIMP":"ON-TIME CARE",
"Următoarele intervenții":"Upcoming maintenance",
"Dată nestabilită":"Date not set",
"Fără scadență":"No due date",
"Următorul prag:":"Next threshold:",
"Costurile sunt cele înregistrate de tine.":"Costs are based on your records.",
"Cronologie":"Timeline",
"Tabel":"Table",
"Atașează document":"Attach document",
"Adaugă intervenție":"Add maintenance",
"Înregistrează o nouă intervenție":"Record new maintenance",
"Adaugă cheltuială":"Add expense",
"Notează o nouă cheltuială":"Record a new expense",
"Urmărește și înregistrează trasee":"Track and record trips",
"Acțiuni rapide":"Quick actions",
"Schimb ulei":"Oil change",
"Total luna curentă":"Current month total",
"Nu există un termen viitor":"No upcoming deadline",
"Înregistrează intervenții pentru a vedea următoarele termene.":"Record maintenance to see upcoming deadlines.",
"Nu ai termene înregistrate":"No deadlines recorded",
"Înapoi la garaj":"Back to garage",
"Documente care expiră":"Expiring documents",
"Ultimele intervenții":"Recent maintenance",
"Cheltuieli recente":"Recent expenses",
"Următoarea citire de kilometraj":"Next mileage reading",
"Introdu kilometrajul":"Enter mileage",
"Actualizează citirea":"Update reading",
"Setări notificări":"Notification settings",
"Setări cont":"Account settings",
"Creează cont":"Create account",
"Autentifică-te":"Sign in",
"Încarcă document":"Upload document",
"Salvează modificările":"Save changes",
"Șterge documentul":"Delete document",
"Niciun rezultat":"No results",
"Încarcă mai multe":"Load more",
"Toate":"All",
"Da":"Yes",
"Nu":"No",
"Gratuit":"Free",
"lunar":"monthly",
"anual":"yearly",
"lună":"month",
"an":"year"
});
const originals=new WeakMap<Text,string>();
export default function SiteLanguage({language}:{language:'ro'|'en'}){
 useEffect(()=>{
  const root=document.querySelector('.app-shell')||document.body;
  const translate=()=>{const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;
   while((node=walker.nextNode())){const t=node as Text;const parent=t.parentElement;if(!parent||parent.closest('script,style,textarea,code,[contenteditable="true"]'))continue;
    const raw=originals.get(t)??t.nodeValue??'';if(!originals.has(t))originals.set(t,raw);
    const trimmed=raw.trim();const translated=language==='en'?(dictionary[trimmed] || trimmed.replace(/^(Bună,)(.*)$/,(all,a,b)=>'Hello,'+b).replace(/^(Dată nestabilită)(.*)$/,(all,a,b)=>'Date not set'+b).replace(/^(Următorul prag:)(.*)$/,(all,a,b)=>'Next threshold:'+b)):trimmed;
    const replacement=raw.replace(trimmed,translated);if(t.nodeValue!==replacement)t.nodeValue=replacement;
   }
  };
  translate();document.documentElement.lang=language;
  const attrs=()=>{root.querySelectorAll('input[placeholder],textarea[placeholder],button[aria-label],input[aria-label]').forEach(el=>{for(const key of ['placeholder','aria-label']){const originalKey='data-autocare-original-'+key;const val=el.getAttribute(originalKey)??el.getAttribute(key);if(!val)continue;if(!el.hasAttribute(originalKey))el.setAttribute(originalKey,val);el.setAttribute(key,language==='en'?(dictionary[val]||val):val);}})};
  attrs();const observer=new MutationObserver(()=>{translate();attrs()});observer.observe(root,{subtree:true,childList:true,characterData:true});return()=>observer.disconnect();
 },[language]);return null;
}
