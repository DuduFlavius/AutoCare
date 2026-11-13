/** Browser language is a fallback only; an explicit saved language/cookie takes precedence. */
export function registrationLanguage(header:string|null|undefined):'ro'|'en'{
 if(!header)return 'ro';
 const languages=header.split(',').map((part,index)=>{const [tag,...parameters]=part.trim().toLowerCase().split(';');const q=parameters.find(x=>x.trim().startsWith('q='));return {tag:tag.split('-')[0],q:q?Number(q.trim().slice(2)):1,index};}).filter(x=>Number.isFinite(x.q)&&x.q>0&&x.q<=1&&(x.tag==='ro'||x.tag==='en')).sort((a,b)=>b.q-a.q||a.index-b.index);
 return languages[0]?.tag==='ro'?'ro':'en';
}
