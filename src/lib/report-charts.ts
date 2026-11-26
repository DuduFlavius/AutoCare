import { reportAccent, reportInk, reportMuted, reportPalette, type ReportLayout } from './report-layout';
import { expenseDate } from './finance-selection';
import type { buildReportAnalysis } from './report-analysis';

type Analysis = ReturnType<typeof buildReportAnalysis>;

export function cumulativeGraphic(layout:ReportLayout,finance:Analysis['finance'],money:(bani:number)=>string,locale:string){
  layout.graphic(142,(left,top,width,page)=>{
    const scale=Math.max(1,finance.total), base=top-106, height=83;
    const labelWidth=Math.max(63,layout.measure(money(scale),7)+11), x1=left+labelWidth, x2=left+width-4;
    const x=(day:number)=>finance.end===finance.start?(x1+x2)/2:x1+(day-finance.start)/(finance.end-finance.start)*(x2-x1);
    const y=(val:number)=>base+val/scale*height;
    for(const level of [0,.5,1]){
      layout.line(x1,y(scale*level),x2,y(scale*level));
      layout.text(money(Math.round(finance.total*level)),left,y(scale*level)-2,7,false,reportMuted);
    }
    const relative=(day:number,val:number)=>`${Math.round((x(day)-x1)*100)/100} ${Math.round((base-y(val))*100)/100}`;
    let path='M 0 0', previous=0;
    for(const change of finance.changes){
      path+=` L ${relative(change.day,previous)} L ${relative(change.day,change.total)}`;
      previous=change.total;
    }
    path+=` L ${x2-x1} ${base-y(previous)}`;
    page.drawSvgPath(path+` L ${x2-x1} 0 Z`,{x:x1,y:base,color:reportAccent,opacity:.13});
    page.drawSvgPath(path,{x:x1,y:base,borderColor:reportAccent,borderWidth:1.55});
    const date=(day:number)=>new Intl.DateTimeFormat(locale,{day:'numeric',month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(expenseDate(day)+'T12:00:00Z'));
    layout.text(date(finance.start),x1,base-14,8,false,reportMuted);
    if(finance.end!==finance.start){
      const last=date(finance.end);
      layout.text(last,x2-layout.measure(last,8),base-14,8,false,reportMuted);
    }
  });
}

export function monthlyGraphic(layout:ReportLayout,analysis:Analysis,money:(bani:number)=>string,locale:string){
  layout.graphic(150,(left,top,width)=>{
    const rows=analysis.monthKeys.map(month=>({month,amount:analysis.months.get(month)??0}));
    const max=Math.max(1,...rows.map(row=>row.amount)),baseline=top-106;
    const gutter=Math.max(63,layout.measure(money(max),7)+11), x=left+gutter;
    for(const fraction of [0,.5,1]){
      const y=baseline+fraction*82;
      layout.line(x,y,left+width,y);
      layout.text(money(Math.round(max*fraction)),left,y-2,7,false,reportMuted);
    }
    const w=(width-gutter)/rows.length;
    rows.forEach((row,i)=>{
      const bar=Math.min(22,w*.54),middle=x+i*w+w/2;
      layout.rectangle(middle-bar/2,baseline,bar,row.amount/max*82,i===rows.length-1?reportAccent:reportPalette[1]);
      const label=new Intl.DateTimeFormat(locale,{month:'short',timeZone:'UTC'}).format(new Date(row.month+'-01T00:00:00Z'));
      layout.text(label,middle-layout.measure(label,7)/2,baseline-13,7,false,reportMuted);
      if(i===0||i===rows.length-1||row.month.endsWith('-01')){
        const year=row.month.slice(0,4);
        layout.text(year,middle-layout.measure(year,7)/2,baseline-25,7,false,reportMuted);
      }
    });
  });
}

export function categoryGraphic(layout:ReportLayout,items:{name:string;bani:number}[],total:number,money:(bani:number)=>string,locale:string,en:boolean){
  const top=items.filter(item=>item.bani>0).slice(0,5);
  const other=total-top.reduce((sum,item)=>sum+item.bani,0);
  if(other>0)top.push({name:en?'Other categories':'Alte categorii',bani:other});
  const percentage=new Intl.NumberFormat(locale,{style:'percent',maximumFractionDigits:1});
  layout.graphic(170,(left,y,width,page)=>{
    const center={x:left+68,y:y-73};
    let start=0;
    top.forEach((item,i)=>{
      const end=start+item.bani/total*Math.PI*2;
      const steps=Math.max(2,Math.ceil((end-start)*22));
      for(let step=0;step<steps;step++){
        const at=(p:number)=>({x:center.x+Math.sin(p)*49,y:center.y+Math.cos(p)*49});
        page.drawLine({start:at(start+(end-start)*step/steps),end:at(start+(end-start)*(step+1)/steps),color:reportPalette[i],thickness:14});
      }
      start=end;
      const row=y-17-i*24;
      layout.rectangle(left+143,row-1,6,6,reportPalette[i]);
      const value=money(item.bani);
      const maxName=width-170-layout.measure(value,8,true)-64;
      let name=item.name;
      while(name.length>1&&layout.measure(name,8)>maxName)name=name.slice(0,-2)+'…';
      layout.text(name,left+157,row,8);
      layout.text(value,left+width-50-layout.measure(value,8,true),row,8,true);
      const share=percentage.format(item.bani/total);
      layout.text(share,left+width-layout.measure(share,8),row,8,false,reportMuted);
      layout.rectangle(left+157,row-9,width-157,2);
      layout.rectangle(left+157,row-9,(width-157)*item.bani/total,2,reportPalette[i]);
    });
    const centerTotal=money(total);
    const size=Math.min(10,74/Math.max(1,layout.measure(centerTotal,1,true)));
    layout.text('TOTAL',center.x-layout.measure('TOTAL',8)/2,center.y+7,8,false,reportMuted);
    layout.text(centerTotal,center.x-layout.measure(centerTotal,size,true)/2,center.y-9,size,true,reportInk);
  });
}
