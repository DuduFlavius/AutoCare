'use client';
import {hasNativePush,nativePushPermission} from '@/lib/native-push-client';
import { useEffect, useState } from 'react';
import { BellRing, Send, ShieldCheck } from 'lucide-react';
export default function PushSettings({
  configured,
  emailConfigured,
  preview = false,
  onActivate,
  onTest,
}: {
  configured: boolean;
  emailConfigured: boolean;
  preview?: boolean;
  onActivate: () => Promise<void>;
  onTest: () => Promise<void>;
}) {
  const [native,setNative]=useState(false);
  const [feedback, setFeedback] = useState(''),
    [permission, setPermission] = useState('loading'),
    [busy, setBusy] = useState(false),
    [needsInstall, setNeedsInstall] = useState(false);
  useEffect(() => {
    if(hasNativePush()){
      setNative(true);
      let disposed = false;
      const update = () => { void nativePushPermission().then(value => { if (!disposed) setPermission(value); }).catch(() => { if (!disposed) setPermission('default'); }); };
      update();
      document.addEventListener('visibilitychange', update);
      return () => { disposed = true; document.removeEventListener('visibilitychange', update); };
    }
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      !!(navigator as Navigator & { standalone?: boolean }).standalone;
    setNeedsInstall(ios && !standalone);
    setPermission(
      'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
        ? Notification.permission
        : 'unsupported',
    );
  }, []);
  async function localTest() {
    setFeedback('');
    if (!('Notification' in window)) { setFeedback('Browserul nu suportă notificările.'); return; }
    try {
      const allowed = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
      setPermission(allowed);
      if (allowed !== 'granted') { setFeedback('Permisiunea nu a fost acordată. Verifică setările site-ului.'); return; }
      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.register('/sw.js');
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification('AutoCare · Notificare de test', { body: 'Notificările funcționează pe acest dispozitiv când AutoCare este deschis.', icon: '/icon-192.png', tag: 'autocare-local-test' });
      } else {
        new Notification('AutoCare · Notificare de test', { body: 'Test local de notificare.' });
      }
      setFeedback('Test local trimis către dispozitiv. Pentru notificări în fundal trebuie configurat serviciul Web Push.');
    } catch (error) { setFeedback(error instanceof Error ? error.message : 'Testul local nu a reușit.'); }
  }
  async function activate() {
    setFeedback('');
    setBusy(true);
    try {
      if (!configured && !native) { await localTest(); return; }
      await onActivate();
      if (native) setPermission(await nativePushPermission());
      else if ('Notification' in window) setPermission(Notification.permission);
      setFeedback('Notificările au fost activate pe acest dispozitiv.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Activarea notificărilor nu a reușit. Încearcă din nou.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card push-settings">
      <div className="settings-section-title">
        <span className="list-icon">
          <BellRing size={23} />
        </span>
        <div>
          <p className="eyebrow">ALERTE PE DISPOZITIV</p>
          <h3>Notificările tale</h3>
        </div>
      </div>
      <p>
        {native ? 'Primește alerte pentru termenele mașinii și mesaje importante. Apasă „Activează notificările” și acceptă permisiunea Android.' : 'Primește bannere pe telefon sau calculator pentru termenele tale. Permite notificările pe acest dispozitiv.'}
      </p>
      <div className="push-state" role="status">
        <ShieldCheck size={16} />
        {native ? (permission === 'granted' ? 'Notificările sunt permise pe acest telefon.' : permission === 'denied' ? 'Notificările sunt blocate. Le poți permite din Setări Android → Aplicații → AutoCare → Notificări.' : 'Activează notificările și acceptă permisiunea Android.') : needsInstall
          ? 'Pe iPhone/iPad: deschide în Safari → Partajează → Adaugă pe ecranul principal. Deschide apoi AutoCare din pictogramă și activează notificările. Necesită iOS/iPadOS 16.4 sau mai nou.'
          : permission === 'granted'
            ? 'Permisiune acordată pe acest dispozitiv'
            : permission === 'denied'
              ? 'Notificările sunt blocate. Permite-le din setările browserului pentru AutoCare.'
              : permission === 'unsupported'
                ? 'Acest browser nu suportă notificările Web Push. Încearcă aplicația web instalată sau un browser compatibil.'
                : permission === 'loading'
                  ? 'Verific dispozitivul…'
                  : 'Activează notificările și acceptă cererea browserului.'}
      </div>
      <div className="inline">
        <button
          className="primary"
          disabled={
            preview ||
            needsInstall ||
            busy ||
            ['loading', 'denied', 'unsupported'].includes(permission)
          }
          onClick={() => void activate()}
        >
          <BellRing size={16} />
          {busy ? 'Se activează…' : native || configured ? 'Activează notificările' : 'Permite notificările pe dispozitiv'}
        </button>
        <button
          disabled={preview || needsInstall || busy || permission === 'unsupported'}
          onClick={async () => {
            setBusy(true);
            try {
              if (configured || native) await onTest();
              else await localTest();
            } catch (error) {
              setFeedback(error instanceof Error ? error.message : 'Notificarea de test nu a putut fi trimisă.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <Send size={16} />
          Trimite notificare de test
        </button>
      </div>
      {feedback && <p className="push-state" role="status">{feedback}</p>}
      {!native && <p className="micro">
        Pe Android folosește Chrome. Pe PC permite notificările pentru acest site și verifică
        setările de notificări ale sistemului, inclusiv modul Nu deranjați. Dacă permisiunea este
        blocată, schimb-o din setările site-ului și reîncarcă pagina.
      </p>}
      {!configured && !native && <p className="small muted">Web Push în fundal nu este încă configurat pe server. Poți testa notificările locale pe dispozitiv, dar nu se vor trimite automat când aplicația este închisă.</p>}
      {!emailConfigured && (
        <p className="micro">
          Notificările pe dispozitiv sunt separate de e-mail. Trimiterea e-mailurilor necesită
          conectarea furnizorului.
        </p>
      )}
    </section>
  );
}
