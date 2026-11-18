'use client';
import { Children, isValidElement, useEffect, useId, useRef, useState, type SelectHTMLAttributes, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

/** Styled select: keeps native form/change semantics, with a consistent visible listbox. */
export function FilterSelect({children, ...props}: SelectHTMLAttributes<HTMLSelectElement>) {
  const id=useId(), trigger=useRef<HTMLButtonElement>(null), native=useRef<HTMLSelectElement>(null), menu=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState({left:8,top:8,width:240,maxHeight:300});
  const [localValue,setLocalValue]=useState(String(props.defaultValue??''));
  const options=Children.toArray(children).filter(isValidElement).map(child=>(child as ReactElement<{value?:string;children?:React.ReactNode;disabled?:boolean}>).props);
  const selected=options.findIndex(option=>String(option.value??'')===String(props.value??localValue));
  const enabled=options.map((option,index)=>option.disabled?-1:index).filter(index=>index>=0);
  function close(focus=true){setOpen(false);if(focus)trigger.current?.focus();}
  function choose(index:number){
    const option=options[index];
    if(!option||option.disabled||!native.current)return;
    setLocalValue(String(option.value??''));
    native.current.value=String(option.value??'');
    native.current.dispatchEvent(new Event('change',{bubbles:true}));
    close();
  }
  function show(){setActive(selected>=0&&!options[selected].disabled?selected:enabled[0]??0);setOpen(true);}
  useEffect(()=>{
    if(!open)return;
    function place(){
      const rect=trigger.current!.getBoundingClientRect(),width=Math.min(Math.max(rect.width,240),window.innerWidth-16);
      const below=window.innerHeight-rect.bottom-12,above=rect.top-12,up=below<200&&above>below;
      const height=Math.max(80,Math.min(320,up?above:below));
      setPosition({left:Math.max(8,Math.min(rect.left,window.innerWidth-width-8)),top:up?Math.max(8,rect.top-height-6):rect.bottom+6,width,maxHeight:height});
    }
    place();
    const outside=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node)&&!trigger.current?.contains(event.target as Node))close(false);};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();close();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',key);
    window.addEventListener('resize',place);window.addEventListener('scroll',place,true);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',key);window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);};
  },[open]);
  useEffect(()=>{if(open)menu.current?.querySelector<HTMLButtonElement>(`[data-index="${active}"]`)?.focus();},[open,active]);
  function move(delta:number){const current=enabled.indexOf(active);setActive(enabled[(current+delta+enabled.length)%enabled.length]??0);}
  return <span className="ac-filter-select">
    <select {...props} ref={native} hidden aria-hidden="true" tabIndex={-1} onInvalid={event=>{event.preventDefault();props.onInvalid?.(event);trigger.current?.focus();show();}}>{children}</select>
    <button ref={trigger} type="button" className="ac-filter-select-trigger" disabled={props.disabled} role="combobox" aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby']} aria-expanded={open} aria-haspopup="listbox" aria-controls={open?id:undefined} onClick={()=>open?close():show()} onKeyDown={event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();show();}}}><span>{options[selected]?.children??options[0]?.children}</span><ChevronDown size={17}/></button>
    {open&&createPortal(<div id={id} className="ac-filter-select-menu" ref={menu} role="listbox" aria-label={props['aria-label']} style={position} onKeyDown={event=>{
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();move(event.key==='ArrowDown'?1:-1);}
      else if(event.key==='Home'||event.key==='End'){event.preventDefault();setActive(event.key==='Home'?enabled[0]:enabled[enabled.length-1]);}
      else if(event.key==='Tab')close();
      else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&event.key!==' '){const next=[...enabled.filter(i=>i>active),...enabled.filter(i=>i<=active)].find(i=>String(options[i].children).toLocaleLowerCase().startsWith(event.key.toLocaleLowerCase()));if(next!==undefined){event.preventDefault();setActive(next);}}
    }}>{options.map((option,index)=><button type="button" key={String(option.value??index)} role="option" aria-selected={index===selected} disabled={option.disabled} data-index={index} tabIndex={index===active?0:-1} onFocus={()=>setActive(index)} onClick={()=>choose(index)}><span>{option.children}</span>{index===selected&&<Check size={17}/>}</button>)}</div>,document.body)}
  </span>;
}
