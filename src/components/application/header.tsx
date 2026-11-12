'use client';
import { Bell, Search, UserRound, LogOut, Star, CarFront } from 'lucide-react';
import LanguageMenu from '../language-menu';
import ReferenceArtwork from '../reference-artwork';
import { useApplicationLanguage } from '../application-locale';
export default function ApplicationHeader({
  title,
  reference=false,
  name,
  unread,
  premium,
  onSearch,
  onNotifications,
  onAccount,
  onPremium,
  onSignOut,
  signingOut,
  preview,
  onLanguage,
}: {
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
      <span className="app-topbar-brand">
        <span className="app-topbar-mark">
          {reference?<ReferenceArtwork name="gear" width={29} height={29}/>:<CarFront size={19} />}
        </span>
        <strong>AutoCare</strong>
      </span>
      <span className="app-topbar-title">
        <span>AutoCare</span>
        <span aria-hidden="true">/</span>
        <strong>{title}</strong>
      </span>
      <div className="app-topbar-actions">
        <button
          className="app-icon-button"
          onClick={onSearch}
          aria-label={en ? 'Search application' : 'Caută în aplicație'}
        >
          {reference?<ReferenceArtwork name="search" width={27} height={27}/>:<Search size={20} />}<span className="studio-search-label">{en ? 'Search vehicles, documents, services…' : 'Caută mașini, documente, servicii… (Ctrl + K)'}</span>
        </button>
        <button
          className="app-icon-button app-notification-button"
          onClick={onNotifications}
          aria-label={en ? `Notifications, ${unread} unread` : `Notificări, ${unread} necitite`}
        >
          {reference?<ReferenceArtwork name="nav-bell" width={32} height={32}/>:<Bell size={20} />}
          {unread > 0 && <span aria-hidden="true">{unread>99?'99+':unread}</span>}
        </button>
        <button className="app-header-premium" onClick={onPremium}>
          <Star size={16} />
          <span>{premium ? (en ? 'Premium active' : 'Premium activ') : 'Premium'}</span>
        </button>
        <LanguageMenu language={en?'en':'ro'} onChange={onLanguage} compact/>
        <button
          className="app-avatar-button"
          onClick={onAccount}
          aria-label={en ? 'My account' : 'Contul meu'}
          title={name}
        >
          {name.trim() ? (
            (reference?name.trim().slice(0,1):name)
              .trim()
              .split(' ')
              .map((s) => s[0])
              .slice(0, 2)
              .join('')
          ) : (
            <UserRound size={19} />
          )}
        </button>
        <button
          className="app-header-signout"
          onClick={onSignOut}
          disabled={preview || signingOut}
          aria-label={en ? 'Sign out' : 'Deconectare'}
        >
          <LogOut size={18} />
          <span>
            {signingOut
              ? en
                ? 'Signing out…'
                : 'Se deconectează…'
              : en
                ? 'Sign out'
                : 'Deconectare'}
          </span>
        </button>
      </div>
    </header>
  );
}
