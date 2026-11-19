'use client';
import { Bell, Search, Star, Menu } from 'lucide-react';
import LanguageMenu from '../language-menu';
import { useApplicationLanguage } from '../application-locale';
export default function ApplicationHeader({
  title,
  name,
  unread,
  premium,
  onSearch,
  onNotifications,
  onAccount,
  onPremium,
  onLanguage,
  onMenu,
}: {
  onMenu: () => void;
  title: string;
  reference?:boolean;
  name: string;
  unread: number;
  premium: boolean;
  onSearch: () => void;
  onNotifications: () => void;
  onAccount: () => void;
  onPremium: () => void;
  onSignOut: () => void;
  signingOut: boolean;
  preview: boolean;
  onLanguage: (language: 'ro' | 'en') => void;
}) {
  const en = useApplicationLanguage() === 'en';
  return (
    <header className="app-header app-topbar" data-workspace-ui>
      <div className="rg-m-header"><div><button className="rg-menu-open" onClick={onMenu} aria-label={en?'Open menu':'Deschide meniul'}><Menu size={21}/></button>{title===(en?'Home':'Acasă')&&<span className="rg-m-brand">AutoCare <b>Premium</b></span>}{title===(en?'Home':'Acasă')?<><span>{en?'Welcome,':'Bun venit,'}</span><strong data-user-content>{name.trim().split(/\s+/)[0]} <span aria-hidden="true">👋</span></strong></>:<h1>{title===(en?'Account':'Cont')?(en?'Settings':'Setări'):title===(en?'Expenses':'Cheltuieli')?(en?'Expense history':'Istoric cheltuieli'):title}</h1>}</div><div><LanguageMenu plain language={en?'en':'ro'} onChange={onLanguage} compact/><button onClick={onNotifications} aria-label={en?'Notifications':'Notificări'}><Bell size={23}/>{unread>0&&<small>{unread>99?'99+':unread}</small>}</button><button className="rg-m-avatar" onClick={onAccount} aria-label={en?'Account and settings':'Cont și setări'}>{name.trim().split(/\s+/).map(value=>value[0]).slice(0,2).join('')}</button></div></div>
      <div className="rg-desktop-header"><button className="rg-header-search" onClick={onSearch}><Search size={20}/><span>{en?'Search the application… (Ctrl + K)':'Caută în aplicație… (Ctrl + K)'}</span></button><span className="rg-header-breadcrumb">{title}</span><div className="rg-header-controls"><button className="rg-header-notification" onClick={onNotifications} aria-label={en?`Notifications, ${unread} unread`:`Notificări, ${unread} necitite`}><Bell size={21}/>{unread>0&&<small>{unread>99?'99+':unread}</small>}</button><button className="rg-header-premium" onClick={onPremium}><Star size={15}/>{premium?(en?'Premium active':'Premium activ'):'Premium'}</button><LanguageMenu plain language={en?'en':'ro'} onChange={onLanguage} compact/><button className="rg-header-avatar" onClick={onAccount} aria-label={en?'My account':'Contul meu'} title={name}>{name.trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('')}</button></div></div>
    </header>
  );
}
