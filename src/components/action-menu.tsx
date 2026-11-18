'use client';
import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {createPortal} from 'react-dom';
import {MoreHorizontal,X} from 'lucide-react';
import {useApplicationLanguage} from './application-locale';
export function ActionMenu({label,children,disabled=false}:{label:string;children:ReactNode;disabled?:boolean}){
 const en=useApplicationLanguage()==='en',id=useId(),trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 const [mounted,setMounted]=useState(false),[open,setOpen]=useState(false),[position,setPosition]=useState({top:8,left:8,width:300,maxHeight:400});
 useEffect(()=>setMounted(true),[]);
 function close(focus=true){setOpen(false);if(focus)trigger.current?.focus();}
 useEffect(()=>{
  if(!open)return;
  function place(){const r=trigger.current!.getBoundingClientRect(),height=window.visualViewport?.height??window.innerHeight,width=Math.min(320,window.innerWidth-24),desired=Math.min(panel.current?.scrollHeight??400,440),below=height-r.bottom-12,above=r.top-12,up=below<Math.min(desired,240)&&above>below,maxHeight=Math.max(100,Math.min(440,up?above:below));setPosition({left:Math.max(12,Math.min(r.right-width,window.innerWidth-width-12)),top:up?Math.max(12,r.top-Math.min(desired,maxHeight)-8):r.bottom+8,width,maxHeight});}
  place();const frame=requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus());
  const outside=(event:PointerEvent)=>{if(!panel.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close(false);};
  const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
  return()=>{cancelAnimationFrame(frame);document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
 },[open]);
 return <><button type="button" className="ac-action-trigger" ref={trigger} disabled={disabled} aria-label={label} aria-haspopup="dialog" aria-expanded={open} aria-controls={open?id:undefined} onClick={()=>open?close():setOpen(true)}><MoreHorizontal size={21}/></button>{mounted&&createPortal(<div ref={panel} id={id} className="ac-action-popover" hidden={!open} role="dialog" aria-label={label} style={position} onKeyDown={event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const nodes=Array.from(panel.current!.querySelectorAll<HTMLElement>('button:not(:disabled),a[href]')),current=nodes.indexOf(document.activeElement as HTMLElement),next=event.key==='Home'?0:event.key==='End'?nodes.length-1:(current+(event.key==='ArrowDown'?1:-1)+nodes.length)%nodes.length;nodes[next]?.focus();}if(event.key==='Tab'){event.preventDefault();close();}}} onClick={event=>{if((event.target as HTMLElement).closest('button,a'))close();}}><header><strong>{en?'Actions':'Acțiuni'}</strong><button type="button" className="ac-action-close" onClick={()=>close()} aria-label={en?'Close actions':'Închide acțiunile'}><X size={18}/></button></header><div className="ac-action-options">{children}</div></div>,document.body)}</>;
}
