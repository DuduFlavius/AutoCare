'use client';

import { Bold, Italic } from 'lucide-react';
import { useRef } from 'react';

export default function MailRichText({value,onChange,onFormat,enabled,disabled,label,formatLabel}:{
  value:string;onChange:(value:string)=>void;onFormat:()=>void;enabled:boolean;disabled:boolean;label:string;formatLabel:string;
}) {
  const textarea=useRef<HTMLTextAreaElement>(null);
  function wrap(mark:string){
    const input=textarea.current;
    if(!input)return;
    const start=input.selectionStart, end=input.selectionEnd;
    if(start===end || value.length+mark.length*2>8000)return;
    onChange(value.slice(0,start)+mark+value.slice(start,end)+mark+value.slice(end));
    if(!enabled)onFormat();
    requestAnimationFrame(()=>{input.focus();input.setSelectionRange(start+mark.length,end+mark.length);});
  }
  return <div className="studio-rich">
    <div className="studio-rich-toolbar" role="group" aria-label={formatLabel}>
      <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>wrap('**')} aria-label="Bold" title="Bold"><Bold size={16}/></button>
      <button type="button" disabled={disabled} onMouseDown={e=>e.preventDefault()} onClick={()=>wrap('_')} aria-label="Italic" title="Italic"><Italic size={16}/></button>
      <button type="button" disabled={disabled} aria-pressed={enabled} onClick={onFormat}>{formatLabel}</button>
    </div>
    <textarea ref={textarea} aria-label={label} rows={7} maxLength={8000} value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}/>
  </div>;
}
