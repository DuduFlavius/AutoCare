'use client';
import { Star, CreditCard, Bell, Settings, HelpCircle, LogOut, ChevronRight, Gauge, Wallet, CalendarDays, History, Route, Shield } from 'lucide-react';
import { useApplicationLanguage } from '../application-locale';
import MobileInstall from '../mobile-install';
import { AppSection, AppStatus } from './ui';
import type { dashboard } from '@/lib/service';
type Data = Awaited<ReturnType<typeof dashboard>>;
export default function AccountHub({ data, name, navigate, onSettings, onSignOut, signingOut, preview }: { data: Data; name: string; navigate: (tab: string) => void; onSettings: (panel: string) => void; onSignOut: () => void; signingOut: boolean; preview: boolean }) {
  const language = useApplicationLanguage(), en = language === 'en';
  const links = [
    {title: en ? 'My garage tools' : 'Instrumentele garajului', rows: [
      ['Kilometraj','Kilometraj și istoric','Mileage & readings',Gauge],['Cheltuieli','Cheltuieli','Expenses',Wallet],['Calendar','Calendar','Calendar',CalendarDays],['Istoric auto','Istoric complet','Vehicle history',History],['Plan întreținere','SmartDrive GPS','SmartDrive GPS',Route],
    ]},
    {title: en ? 'Membership' : 'Abonament și beneficii', rows: [['Premium','Instrumente Premium','Premium tools',Star],['Abonament','Gestionează abonamentul','Manage subscription',CreditCard]]},
    {title: en ? 'Preferences & help' : 'Preferințe și ajutor', rows: [['Notificări','Centrul de notificări','Notifications',Bell],['Setări','Profil, limbă și setări','Profile, language & settings',Settings],['Centru de suport','Ajutor și suport','Help & support',HelpCircle]]},
  ] as const;
  return <div className="app-account" data-workspace-ui><h1 id="workspace-page-title" tabIndex={-1}>{en ? 'My account' : 'Contul meu'}</h1><section className="app-account-identity"><span className="app-profile-avatar">{name.trim().split(' ').map(s=>s[0]).slice(0,2).join('')}</span><div><h2 data-user-content>{name}</h2><AppStatus state={data.premium ? 'valid' : 'unscheduled'}>{data.premium ? 'AutoCare Premium' : (en ? 'Free account' : 'Cont gratuit')}</AppStatus></div><button className="app-text-action" onClick={() => onSettings('account')}>{en ? 'Edit' : 'Editează'}<ChevronRight size={16}/></button></section>
    <div className="ac-account-hub-grid">{links.map(group => <AppSection key={group.title} title={group.title}><div className="app-account-links">{group.rows.map(([tab,ro,english,Icon]) => <button key={tab} className="app-record-row" onClick={() => navigate(tab)}><span className="app-icon"><Icon size={20}/></span><span><strong>{en ? english : ro}</strong>{tab === 'Abonament' && <small>{en ? 'Validity, renewals and billing' : 'Valabilitate, prelungiri și facturare'}</small>}</span><ChevronRight size={17}/></button>)}</div></AppSection>)}</div>
    <AppSection title={en ? 'On this device' : 'Pe acest dispozitiv'}><p className="app-caption">{en ? 'Install AutoCare for faster access. Your account is shared across devices. An internet connection is required to save changes.' : 'Instalează AutoCare pentru acces rapid. Contul se sincronizează pe dispozitive. Salvarea modificărilor necesită internet.'}</p><MobileInstall/><button className="app-text-action" onClick={() => onSettings('alerts')}>{en ? 'Notification preferences' : 'Preferințe notificări'}<ChevronRight size={16}/></button></AppSection>
    {['founder', 'superadmin', 'admin', 'assistant'].includes(data.profile.role) && <a className="app-founder-link" href="/admin"><Shield size={18}/>{data.profile.role === 'founder' ? (en ? 'Founder panel' : 'Panou Fondator') : 'Mail Center'}<ChevronRight size={16}/></a>}
    {data.profile.role === 'admin' && <button onClick={() => navigate('Administrare')}><Shield size={18}/>{en ? 'Administration' : 'Administrare'}</button>}
    <button className="app-account-signout" onClick={onSignOut} disabled={signingOut || preview}><LogOut size={19}/>{signingOut ? (en ? 'Signing out…' : 'Se deconectează…') : (en ? 'Sign out' : 'Deconectare')}</button><p className="app-account-footnote">AutoCare · {en ? 'Your digital garage' : 'Garajul tău digital'}</p>
  </div>;
}
