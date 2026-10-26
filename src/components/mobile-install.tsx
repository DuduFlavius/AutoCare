'use client';
import { useEffect, useState } from 'react';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform?: string }>;
};
type Platform = 'ios' | 'android' | 'desktop';

export default function MobileInstall() {
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
          setMessage('Instalarea a fost acceptată. Verifică pictograma AutoCare pe ecranul principal.');
          setExpanded(true);
        } else {
          setMessage('Instalarea a fost anulată. Poți încerca din nou din meniul browserului.');
          setExpanded(true);
        }
      } catch {
        setMessage('Browserul nu a putut deschide instalarea automată. Urmează pașii de mai jos.');
        setExpanded(true);
      }
      return;
    }
    setExpanded((current) => !current);
  }

  if (installed) return null;

  const instructions = platform === 'ios'
    ? 'Pe iPhone: deschide AutoCare în Safari, apasă Partajează (pătratul cu săgeată) și alege „Adaugă pe ecranul principal”, apoi „Adaugă”. iOS nu permite site-ului să declanșeze direct instalarea.'
    : platform === 'android'
      ? 'Pe Samsung: deschide AutoCare în Chrome sau Samsung Internet, apasă meniul browserului (⋮ sau ☰), apoi „Instalează aplicația” / „Adaugă pe ecranul principal”. Confirmă instalarea.'
      : 'Pe calculator: în Chrome sau Edge, caută „Instalează aplicația” în bara de adrese sau în meniul browserului. Dacă opțiunea lipsește, browserul nu oferă momentan instalarea automată.';

  return (
    <div className="ac-mobile-install" aria-label="Instalare aplicație AutoCare">
      <button type="button" className="ac-mobile-install-trigger" onClick={() => void install()}
        aria-expanded={expanded} aria-controls="ac-install-instructions">
        Instalează aplicația
      </button>
      {expanded && (
        <div className="ac-mobile-install-help" id="ac-install-instructions" role="status">
          <button type="button" aria-label="Închide instrucțiunile" onClick={() => setExpanded(false)}>×</button>
          <strong>Instalează AutoCare</strong>
          {message && <p>{message}</p>}
          <p>{instructions}</p>
          <small>După instalare, deschide AutoCare din pictograma de pe telefon. Notificările se activează separat din Setări.</small>
        </div>
      )}
    </div>
  );
}
