'use client';
import { House, CarFront, Wrench, Files, CircleUserRound, Route } from 'lucide-react';
import { useApplicationLanguage } from '../application-locale';
import { mobileWorkspaceSections, workspaceHref } from '@/lib/workspace';
const icons = [House, CarFront, Wrench, Files, Route, CircleUserRound];
export default function MobileNavigation({ tab, navigate, path }: { tab: string; navigate: (tab: string) => boolean; path: string }) {
  const language = useApplicationLanguage();
  return <nav className="autocare-mobile-dock app-bottom-nav" aria-label={language === 'en' ? 'Main navigation' : 'Navigare principală'} data-workspace-ui>{mobileWorkspaceSections.map((section,index) => {
    const Icon = icons[index], active = section.id === tab || (section.id === 'Cont' && !mobileWorkspaceSections.some(s => s.id === tab));
    return <a key={section.id} href={workspaceHref(path,section.id)} aria-current={active ? 'page' : undefined} className={active ? 'active' : ''} onClick={e => { if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return; e.preventDefault();navigate(section.id); }}><Icon size={21}/><span>{section[language]}</span></a>;
  })}</nav>;
}
