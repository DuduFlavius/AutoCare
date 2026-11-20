'use client';
import { House, UserRound, CarFront, Plus, ChartNoAxesCombined } from 'lucide-react';
import { useApplicationLanguage } from '../application-locale';
import { mobileWorkspaceSections, workspaceHref } from '@/lib/workspace';
const icons = [House, CarFront, Plus, ChartNoAxesCombined, UserRound];
export default function MobileNavigation({ tab, navigate, path, onAdd }: { tab: string; navigate: (tab: string) => Promise<boolean>; path: string; onAdd: () => void }) {
  const language = useApplicationLanguage();
  return <nav className="rg-mobile-dock" aria-label={language === 'en' ? 'Main navigation' : 'Navigare principală'} data-workspace-ui>{mobileWorkspaceSections.map((section,index) => {
    const Icon = icons[index], isAdd = section.id === 'Acțiuni', active = !isAdd && (section.id === tab || (section.id === 'Cont' && tab === 'Setări'));
    return <a key={section.id} href={isAdd ? workspaceHref(path,'Garaj') : workspaceHref(path,section.id)} aria-label={section[language]} title={section[language]} aria-current={active ? 'page' : undefined} className={isAdd ? 'rg-dock-add' : active ? 'active' : ''} onClick={e => { if(e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return; e.preventDefault();if(isAdd)onAdd();else navigate(section.id); }}><Icon size={21}/><span>{section[language]}</span></a>;
  })}</nav>;
}
