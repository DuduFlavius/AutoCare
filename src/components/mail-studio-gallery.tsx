'use client';

import { useState } from 'react';
import { ArrowUpRight, Search, Star, Mail, SlidersHorizontal } from 'lucide-react';
import { englishEmailCopy } from '@/lib/email-copy-en';
import { emailTemplates, templateCategory, type EmailTemplate } from '@/lib/email-templates';
import { studioStyles, type StudioDesign, type StudioStyle } from '@/lib/mail-studio-templates';
import {signatureTemplateMetadata} from '@/lib/mail-signature-templates';
import {mailTopic,mailTopics} from '@/lib/mail-topics';
import { FilterSelect } from './filter-select';

type LibraryCard = {
  id: string;
  template: EmailTemplate;
  label: string;
  subject: string;
  message: string;
  ctaLabel: string;
  ctaPath: string;
  category: 'transactional'|'promotional';
  design?: StudioDesign;
  englishContent?: {subject:string;message:string;ctaLabel:string};
};

export function defaultStudioStyle(template:EmailTemplate):StudioStyle {
  const preset=signatureTemplateMetadata(template);
  if(preset) return preset.style;
  if (templateCategory(template)==='promotional' || template==='monthly_report' || template==='expense_review') return 'editorial';
  if (['verification','password_reset','account_security','support_reply','support_received','reminder','payment_failed','payment_receipt'].includes(template)) return 'compact';
  return 'signature';
}

export function EmailGallery({ entries, language, onChoose, disabled }: {
  entries: LibraryCard[]; language:'ro'|'en'; onChoose:(id:string)=>void; disabled:boolean;
}) {
  const en=language==='en';
  const t=(ro:string,english:string)=>en?english:ro;
  const [query,setQuery]=useState('');
  const [topic,setTopic]=useState('');
  const [category,setCategory]=useState('');
  const [style,setStyle]=useState('');
  const [filter,setFilter]=useState('');
  const [lang,setLang]=useState(language);
  const [page,setPage]=useState(0);
  const [marks,setMarks]=useState<{favorites:string[];recent:string[]}>(()=>{
    try {
      const saved=JSON.parse(localStorage.getItem('autocare-mail-gallery') ?? '{}');
      return {favorites:Array.isArray(saved.favorites)?saved.favorites:[],recent:Array.isArray(saved.recent)?saved.recent:[]};
    } catch { return {favorites:[],recent:[]}; }
  });
  function update(next:typeof marks) {
    setMarks(next);
    try { localStorage.setItem('autocare-mail-gallery',JSON.stringify(next)); } catch { /* Browser storage is optional. */ }
  }
  const normalize=(text:string)=>text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase();
  const featured=['welcome','release_news','reminder','premium_grant','support_reply','monthly_report'];
  function priority(id:string){const rank=featured.indexOf(id);return rank<0?featured.length:rank;}
  const ordered=filter==='recent'?[...entries].sort((a,b)=>marks.recent.indexOf(a.id)-marks.recent.indexOf(b.id)):
    [...entries].sort((a,b)=>priority(a.id)-priority(b.id));
  const filtered=ordered.filter(entry=>
    (!topic||mailTopic(entry.template)===topic) && (!category||entry.category===category) && (!style||(entry.design?.style??defaultStudioStyle(entry.template))===style) &&
    (filter==='favorites'?marks.favorites.includes(entry.id):filter==='recent'?marks.recent.includes(entry.id):true) &&
    normalize([entry.label,entry.subject,entry.template,entry.message,entry.englishContent?.subject,englishEmailCopy[entry.template]?.title,englishEmailCopy[entry.template]?.body].join(' ')).includes(normalize(query.trim()))
  );
  const totalPages=Math.max(1,Math.ceil(filtered.length/6));
  const activePage=Math.min(page,totalPages-1);
  return <section className="studio-surface studio-library">
    <header className="studio-section-heading"><div><h2>{t('Bibliotecă de șabloane','Template library')}</h2><p>{t('Alege un model și continuă redactarea.','Choose a template and continue writing.')}</p></div><span className="studio-badge">{entries.length} {t('modele','templates')}</span></header>
    <div className="studio-gallery-tools">
      <label>{t('Caută un model','Find a template')}<span className="studio-search"><Search size={16} aria-hidden="true"/><input type="search" value={query} onChange={e=>{setPage(0);setQuery(e.target.value);}} /></span></label>
      <div className="studio-gallery-collections" aria-label={t('Colecție','Collection')}>{[['','Toate','All'],['favorites','Favorite','Favourites'],['recent','Recente','Recent']].map(([id,ro,english])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>{setPage(0);setFilter(id)}}>{t(ro,english)}</button>)}</div>
    </div>
    <details className="studio-advanced"><summary><SlidersHorizontal size={15}/>{t('Filtre avansate','Advanced filters')}</summary><div className="studio-filters">
      <label>{t('Categorie','Category')}<FilterSelect value={category} onChange={e=>{setPage(0);setCategory(e.target.value);}}><option value="">{t('Toate','All')}</option><option value="transactional">{t('Tranzacțional','Transactional')}</option><option value="promotional">{t('Promoțional','Promotional')}</option></FilterSelect></label>
      <label>{t('Subiect tematic','Topic')}<FilterSelect value={topic} onChange={e=>{setPage(0);setTopic(e.target.value);}}><option value="">{t('Toate subiectele','All topics')}</option>{mailTopics.map(item=><option key={item.id} value={item.id}>{en?item.en:item.ro}</option>)}</FilterSelect></label>
      <label>{t('Stil','Style')}<FilterSelect value={style} onChange={e=>{setPage(0);setStyle(e.target.value);}}><option value="">{t('Toate','All')}</option>{studioStyles.map(value=><option key={value}>{value}</option>)}</FilterSelect></label>
      <label>{t('Limba modelului','Template language')}<FilterSelect value={lang} onChange={e=>setLang(e.target.value==='en'?'en':'ro')}><option value="ro">Română</option><option value="en">English</option></FilterSelect></label>
    </div></details>
    <p className="studio-gallery-count" role="status">{filtered.length} {t('modele disponibile','available templates')}</p>
    <div className="studio-templates">
      {filtered.slice(activePage*6,activePage*6+6).map(item=>{
        const design=item.design??{style:defaultStudioStyle(item.template)};
        const copy=lang==='en'?englishEmailCopy[item.template]:undefined;
        const base=emailTemplates[item.template];
        const subject=lang==='en'?(item.englishContent?.subject||(item.subject===base.subject?(copy?.subject??copy?.title):item.subject)):item.subject;
        const heading=subject||item.label;
        const topic=mailTopics.find(group=>group.id===mailTopic(item.template));
        return <article className="studio-template" key={item.id}>
          <div className="studio-thumbnail" data-style={design.style} aria-hidden="true">
            <div><Mail size={18}/><span>AutoCare</span></div>
            <strong>{heading}</strong>
          </div>
          <div className="studio-template-copy"><strong>{lang==='en'?(copy?.title??item.label):item.label}</strong><span>{topic?t(topic.ro,topic.en):design.style} · {item.category==='promotional'?t('Promoțional','Promotional'):t('Tranzacțional','Transactional')}</span></div>
          <div className="studio-template-actions">
            <button type="button" disabled={disabled} onClick={()=>{update({...marks,recent:[item.id,...marks.recent.filter(id=>id!==item.id)].slice(0,20)});onChoose(item.id);}}>{t('Folosește modelul','Use template')} <ArrowUpRight size={14}/></button>
            <button type="button" aria-pressed={marks.favorites.includes(item.id)} aria-label={t('Favorit','Favourite')+' · '+item.label} onClick={()=>update({...marks,favorites:marks.favorites.includes(item.id)?marks.favorites.filter(id=>id!==item.id):[...marks.favorites,item.id]})}><Star size={16} fill={marks.favorites.includes(item.id)?'currentColor':'none'}/></button>
          </div>
        </article>;
      })}
    </div>
    {!filtered.length && <p role="status">{t('Nu există modele pentru filtrele selectate.','No templates match these filters.')}</p>}
    {totalPages>1&&<footer className="studio-pagination"><button type="button" disabled={activePage===0} onClick={()=>setPage(activePage-1)}>{t('Înapoi','Previous')}</button><span>{activePage+1} / {totalPages}</span><button type="button" disabled={activePage+1===totalPages} onClick={()=>setPage(activePage+1)}>{t('Înainte','Next')}</button></footer>}
  </section>;
}
