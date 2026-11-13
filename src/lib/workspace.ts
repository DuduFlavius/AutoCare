export const mobileWorkspaceSections = [
  { id: 'Dashboard', ro: 'Acasă', en: 'Home' },
  { id: 'Garaj', ro: 'Garajul meu', en: 'My garage' },
  { id: 'Documente', ro: 'Documente', en: 'Documents' },
  { id: 'Cheltuieli', ro: 'Istoric', en: 'History' },
] as const;
export const workspaceSections = [
  { id: 'Cont', ro: 'Cont', en: 'Account', group: 'account', icon: 'settings' },
  { id: 'Dashboard', ro: 'Acasă', en: 'Home', group: 'overview', icon: 'home' },
  { id: 'Garaj', ro: 'Garajul meu', en: 'My garage', group: 'garage', icon: 'car' },
  { id: 'AutoCare AI', ro: 'AutoCare AI', en: 'AutoCare AI', group: 'garage', icon: 'premium' },
  { id: 'Documente', ro: 'Documente', en: 'Documents', group: 'garage', icon: 'files' },
  {
    id: 'Istoric auto',
    ro: 'Istoric auto',
    en: 'Vehicle history',
    group: 'garage',
    icon: 'history',
  },
  { id: 'Întreținere', ro: 'Întreținere', en: 'Maintenance', group: 'care', icon: 'wrench' },
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
    ro: 'Abonament',
    en: 'Subscription',
    group: 'account',
    icon: 'credit',
  },
  {
    id: 'Centru de suport',
    ro: 'Centru de suport',
    en: 'Support center',
    group: 'help',
    icon: 'support',
  },
  {id:'Rapoarte',ro:'Rapoarte',en:'Reports',group:'account',icon:'files'},
  {id:'Premium',ro:'Premium',en:'Premium',group:'account',icon:'premium'},
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
    Intervenții: 'Întreținere',
    'SmartDrive GPS': 'Plan întreținere',
    'Garajul meu': 'Garaj',
  };
  const tab = value ? aliases[value] || value : 'Dashboard';
  return workspaceSections.some((s) => s.id === tab) || tab === 'Administrare' ? tab : 'Dashboard';
}
export function workspaceHref(path: string, tab: string, vehicle?: string | null) {
  const url = new URL(path, 'https://autocare.invalid');
  const section = normalizeWorkspaceTab(tab);
  url.searchParams.set('tab', section);
  if ((section === 'Garaj' || section === 'AutoCare AI') && vehicle) url.searchParams.set('vehicle', vehicle);
  else url.searchParams.delete('vehicle');
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
