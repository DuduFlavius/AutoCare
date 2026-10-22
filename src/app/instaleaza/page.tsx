'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export default function InstallPage() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'other'>('other');
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    const ua = navigator.userAgent;
    setPlatform(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'ios' : /Android/i.test(ua) ? 'android' : 'other');
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
  return <main style={{ minHeight: '100dvh', background: 'linear-gradient(145deg,#081729,#142e50)', color: '#f2f7ff', padding: 'min(7vw,36px) 18px', fontFamily: 'system-ui,sans-serif' }}>
    <div style={{ maxWidth: 540, margin: '0 auto' }}>
      <Link href="/cont" style={{ color: '#bad6ff', textDecoration: 'none', fontSize: 14 }}>← Înapoi la AutoCare</Link>
      <div style={{ marginTop: 36, padding: 24, background: '#1b3758', border: '1px solid #42638a', borderRadius: 24 }}>
        <img src="/icon-192.png" alt="AutoCare" width={72} height={72} style={{ borderRadius: 18 }} />
        <h1 style={{ fontSize: 29, margin: '18px 0 8px' }}>AutoCare pe telefonul tău</h1>
        <p style={{ color: '#c5d8f1', lineHeight: 1.65 }}>Instalează gratuit aplicația, fără cont Google Play sau App Store. Mașinile și documentele tale rămân în același cont AutoCare.</p>
        {installed ? <p role="status" style={{ padding: 14, background: '#164b42', borderRadius: 12 }}>AutoCare este deja deschisă ca aplicație instalată.</p> :
          prompt ? <button type="button" onClick={install} style={{ width: '100%', border: 0, borderRadius: 13, padding: 15, fontWeight: 750, background: '#77b7ff', color: '#081729', fontSize: 16 }}>Instalează AutoCare gratuit</button> : null}
        {message && <p role="status">{message}</p>}
      </div>
      <section style={{ padding: '22px 5px', lineHeight: 1.75 }}>
        <h2 style={{ fontSize: 19 }}>Android — Samsung, Xiaomi, Motorola și altele</h2>
        <p>Deschide AutoCare în Chrome. Apasă meniul ⋮ și alege <strong>Instalează aplicația</strong> sau <strong>Adaugă pe ecranul principal</strong>. Confirmă instalarea.</p>
        <h2 style={{ fontSize: 19, marginTop: 25 }}>iPhone — iOS</h2>
        <p>Deschide AutoCare în <strong>Safari</strong>. Apasă <strong>Partajare</strong>, apoi <strong>Adaugă la ecranul principal</strong> și <strong>Adaugă</strong>. Pe unele versiuni iOS, opțiunea se găsește în meniul de acțiuni.</p>
        <p style={{ color: '#abc4e2', fontSize: 13 }}>Instalarea PWA este gratuită. Pe iPhone nu se poate instala un APK Android; distribuirea unei aplicații iOS native are cerințe Apple separate. Unele funcții, inclusiv notificările, depind de sistem și de permisiunile acordate.</p>
      </section>
    </div>
  </main>;
}
