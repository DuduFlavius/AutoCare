'use client';
import { useEffect, useRef, useState } from 'react';
import { useApplicationLanguage } from './application-locale';

/** Web releases refresh only at an idle, visible, online and unedited page. */
export default function AutoUpdate() {
  const [available, setAvailable] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [gpsBlocked, setGpsBlocked] = useState(false);
  const dirty = useRef(false);
  const interaction = useRef(Date.now());
  useEffect(() => {
    const current = process.env.NEXT_PUBLIC_AUTOCARE_BUILD;
    if (!current || current === 'development') return;
    let disposed = false, checking = false, pending = false;
    const edited = (event: Event) => {
      if (event.target instanceof Element && event.target.closest('input,select,textarea,[contenteditable="true"]')) dirty.current = true;
      interaction.current = Date.now();
    };
    const interacted = () => { interaction.current = Date.now(); };
    const report = (state: string) => window.dispatchEvent(new CustomEvent('autocare-update-result', {detail: state}));
    const check = async (manual = false) => {
      if (disposed || checking || document.visibilityState !== 'visible') return;
      if (!navigator.onLine) { if (manual) report('offline'); return; }
      checking = true;
      try {
        const response = await fetch('/api/app-version', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!response.ok) throw Error('Version check failed');
        const data = await response.json();
        if (disposed) return;
        if (typeof data.version !== 'string' || data.version === 'development') throw Error('Invalid release');
        if (data.version === current) { if (manual) report('current'); return; }
        pending = true;
        setAvailable(true);
        setGpsBlocked(document.documentElement.dataset.autocareGpsActive === 'true');
        if (manual) report('available');
        if (!dirty.current && document.documentElement.dataset.autocareGpsActive !== 'true' && Date.now() - interaction.current > 30000) window.location.reload();
      } catch { if (manual) report('error'); /* Keep the working page after a failed check. */ }
      finally { checking = false; }
    };
    const resume = () => { void check(); };
    const manualCheck = () => { void check(true); };
    const timer = window.setInterval(() => { void check(); }, 120000);
    const idle = window.setInterval(() => { if (pending) void check(); }, 15000);
    document.addEventListener('input', edited, true);
    document.addEventListener('change', edited, true);
    document.addEventListener('pointerdown', interacted, true);
    document.addEventListener('keydown', interacted, true);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    window.addEventListener('autocare-check-update', manualCheck);
    window.addEventListener('focus', resume);
    // Revalidate the worker without caching private pages or account responses.
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(() => {});
    void check();
    return () => {
      disposed = true;
      clearInterval(timer); clearInterval(idle);
      document.removeEventListener('input', edited, true);
      document.removeEventListener('change', edited, true);
      document.removeEventListener('pointerdown', interacted, true);
      document.removeEventListener('keydown', interacted, true);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('autocare-check-update', manualCheck);
      window.removeEventListener('focus', resume);
    };
  }, []);
  if (!available) return null;
  const en = document.documentElement.lang.startsWith('en');
  return <aside role="status" style={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom))', right: 16, left: 'auto', maxWidth: 'min(370px, calc(100vw - 32px))', zIndex: 10000, padding: 18, borderRadius: 16, background: '#151b26', color: '#fff', boxShadow: '0 12px 36px #0004', border: '1px solid #3478f6' }}>
    <strong>{en ? 'Update available' : 'Actualizare disponibilă'}</strong>
    <p style={{ color: '#d6e2f5', margin: '8px 0 12px' }}>{en ? 'Updates install automatically when you are idle. Finish your form or GPS trip first.' : 'Se aplică automat când nu lucrezi în pagină. Finalizează întâi formularul sau traseul GPS.'}</p>
    <button type="button" disabled={installing} style={{ background: '#3478f6', color: '#fff', border: 0, padding: '12px 18px', borderRadius: 10, fontWeight: 700 }} onClick={async () => {
      if (document.documentElement.dataset.autocareGpsActive === 'true') { setGpsBlocked(true); return; }
      if (dirty.current && !window.confirm(en ? 'Install the update? Unsaved form changes may be lost.' : 'Instalezi actualizarea? Modificările nesalvate din formular se pot pierde.')) return;
      setInstalling(true);
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          await reg?.update();
        }
      } catch { /* The network-first page still refreshes to the current release. */ }
      window.location.reload();
    }}>{installing ? (en ? 'Installing…' : 'Se instalează…') : (en ? 'Install update' : 'Instalează actualizarea')}</button>
    {gpsBlocked && <p style={{color:'#fbd38d',margin:'10px 0 0'}}>{en ? 'Stop and save your GPS trip before installing.' : 'Oprește și salvează traseul GPS înainte de instalare.'}</p>}
  </aside>;
}


export function AppUpdateSettings() {
  const en = useApplicationLanguage() === 'en';
  const [status,setStatus] = useState('');
  useEffect(() => {
    const result = (event: Event) => setStatus((event as CustomEvent<string>).detail);
    window.addEventListener('autocare-update-result',result);
    return () => window.removeEventListener('autocare-update-result',result);
  }, []);
  useEffect(() => {
    if (status !== 'checking') return;
    const timer = setTimeout(() => setStatus('error'),12000);
    return () => clearTimeout(timer);
  }, [status]);
  const messages: Record<string,string> = en ? {
    current:'The AutoCare interface is up to date. This check does not update the installed Android APK.', available:'An update is ready. Tap “Install update” in the notification.', offline:'Connect to the internet to check for updates.', error:'Could not check for updates. Please try again.', checking:'Checking for updates…',
  } : {
    current:'Interfața AutoCare este actualizată. Această verificare nu actualizează APK-ul Android instalat.', available:'Actualizarea este pregătită. Apasă „Instalează actualizarea” în notificare.', offline:'Conectează-te la internet pentru verificare.', error:'Actualizările nu au putut fi verificate. Încearcă din nou.', checking:'Se verifică actualizările…',
  };
  return <div style={{marginTop:20,paddingTop:18,borderTop:'1px solid #dbe5f3'}}>
    <h4>{en ? 'App updates' : 'Actualizările aplicației'}</h4>
    <p className="small muted">{en ? 'AutoCare checks for new versions when you reopen it and while it is active. Your account data stays saved.' : 'AutoCare verifică versiunile noi la redeschidere și cât timp este activă. Datele salvate în cont rămân păstrate.'}</p>
    <button type="button" disabled={status==='checking'} onClick={() => {setStatus('checking');window.dispatchEvent(new Event('autocare-check-update'));}}>{en ? 'Check for updates' : 'Verifică actualizările'}</button>
    {status && <p role="status" className="small">{messages[status]}</p>}
  </div>;
}
