import { PDFDocument, rgb, type Color, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import assets from './report-assets.json';
import { reportBrandLogo } from './report-brand';

export const reportInk = rgb(.055,.15,.21);
export const reportMuted = rgb(.30,.38,.43);
export const reportAccent = rgb(.025,.39,.43);
const rule = rgb(.84,.89,.90);
const tint = rgb(.94,.97,.97);
export const reportPalette = [reportAccent,rgb(.26,.39,.63),rgb(.205,.52,.39),rgb(.59,.32,.26),rgb(.41,.34,.59),rgb(.51,.40,.20)];
const white = rgb(1,1,1);
export const A4 = { width:595.28, height:841.89, margin:42 };
const width = A4.width - A4.margin * 2;
type Labels = { title:string; subtitle:string; generated:string; period:string; edition:string; en:boolean; cover?:boolean };

export async function reportLayout(labels: Labels) {
  const document = await PDFDocument.create();
  document.registerFontkit(fontkit);
  const [regular,bold,logo] = await Promise.all([
    document.embedFont(Buffer.from(assets.regular,'base64'),{subset:true}),
    document.embedFont(Buffer.from(assets.bold,'base64'),{subset:true}),
    document.embedPng(Buffer.from(reportBrandLogo,'base64')),
  ]);
  document.setTitle('AutoCare Premium - ' + labels.title);
  document.setAuthor('AutoCare');
  document.setLanguage(labels.en?'en':'ro');
  let page:PDFPage;
  let y=0;
  const x=A4.margin;
  const safe=(value:string)=>Array.from(value.normalize('NFC')).map(char=>{
    const code=char.codePointAt(0)!;
    if(code===10 || code===13 || code===9) return char;
    return code<32 || code===127?' ':char;
  }).join('');
  const clean=(value:string)=>safe(value).replace(/[\r\n\t]/g,' ');
  const measure=(value:string,size:number,strong=false)=>(strong?bold:regular).widthOfTextAtSize(clean(value),size);
  function text(value:string, left:number, at:number, size=10, strong=false, color:Color=reportInk) {
    page.drawText(clean(value),{x:left,y:at,size,font:strong?bold:regular,color});
  }
  function wrap(value:string, max:number, size=10, font:PDFFont=regular) {
    const lines:string[]=[];
    for(const paragraph of safe(value).split(/\r?\n/)){
      let line='';
      for(const word of paragraph.trim().split(/\s+/).filter(Boolean)){
        const candidate=line?line+' '+word:word;
        if(font.widthOfTextAtSize(candidate,size)<=max){line=candidate;continue;}
        if(line)lines.push(line);
        line='';
        for(const char of word){
          if(line && font.widthOfTextAtSize(line+char,size)>max){lines.push(line);line='';}
          line+=char;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  function rectangle(left:number, bottom:number, w:number,h:number,color:Color=tint) {
    if(w>0&&h>0)page.drawRectangle({x:left,y:bottom,width:w,height:h,color});
  }
  function line(x1:number,y1:number,x2:number,y2:number,color:Color=rule,thickness=.6) {
    page.drawLine({start:{x:x1,y:y1},end:{x:x2,y:y2},color,thickness});
  }
  function newPage(first=false) {
    page=document.addPage([A4.width,A4.height]);
    page.drawImage(logo,{x,y:765,width:31,height:31});
    text('AutoCare',x+42,779,16,true);
    text(labels.edition,x+43,765,8,true,reportAccent);
    const dateLabel=(labels.en?'Generated ':'Generat la ')+labels.generated;
    text(dateLabel,x+width-measure(dateLabel,8),779,8,false,reportMuted);
    line(x,750,x+width,750);
    y=724;
    if(first && labels.cover){
      rectangle(x,565,width,158,tint);
      for(let i=0;i<6;i++){
        line(x+296+i*13,571,x+397+i*18,712,rule,1.35);
        line(x+320+i*14,571,x+469+i*5,651,rule,.8);
      }
      rectangle(x,565,4,158,reportAccent);
      y=683;
      for(const row of wrap(labels.title,width-40,32,bold)){text(row,x+21,y,32,true);y-=38;}
      for(const row of wrap(labels.subtitle,width-42,12)){text(row,x+21,y-1,12,false,reportMuted);y-=16;}
      text(labels.period,x+21,585,10,true,reportAccent);
      y=538;
    }else if(first){
      for(const row of wrap(labels.title,width,24,bold)){text(row,x,y,24,true);y-=30;}
      for(const row of wrap(labels.subtitle,width,10)){text(row,x,y+3,10,false,reportMuted);y-=14;}
      text(labels.period,x,y,8,true,reportAccent);
      y-=26;
    }else{
      text(labels.title,x,y,14,true);y-=27;
    }
  }
  function ensure(height:number){if(y-height<56)newPage();}
  function section(index:string,title:string,reserve=51){
    ensure(27+reserve);
    text(index,x,y,9,true,reportAccent);
    text(title,x+31,y,15,true);
    line(x,y-9,x+width,y-9);
    y-=27;
  }
  function paragraph(value:string,{strong=false,indent=0,color=reportMuted}:{strong?:boolean;indent?:number;color?:Color}={}) {
    for(const row of wrap(value,width-indent,10,strong?bold:regular)){
      ensure(17);text(row,x+indent,y,10,strong,color);y-=14;
    }y-=7;
  }
  function metrics(items:[string,string][]) {
    if(!items.length)return;
    const count=Math.min(3,items.length), gap=9, w=(width-(count-1)*gap)/count;
    for(let i=0;i<items.length;i+=count){
      ensure(69);
      items.slice(i,i+count).forEach(([label,value],at)=>{
        const left=x+at*(w+gap);
        rectangle(left,y-53,w,63);
        text(label,left+11,y-6,8,false,reportMuted);
        const size=Math.min(19,(w-22)/Math.max(1,measure(value,1,true)));
        text(value,left+11,y-34,size,true);
      });
      y-=73;
    }
  }
  function table(columns:{label:string;ratio:number;right?:boolean}[],rows:string[][]){
    if(!rows.length)return;
    const fontSize=9, rowHeight=13;
    const widths=columns.map(column=>width*column.ratio);
    let hasData=false;
    function head(){
      hasData=false;
      rectangle(x,y-20,width,25,reportAccent);
      let left=x;
      columns.forEach(({label,right},i)=>{
        const at=right?left+widths[i]-9-measure(label,8,true):left+9;
        text(label,at,y-11,8,true,white);left+=widths[i];
      });
      y-=25;
    }
    ensure(55);head();
    rows.forEach((row,index)=>{
      const cells=row.map((value,i)=>wrap(value,widths[i]-18,fontSize));
      const depth=Math.max(...cells.map(cell=>cell.length));
      if(hasData && y-12-depth*rowHeight<56 && depth<38){newPage();head();}
      for(let at=0;at<depth;){
        if(y<83){newPage();head();}
        const take=Math.max(1,Math.min(depth-at,Math.floor((y-68)/rowHeight)));
        const drop=take*rowHeight+10;
        if(index%2===0)rectangle(x,y-drop,width,drop,tint);
        let left=x;
        cells.forEach((value,i)=>{
          value.slice(at,at+take).forEach((chunk,j)=>{
            const pos=columns[i].right?left+widths[i]-9-measure(chunk,fontSize):left+9;
            text(chunk,pos,y-12-j*rowHeight,fontSize);
          });left+=widths[i];
        });
        line(x,y-drop,x+width,y-drop);
        y-=drop;at+=take;hasData=true;
      }
    });y-=14;
  }
  function graphic(height:number, draw:(left:number,top:number,w:number,pdf:PDFPage)=>void){
    ensure(height+8);
    draw(x,y,width,page);
    y-=height;
  }
  function finish(){
    const sheets=document.getPages();
    for(const [i,sheet] of sheets.entries()){
      page=sheet;line(x,45,x+width,45);
      text('AutoCare  ·  www.autocareapp.ro',x,29,8,false,reportMuted);
      const number=(i+1)+' / '+sheets.length;
      text(number,x+width-measure(number,8),29,8,false,reportMuted);
    }
    return document.save().then(bytes=>Buffer.from(bytes));
  }
  newPage(true);
  return { text,measure,line,rectangle,paragraph,section,metrics,table,graphic,finish };
}
export type ReportLayout = Awaited<ReturnType<typeof reportLayout>>;
