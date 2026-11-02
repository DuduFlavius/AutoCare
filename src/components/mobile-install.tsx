'use client';
import { useEffect, useState } from 'react';
import { useApplicationLanguage } from './application-locale';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};
type Platform = 'ios' | 'android' | 'desktop';

export default function MobileInstall() {
  const en = useApplicationLanguage() === 'en';
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [platform, setPlatform] = useState<Platform>('desktop');
  const [installed, setInstalled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const android = /Android/i.test(navigator.userAgent);
    setPlatform(ios ? 'ios' : android ? 'android' : 'desktop');
    const displayMode = window.matchMedia('(display-mode: standalone)');
    const updateInstalled = () => setInstalled(displayMode.matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
    updateInstalled();
    displayMode.addEventListener?.('change', updateInstalled);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setInstallPrompt(null);
      setExpanded(false);
      setMessage('');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      displayMode.removeEventListener?.('change', updateInstalled);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function install() {
    setMessage('');
    if (installPrompt) {
      try {
        await installPrompt.prompt();
        const choice = await installPrompt.userChoice;
        setInstallPrompt(null);
        if (choice.outcome === 'accepted') {
          setMessage(en ? 'Installation accepted. Look for AutoCare on your home screen.' : 'Instalarea a fost acceptată. Verifică pictograma AutoCare pe ecranul principal.');
          setExpanded(true);
        } else {
          setMessage(en ? 'Installation dismissed. You can try again from the browser menu.' : 'Instalarea a fost anulată. Poți încerca din nou din meniul browserului.');
          setExpanded(true);
        }
      } catch {
        setMessage(en ? 'Automatic installation is unavailable. Follow the instructions below.' : 'Browserul nu a putut deschide instalarea automată. Urmează pașii de mai jos.');
        setExpanded(true);
      }
      return;
    }
    setExpanded((current) => !current);
  }

  if (installed) return null;

  const instructions = en ? (platform === 'ios' ? 'On iPhone or iPad, open AutoCare in Safari. Tap Share, then Add to Home Screen and Add. Installation must be started from the browser menu.' : platform === 'android' ? 'On Android, open AutoCare in Chrome or Samsung Internet. Open the browser menu and choose Install app or Add to Home screen, then confirm.' : 'On a computer, use Chrome or Edge and choose Install app in the address bar or browser menu. Availability depends on your browser.') : platform === 'ios'
    ? 'Pe iPhone: deschide AutoCare în Safari, apasă Partajează (pătratul cu săgeată) și alege „Adaugă pe ecranul principal”, apoi „Adaugă”. iOS nu permite site-ului să declanșeze direct instalarea.'
    : platform === 'android'
      ? 'Pe Samsung: deschide AutoCare în Chrome sau Samsung Internet, apasă meniul browserului (⋮ sau ☰), apoi „Instalează aplicația” / „Adaugă pe ecranul principal”. Confirmă instalarea.'
      : 'Pe calculator: în Chrome sau Edge, caută „Instalează aplicația” în bara de adrese sau în meniul browserului. Dacă opțiunea lipsește, browserul nu oferă momentan instalarea automată.';

  return (
    <div className="ac-mobile-install" aria-label={en ? 'Install AutoCare' : 'Instalare aplicație AutoCare'} data-workspace-ui={en || undefined}>
      <button type="button" className="ac-mobile-install-trigger" onClick={() => void install()}
        aria-expanded={expanded} aria-controls="ac-install-instructions">
        {en ? 'Install app' : 'Instalează aplicația'}
      </button>
      {expanded && (
        <div className="ac-mobile-install-help" id="ac-install-instructions" role="status">
          <button type="button" aria-label={en ? 'Close instructions' : 'Închide instrucțiunile'} onClick={() => setExpanded(false)}>×</button>
          <strong>{en ? 'Install AutoCare' : 'Instalează AutoCare'}</strong>
          {message && <p>{message}</p>}
          <p>{instructions}</p>
          <small>{en ? 'Open AutoCare from your home screen after installation. Enable notifications separately in Settings.' : 'După instalare, deschide AutoCare din pictograma de pe telefon. Notificările se activează separat din Setări.'}</small>
        </div>
      )}
    </div>
  );
}
