'use client';
import { Bell, Search, UserRound, LogOut, Star, CarFront } from 'lucide-react';
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
  onSignOut,
  signingOut,
  preview,
}: {
  title: string;
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
}) {
  const en = useApplicationLanguage() === 'en';
  return (
    <header className="app-header app-topbar" data-workspace-ui>
      <span className="app-topbar-brand">
        <span className="app-topbar-mark">
          <CarFront size={19} />
        </span>
        <strong>AutoCare</strong>
      </span>
      <span className="app-topbar-title">
        <span>{en ? 'Your workspace' : 'Spațiul tău auto'}</span>
        <span aria-hidden="true">/</span>
        <strong>{title}</strong>
      </span>
      <div className="app-topbar-actions">
        <button
          className="app-icon-button"
          onClick={onSearch}
          aria-label={en ? 'Search application' : 'Caută în aplicație'}
        >
          <Search size={20} /><span className="studio-search-label">{en ? 'Search vehicles, documents, services…' : 'Caută mașini, documente, servicii…'}</span>
        </button>
        <button
          className="app-icon-button app-notification-button"
          onClick={onNotifications}
          aria-label={en ? `Notifications, ${unread} unread` : `Notificări, ${unread} necitite`}
        >
          <Bell size={20} />
          {unread > 0 && <span aria-hidden="true" />}
        </button>
        <button className="app-header-premium" onClick={onPremium}>
          <Star size={16} />
          <span>{premium ? (en ? 'Premium active' : 'Premium activ') : 'Premium'}</span>
        </button>
        <button
          className="app-avatar-button"
          onClick={onAccount}
          aria-label={en ? 'My account' : 'Contul meu'}
          title={name}
        >
          {name.trim() ? (
            name
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
