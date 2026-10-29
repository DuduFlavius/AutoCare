'use client';
import {useEffect} from 'react';
import {translateApplicationCopy} from '@/lib/application-language';
import {translationSource} from '@/lib/workspace';
const textStates=new WeakMap<Text,{source:string;rendered:string}>();
const attributeStates=new WeakMap<Element,Record<string,{source:string;rendered:string}>>();
export default function SiteLanguage({language}:{language:'ro'|'en'}){
 useEffect(()=>{
  const root=document.querySelector('.app-shell')||document.body;
  const apply=(source:string)=>translateApplicationCopy(source,language);
  const translate=()=>{
   const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let node:Node|null;
   while((node=walker.nextNode())){
    const text=node as Text;const parent=text.parentElement;
    if(!parent||parent.closest('script,style,textarea,code,[contenteditable="true"],[data-workspace-ui],[data-user-content]'))continue;
    const raw=translationSource(text.nodeValue||'',textStates.get(text));
    const trimmed=raw.trim();const rendered=raw.replace(trimmed,apply(trimmed));
    textStates.set(text,{source:raw,rendered});
    if(text.nodeValue!==rendered)text.nodeValue=rendered;
   }
   root.querySelectorAll('[placeholder],[aria-label],[title],[alt],[data-label]').forEach(element=>{
    if(element.closest('[data-workspace-ui],[data-user-content]'))return;
    const states=attributeStates.get(element)||{};
    for(const key of ['placeholder','aria-label','title','alt','data-label']){
     const value=element.getAttribute(key);if(value===null)continue;
     const source=translationSource(value,states[key]);const rendered=apply(source);
     states[key]={source,rendered};if(value!==rendered)element.setAttribute(key,rendered);
    }
    attributeStates.set(element,states);
   });
  };
  translate();document.documentElement.lang=language;
  const observer=new MutationObserver(translate);observer.observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['placeholder','aria-label','title','alt','data-label']});return()=>observer.disconnect();
 },[language]);return null;
}
