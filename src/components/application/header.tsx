'use client';
import { Bell, Search, Star, Menu,CarFront } from 'lucide-react';
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
    <header className="rg-app-header app-header app-topbar" data-workspace-ui>
      <div className="rg-m-header"><div className="rg-mobile-title">{title===(en?'Home':'Acasă')?<span className="rg-m-brand"><CarFront size={28} strokeWidth={1.3}/><span>Auto<span>Care</span><b>Premium</b></span></span>:<h1 title={title}>{title===(en?'Account':'Cont')?(en?'Settings':'Setări'):title===(en?'Expenses':'Cheltuieli')?(en?'Expenses':'Cheltuieli'):title}</h1>}</div><div className="rg-mobile-controls"><LanguageMenu plain language={en?'en':'ro'} onChange={onLanguage} compact/><button onClick={onNotifications} aria-label={en?'Notifications':'Notificări'}><Bell size={20}/>{unread>0&&<small>{unread>99?'99+':unread}</small>}</button><button className="rg-m-avatar" onClick={onAccount} aria-label={en?'Account and settings':'Cont și setări'}>{name.trim().split(/\s+/).map(value=>value[0]).slice(0,2).join('')}</button><button className="rg-menu-open" onClick={onMenu} aria-label={en?'Open menu':'Deschide meniul'}><Menu size={20}/></button></div></div>
      <div className="rg-desktop-header"><button className="rg-header-search" onClick={onSearch}><Search size={20}/><span>{en?'Search the application… (Ctrl + K)':'Caută în aplicație… (Ctrl + K)'}</span></button><span className="rg-header-breadcrumb">{title}</span><div className="rg-header-controls"><button className="rg-header-notification" onClick={onNotifications} aria-label={en?`Notifications, ${unread} unread`:`Notificări, ${unread} necitite`}><Bell size={21}/>{unread>0&&<small>{unread>99?'99+':unread}</small>}</button><button className="rg-header-premium" onClick={onPremium}><Star size={15}/>{premium?(en?'Premium active':'Premium activ'):'Premium'}</button><LanguageMenu plain language={en?'en':'ro'} onChange={onLanguage} compact/><button className="rg-header-avatar" onClick={onAccount} aria-label={en?'My account':'Contul meu'} title={name}>{name.trim().split(/\s+/).map(s=>s[0]).slice(0,2).join('')}</button></div></div>
    </header>
  );
}
