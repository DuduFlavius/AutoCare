'use client';

import { useState } from 'react';
import { ArrowUpRight, BookOpen, Headphones, LifeBuoy, MessageCircle, MessageSquarePlus, Search } from 'lucide-react';
import { useApplicationLanguage } from '../application-locale';
import SupportChat, { type Availability } from '../support-chat';
import './reference-support.css';
import './signature-support.css';

const articles = [
  ['Documente', 'Documents', 'Cum adaug un document?', 'How do I add a document?', 'Deschide Documente, selectează mașina și alege Adaugă document. Poți păstra PDF-ul sau fotografia originală.', 'Open Documents, select your vehicle and choose Add document. You can keep the original PDF or photo.'],
  ['Garaj', 'Garage', 'Unde îmi editez vehiculul?', 'Where do I edit my vehicle?', 'Deschide Garaj și alege Editează pe vehiculul dorit.', 'Open Garage and choose Edit on the vehicle you want to update.'],
  ['Rapoarte', 'Reports', 'Unde sunt rapoartele?', 'Where are my reports?', 'În Rapoarte selectezi perioada și vehiculul. Exporturile PDF și CSV sunt disponibile cu Premium.', 'In Reports, select a period and vehicle. PDF and CSV exports are available with Premium.'],
  ['Notificări', 'Notifications', 'Cum aleg ce notificări primesc?', 'How do I choose my notifications?', 'Deschide Setări → Notificări și email și activează canalele și mementourile de care ai nevoie.', 'Open Settings → Notifications & email and select the channels and reminders you need.'],
];

export function RacingSupport({ role, accountId, preview, onFeedback }: { role: string; accountId?: string; preview: boolean; onFeedback: () => void }) {
  const language = useApplicationLanguage();
  const en = language === 'en';
  const t = (ro: string, english: string) => en ? english : ro;
  const [tab, setTab] = useState<'chat' | 'requests' | 'faq'>('chat');
  const [query, setQuery] = useState('');
  const [newRequest, setNewRequest] = useState(0);
  const [availability, setAvailability] = useState<Availability>();
  const staff = ['assistant', 'admin', 'founder', 'superadmin'].includes(role);
  const states = {
    available: t('Disponibilă', 'Available'), busy: t('Ocupată', 'Busy'), offline: t('Indisponibilă', 'Offline'),
    break: t('În pauză', 'On a break'), after_hours: t('În afara programului', 'Outside support hours'),
    maintenance: t('Mentenanță', 'Maintenance'),
  };
  const visibleArticles = articles.filter(article => article.join(' ').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));

  return <section className="ac-support-page ac-reference-support sc-signature">
    <header className="sc-hero" data-staff={staff}>
      <div>
        <div className="sc-brand"><Headphones size={18} aria-hidden="true" /> AutoCare Support</div>
        <h2>{staff?t('Inbox de suport','Support inbox'):t('Suntem aici pentru tine.', 'We’re here for you.')}</h2>
        <p>{staff?t('Preia solicitările și răspunde din conversație.','Pick up requests and reply from the conversation.'):t('Scrie echipei AutoCare pentru întrebări despre cont, vehicule sau aplicație.','Contact the AutoCare team for help with your account, vehicles or app.')}</p>
      </div>
      {!staff && <div className="sc-availability" role="status">
        <strong><span data-state={availability?.state} />{availability ? states[availability.state] : t('Disponibilitate în curs de verificare', 'Checking team availability')}</strong>
        {availability && <p>{availability.message[language]}</p>}
      </div>}
      {staff && role === 'founder' && <a href="/admin?support=inbox" className="sc-studio-link">{t('Deschide Panoul Fondator', 'Open Founder Studio')} <ArrowUpRight size={16} /></a>}
    </header>
    <nav className="sc-navigation" aria-label={t('Secțiuni suport', 'Support sections')}>
      <button type="button" aria-pressed={tab === 'chat'} onClick={() => {setTab('chat');if(!staff)setNewRequest(value=>value+1);}}><MessageSquarePlus size={17} />{staff ? t('Inbox echipă', 'Team inbox') : t('Trimite o solicitare', 'Send a request')}</button>
      {!staff && <button type="button" aria-pressed={tab === 'requests'} onClick={() => setTab('requests')}><MessageCircle size={17} />{t('Conversațiile mele', 'My conversations')}</button>}
      <button type="button" aria-pressed={tab === 'faq'} onClick={() => setTab('faq')}><BookOpen size={17} />{t('Centrul de ajutor', 'Help center')}</button>
      <button type="button" onClick={onFeedback}><LifeBuoy size={17} />{t('Raportează o problemă sau trimite o idee', 'Report an issue or share an idea')}</button>
    </nav>
    <div hidden={tab === 'faq'} className="ac-support-conversation">
      <SupportChat key={accountId} accountId={accountId} role={role} preview={preview} onFeedback={onFeedback}
        newRequest={newRequest} historyView={tab === 'requests'} onAvailability={setAvailability} onOpenConversation={() => setTab('chat')} />
    </div>
    {tab === 'faq' && <div className="sc-help">
      <label><Search size={19} aria-hidden="true" /><span className="sr-only">{t('Caută în centrul de ajutor', 'Search the help center')}</span>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Caută un răspuns…', 'Search for an answer…')} />
      </label>
      {visibleArticles.map(([roGroup, enGroup, question, enQuestion, answer, enAnswer]) => <details key={roGroup}>
        <summary><small>{t(roGroup, enGroup)}</small>{t(question, enQuestion)}</summary>
        <p>{t(answer, enAnswer)}</p>
      </details>)}
      {!visibleArticles.length && <p role="status">{t('Niciun articol găsit.', 'No matching articles.')}</p>}
    </div>}
  </section>;
}
