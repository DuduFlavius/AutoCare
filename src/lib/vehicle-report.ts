import { categoryGraphic, cumulativeGraphic, monthlyGraphic } from './report-charts';
import { currencyRateLabel, formatDisplayMoney, type DisplayCurrency, type ExchangeRate } from './exchange-rate';
import { buildReportAnalysis, vehicleName, type ReportKind, type ReportMileage, type ReportRecord, type ReportVehicle } from './report-analysis';
import { translateApplicationCopy } from './application-language';
import { reportAccent, reportLayout, reportMuted } from './report-layout';
import { isPlannedService } from './planned-service';
import { parseServiceDetails } from './service-details';

export type { ReportRecord, ReportVehicle } from './report-analysis';
type Options = {vehicles:ReportVehicle[];records:ReportRecord[];generatedAt:string;language?:'ro'|'en';title?:string;period?:string;finance?:boolean;variant?:ReportKind;asOf?:string;currency?:DisplayCurrency;exchangeRate?:ExchangeRate|null;from?:string;to?:string;timezone?:string;mileage?:ReportMileage[];upcoming?:ReportRecord[]};

export async function vehicleReport({vehicles,records,generatedAt,language='ro',title,period,finance=false,variant,
  asOf=new Date().toISOString().slice(0,10),currency='RON',exchangeRate=null,from,to,timezone='Europe/Bucharest',mileage=[],upcoming=[]}:Options){
  const en=language==='en',t=(ro:string,english:string)=>en?english:ro,locale=en?'en-GB':'ro-RO';
  const type=variant??(finance?'finance':'journal');
  const labels={
    service:[t('Fișa de service','Service report'),t('Istoricul intervențiilor și lucrările programate','Maintenance history and scheduled work')],
    finance:[t('Situația cheltuielilor','Expense report'),t('Analiza costurilor înregistrate pentru vehicule','Analysis of recorded vehicle expenses')],
    annual:[t('Dosarul garajului','Garage dossier'),t('Raport anual de administrare auto','Annual vehicle management report')],
    documents:[t('Situația documentelor','Vehicle documents'),t('Documente auto și termene înregistrate','Vehicle documents and recorded deadlines')],
    journal:[t('Istoric auto','Vehicle history'),t('Registrul înregistrărilor din garaj','Garage records and activity')],
  }[type];
  const number=new Intl.NumberFormat(locale);
  const formatter=new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeZone:'UTC'});
  const date=(day:string|null|undefined)=>day?formatter.format(new Date(day+'T12:00:00Z')):'—';
  const km=(value:number|null|undefined)=>value==null?'—':number.format(value)+' km';
  const money=formatDisplayMoney(locale,currency,exchangeRate);
  const analysis=buildReportAnalysis(records,vehicles,mileage,asOf,timezone,from,to);
  const {active,completed,documents,eligible,byVehicle}=analysis;
  const recordedExpenses=eligible.filter(row=>!row.cancelled&&row.date&&row.date<=(to&&to<asOf?to:asOf));
  const planned=[...new Map([...analysis.planned,...upcoming].filter(row=>row.kind==='service'&&!row.cancelled&&
    !parseServiceDetails(row.parts??'').completedBy).map(row=>[row.id??row.title,row])).values()].sort(byDate);
  const names=new Map(vehicles.map(car=>[car.id,vehicleName(car)]));
  const hasContent=active.length>0||planned.length>0||(type==='annual'&&analysis.mileageByVehicle.some(item=>item.rows.length>0));
  const L=await reportLayout({title:title??labels[0],subtitle:labels[1],edition:t('EDIȚIE DE RAPORT','REPORT EDITION'),generated:generatedAt,en,
    period:from||to?t('Perioada  ','Period  ')+[date(from),date(to)].join(' – '):period||t('Toate înregistrările selectate','All selected records'),
    cover:type==='annual'&&hasContent});
  const tx=(text:string)=>translateApplicationCopy(text,language);
  const col=(label:string,ratio:number,right=false)=>({label,ratio,right});
  const dcol=()=>col(t('Data','Date'),.19);
  const amount=()=>col(t('Sumă','Amount'),.22,true);
  const rowAmount=(row:ReportRecord)=>row.amountKnown?money(row.amountBani):t('Necunoscut','Unknown');
  let chapter=0;
  const section=(ro:string,english:string,reserve?:number)=>L.section(String(++chapter).padStart(2,'0'),t(ro,english),reserve);
  function byDate(a:ReportRecord,b:ReportRecord){return (a.date??'9999').localeCompare(b.date??'9999');}
  function financialOverview(){
    const summary=analysis.finance;
    section('Analiza financiară','Financial analysis');
    L.metrics([
      [t('TOTAL ÎNREGISTRAT','TOTAL RECORDED'),summary.known.length?money(summary.total):'—'],
      [t('TRANZACȚII','TRANSACTIONS'),number.format(recordedExpenses.length)],
      [t('MEDIA PE LUNĂ DIN INTERVAL','MONTHLY PERIOD AVERAGE'),summary.known.length?money(summary.total/analysis.monthCount):'—'],
      [t('COST PE KILOMETRU','COST PER KILOMETRE'),analysis.costPerKm==null?'—':money(analysis.costPerKm)+' / km'],
      ...(['Combustibil','Service'] as const).filter(group=>analysis.groups.has(group)).map((group):[string,string]=>[tx(group).toLocaleUpperCase(locale),money(analysis.groups.get(group)!)]),
    ]);
    if(analysis.costPerKm==null)L.paragraph(t('Costul per kilometru necesită citiri comparabile pentru fiecare vehicul cu cheltuieli.','Cost per kilometre requires comparable readings for each vehicle with expenses.'));
    else L.paragraph(t('Costul per kilometru folosește diferențele dintre citirile de bord din interval.','Cost per kilometre uses the odometer differences observed within the period.'));
    if(!summary.known.length)return;
    if(summary.changes.length>1){
      section('Evoluția cumulativă','Cumulative spending',150);
      cumulativeGraphic(L,summary,money,locale);
    }
    if(analysis.monthCount>1){
      section('Comparație lunară','Monthly comparison',analysis.monthCount>12?182:158);
      if(analysis.monthCount>12)L.paragraph(t('Graficul afișează ultimele 12 luni din interval.','The chart shows the last 12 months of the period.'));
      monthlyGraphic(L,analysis,money,locale);
    }
    if(summary.total>0 && summary.categories.filter(row=>row.bani>0).length>1){
      section('Distribuția pe categorii','Expense distribution',178);
      categoryGraphic(L,summary.categories.map(category=>({...category,name:tx(category.name)})),summary.total,money,locale,en);
      const percent=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:2});
      if(summary.categories.length>5)L.table([col(t('Categorie','Category'),.51),col(t('Pondere','Share'),.22,true),col(t('Cost','Cost'),.27,true)],
        summary.categories.map(row=>[tx(row.name),percent.format(row.bani/summary.total),money(row.bani)]));
    }
    if(vehicles.length>1&&byVehicle.size){
      section('Costuri pe vehicule','Costs by vehicle');
      const total=summary.total;
      L.table([col(t('Vehicul','Vehicle'),.55),col(t('Pondere','Share'),.20,true),col(t('Cost','Cost'),.25,true)],
        [...byVehicle].sort((a,b)=>b[1]-a[1]).map(([id,bani])=>[names.get(id)??'—',total>0?new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1}).format(bani/total):'—',money(bani)]));
    }
  }
  function maintenanceHistory(rows:ReportRecord[],scheduled:ReportRecord[]){
    if(rows.length)section('Intervenții efectuate','Completed maintenance');
    for(const row of rows.sort(byDate)){
      L.graphic(28,(x,y)=>{
        L.rectangle(x,y-19,3,24,reportAccent);
        L.text(date(row.date),x+11,y-6,9,true,reportAccent);
        if(row.odometer!=null)L.text(km(row.odometer),x+124,y-6,9,false,reportMuted);
        const cost=rowAmount(row);L.text(cost,x+501-L.measure(cost,10,true),y-6,10,true);
      });
      L.paragraph(row.title+(row.category!==row.title?' · '+tx(row.category):''),{strong:true,indent:11});
      const details=parseServiceDetails(row.parts??'');
      const parts=(row.parts??'').split('\n').filter(line=>!line.startsWith('AutoCare · ')&&!line.startsWith('[ac:')).join('\n').trim();
      if(vehicles.length>1&&names.has(row.vehicleId))L.paragraph(names.get(row.vehicleId)!,{indent:11});
      if(row.provider)L.paragraph(t('Service  ','Workshop  ')+row.provider,{indent:11});
      if(parts)L.paragraph(t('Piese și lucrări  ','Parts and work  ')+parts,{indent:11});
      if(details.costLabor && Number.isFinite(Number(details.costLabor)))L.paragraph(t('Manoperă  ','Labor  ')+money(Number(details.costLabor)*100),{indent:11});
      if(row.notes)L.paragraph(t('Observații  ','Notes  ')+row.notes,{indent:11});
    }
    if(scheduled.length){
      section('Intervenții programate','Scheduled maintenance');
      L.table([dcol(),col(t('Intervenție','Work'),.59),col(t('Kilometraj țintă','Target mileage'),.22,true)],
        scheduled.map(row=>[date(row.date??row.expiresAt),[row.title,names.get(row.vehicleId)].filter(Boolean).join('\n'),km(row.nextKm)]));
    }
  }
  function documentStatus(rows:ReportRecord[]){
    if(!rows.length)return;
    section('Situația documentelor','Document status');
    const status=(day:string|null)=>{
      if(!day)return t('Fără termen','No expiry');
      const days=Math.round((Date.parse(day)-Date.parse(asOf))/86400000);
      return days<0?t('Expirat','Expired'):days===0?t('Expiră astăzi','Expires today'):days<=30?t('Termen apropiat','Due soon'):t('Valabil','Current');
    };
    L.table([col(t('Document și vehicul','Document and vehicle'),.40),col(t('Expirare','Expires'),.20),col(t('Stare','Status'),.20),col(t('Cost','Cost'),.20,true)],
      [...rows].sort((a,b)=>(a.expiresAt??'9999').localeCompare(b.expiresAt??'9999')).map(row=>[
        [tx(row.title),row.category!==row.title?tx(row.category):null,names.get(row.vehicleId)].filter(Boolean).join('\n'),
        date(row.expiresAt),status(row.expiresAt),rowAmount(row),
      ]));
  }
  function ledger(rows:ReportRecord[],annual=false){
    if(!rows.length&&!annual)return;
    const events=rows.map(row=>({date:row.date,detail:[tx(row.title),[tx(row.category),names.get(row.vehicleId)].filter(Boolean).join(' · ')].join('\n'),value:rowAmount(row)}));
    if(annual)for(const {car,rows} of analysis.mileageByVehicle){
      for(const reading of rows)events.push({date:reading.date,detail:t('Citire kilometraj','Odometer reading')+' · '+vehicleName(car),value:km(reading.odometer)});
    }
    if(!events.length)return;
    section(annual?'Cronologia garajului':type==='finance'?'Registrul tranzacțiilor':'Registrul înregistrărilor',annual?'Garage timeline':type==='finance'?'Transaction ledger':'Record ledger');
    L.table([dcol(),col(t('Înregistrare','Entry'),.59),amount()],events.sort((a,b)=>(a.date??'9999').localeCompare(b.date??'9999')).map(item=>[date(item.date),item.detail,item.value]));
  }

  if(!hasContent){
    L.paragraph(t('Nicio înregistrare pentru filtrele selectate.','No records match these filters.'),{strong:true});
    L.paragraph(vehicles.length?t('Adaugă înregistrări sau alege o altă perioadă.','Add records or select another period.'):t('Adaugă un vehicul pentru a crea dosarul garajului.','Add a vehicle to build your garage dossier.'));
    return L.finish();
  }
  if(currency==='EUR')L.paragraph(currencyRateLabel(language,exchangeRate));
  if(type==='finance'){
    financialOverview();
    ledger(recordedExpenses);
    L.paragraph(t('Document informativ. Nu reprezintă o factură fiscală.','For information only. This document is not a tax invoice.'));
  }else if(type==='annual'){
    section('Rezumatul garajului','Garage at a glance');
    L.metrics([
      [t('VEHICULE','VEHICLES'),number.format(vehicles.length)],
      [t('CHELTUIELI','EXPENSES'),analysis.finance.known.length?money(analysis.finance.total):'—'],
      [t('KM OBSERVAȚI ÎN INTERVAL','OBSERVED KM IN PERIOD'),km(analysis.distance)],
      [t('REVIZII EFECTUATE','COMPLETED SERVICES'),number.format(completed.length)],
      [t('DOCUMENTE','DOCUMENTS'),number.format(documents.length)],
      [t('EVENIMENTE ÎNREGISTRATE','RECORDED EVENTS'),number.format(active.length+analysis.mileageByVehicle.reduce((sum,item)=>sum+item.rows.length,0))],
    ]);
    if(analysis.confirmed<vehicles.length)L.paragraph(t('Kilometrii observați acoperă '+analysis.confirmed+' din '+vehicles.length+' vehicule cu citiri comparabile.','Observed distance covers '+analysis.confirmed+' of '+vehicles.length+' vehicles with comparable readings.'));
    if(vehicles.length){
      section('Vehicule și kilometraj','Vehicles and odometer records');
      L.table([col(t('Vehicul','Vehicle'),.48),col(t('Valoare de bord','Odometer'),.27,true),col(t('Diferență observată','Observed distance'),.25,true)],
        analysis.mileageByVehicle.map(({car,distance})=>[vehicleName(car),km(car.odometer),km(distance)]));
    }
    if(analysis.finance.known.length)financialOverview();
    L.paragraph(t('Înregistrări declarate în contul AutoCare. Istoricul nu certifică lucrările unui service.','Records entered in the AutoCare account. The history does not certify work by a service centre.'));
    maintenanceHistory(completed,planned);
    documentStatus(documents);
    const milestones=[...documents,...upcoming.filter(row=>row.kind==='document')].filter(row=>row.expiresAt&&row.expiresAt>=asOf&&Date.parse(row.expiresAt)-Date.parse(asOf)<=30*86400000);
    const deadlines=[...new Map(milestones.map(row=>[row.id??row.title,row])).values()].sort((a,b)=>a.expiresAt!.localeCompare(b.expiresAt!));
    if(deadlines.length){
      section('Termene în următoarele 30 de zile','Deadlines in the next 30 days');
      L.table([dcol(),col(t('Document și vehicul','Document and vehicle'),.81)],deadlines.map(row=>[date(row.expiresAt),[tx(row.title),names.get(row.vehicleId)].filter(Boolean).join(' · ')]));
    }
    ledger(active,true);
  }else if(type==='service'){
    section('Rezumat executiv','Executive summary');
    L.metrics([[t('INTERVENȚII EFECTUATE','COMPLETED WORK'),number.format(completed.length)],
      [t('COST ÎNREGISTRAT','RECORDED COST'),analysis.finance.known.length?money(analysis.finance.total):'—'],
      [t('PROGRAMATE','SCHEDULED'),number.format(planned.length)]]);
    for(const car of vehicles)L.paragraph(vehicleName(car)+'  /  '+km(car.odometer),{strong:true});
    maintenanceHistory(completed,planned);
    if(!completed.length&&!planned.length)L.paragraph(t('Nu sunt intervenții datate în interval.','There are no dated maintenance entries in this period.'));
    L.paragraph(t('Informații declarate în contul AutoCare. Documentul nu certifică efectuarea lucrărilor de către un service.','Information recorded in the AutoCare account. This report does not certify work by a service centre.'));
  }else if(type==='documents'){
    documentStatus(documents);
  }else{
    ledger(active.filter(row=>!isPlannedService(row,asOf)));
    maintenanceHistory([],planned);
  }
  return L.finish();
}
