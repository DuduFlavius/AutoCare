'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallPage() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [samsungBrowser, setSamsungBrowser] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const ua = navigator.userAgent;
    setSamsungBrowser(/SamsungBrowser/i.test(ua));
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone)));
    const handler = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt); };
    const onInstalled = () => { setInstalled(true); setPrompt(null); };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', handler); window.removeEventListener('appinstalled', onInstalled); };
  }, []);
  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === 'accepted') setMessage('Instalarea a fost acceptată. Caută AutoCare pe ecranul principal.');
    setPrompt(null);
  }
  return <main className="ac-shared-folder ac-install-guide">
    <Link href="/cont">← Înapoi la AutoCare</Link>
    <header className="ac-editorial-hero">
      <img src="/icon-192.png" alt="AutoCare" width={64} height={64} />
      <p className="eyebrow">AUTOCARE · MOBIL</p>
      <h1>AutoCare pe telefonul tău</h1>
      <p>Adaugă aplicația web pe ecranul principal. Mașinile și documentele rămân în același cont.</p>
      {installed ? <p role="status">AutoCare este deja deschisă ca aplicație instalată.</p> :
        prompt && !samsungBrowser ? <button className="primary" type="button" onClick={install}>Instalează AutoCare gratuit</button> : null}
      {samsungBrowser && !installed && <p role="status">Pentru instalare pe Android, deschide această pagină în Google Chrome și alege «Adaugă pe ecranul principal».</p>}
      {message && <p role="status">{message}</p>}
    </header>
    <div className="ac-editorial-sections">
      <section>
        <h2>Android</h2>
        <p>Deschide AutoCare în Chrome. Din meniul ⋮, alege <strong>Instalează aplicația</strong> sau <strong>Adaugă pe ecranul principal</strong> și confirmă.</p>
      </section>
      <section>
        <h2>iPhone</h2>
        <p>Deschide AutoCare în Safari. Apasă <strong>Partajare</strong>, apoi <strong>Adaugă la ecranul principal</strong> și <strong>Adaugă</strong>.</p>
      </section>
    </div>
    <p className="muted small">GPS-ul în fundal și automatizarea Bluetooth necesită aplicația nativă și permisiunile dispozitivului.</p>
  </main>;
}
