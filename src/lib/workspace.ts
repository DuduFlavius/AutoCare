export const workspaceSections = [
  { id: 'Dashboard', ro: 'Prezentare generală', en: 'Overview', group: 'overview', icon: 'home' },
  { id: 'Garaj', ro: 'Mașinile mele', en: 'My vehicles', group: 'garage', icon: 'car' },
  { id: 'Documente', ro: 'Documente', en: 'Documents', group: 'garage', icon: 'files' },
  {
    id: 'Istoric auto',
    ro: 'Istoric auto',
    en: 'Vehicle history',
    group: 'garage',
    icon: 'history',
  },
  { id: 'Întreținere', ro: 'Intervenții', en: 'Maintenance', group: 'care', icon: 'wrench' },
  { id: 'Calendar', ro: 'Calendar', en: 'Calendar', group: 'care', icon: 'calendar' },
  {
    id: 'Plan întreținere',
    ro: 'SmartDrive GPS',
    en: 'SmartDrive GPS',
    group: 'care',
    icon: 'route',
  },
  { id: 'Kilometraj', ro: 'Kilometraj', en: 'Mileage', group: 'care', icon: 'gauge' },
  { id: 'Cheltuieli', ro: 'Cheltuieli', en: 'Expenses', group: 'account', icon: 'wallet' },
  { id: 'Notificări', ro: 'Notificări', en: 'Notifications', group: 'account', icon: 'bell' },
  {
    id: 'Abonament',
    ro: 'Premium și facturare',
    en: 'Premium & billing',
    group: 'account',
    icon: 'premium',
  },
  {
    id: 'Centru de suport',
    ro: 'Centru de suport',
    en: 'Support center',
    group: 'help',
    icon: 'support',
  },
  { id: 'Setări', ro: 'Setări', en: 'Settings', group: 'help', icon: 'settings' },
] as const;
export const workspaceGroups = [
  { id: 'overview', ro: 'SPAȚIUL MEU', en: 'MY WORKSPACE' },
  { id: 'garage', ro: 'GARAJ', en: 'GARAGE' },
  { id: 'care', ro: 'ÎNTREȚINERE ȘI TRASEE', en: 'CARE & TRIPS' },
  { id: 'account', ro: 'CONTROL ȘI COSTURI', en: 'CONTROL & COSTS' },
  { id: 'help', ro: 'CONT ȘI AJUTOR', en: 'ACCOUNT & HELP' },
] as const;
export function normalizeWorkspaceTab(value: string | null | undefined) {
  const aliases: Record<string, string> = {
    Acasă: 'Dashboard',
    Premium: 'Abonament',
    Intervenții: 'Întreținere',
    'SmartDrive GPS': 'Plan întreținere',
    'Garajul meu': 'Garaj',
  };
  const tab = value ? aliases[value] || value : 'Dashboard';
  return workspaceSections.some((s) => s.id === tab) || tab === 'Administrare' ? tab : 'Dashboard';
}
export function workspaceHref(path: string, tab: string) {
  const url = new URL(path, 'https://autocare.invalid');
  url.searchParams.set('tab', normalizeWorkspaceTab(tab));
  return url.pathname + url.search + url.hash;
}
export const normalizeWorkspaceSearch = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('ro')
    .trim();

export function translationSource(current:string,previous:{source:string;rendered:string}|undefined){
  return previous && previous.rendered===current ? previous.source : current;
}
