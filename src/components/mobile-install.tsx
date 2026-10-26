'use client';
import { useEffect, useState } from 'react';
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
export default function MobileInstall() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    setInstalled(standalone);
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    const onPrompt = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); setExpanded(false); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  if (installed) return null;
  return <div className="ac-mobile-install" aria-label="Instalare aplicație AutoCare">
    <button type="button" className="ac-mobile-install-trigger" onClick={async () => {
      if (prompt) { await prompt.prompt(); await prompt.userChoice; setPrompt(null); }
      else setExpanded(v => !v);
    }}>Instalează aplicația</button>
    {expanded && <div className="ac-mobile-install-help" role="status">
      <button type="button" aria-label="Închide instrucțiunile" onClick={() => setExpanded(false)}>×</button>
      <strong>AutoCare pe telefon</strong>
      <p>{ios ? 'Pe iPhone: deschide acest site în Safari, apasă Partajează și alege Adaugă pe ecranul principal. Deschide apoi AutoCare din pictogramă.' : 'Pe Samsung / Android: deschide site-ul în Chrome, apasă meniul ⋮ și alege Instalează aplicația sau Adaugă pe ecranul principal.'}</p>
      <small>Notificările se activează separat, din Setări → Notificări, după instalare.</small>
    </div>}
  </div>;
}
