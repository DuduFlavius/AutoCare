'use client';
import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { nativeTracking, nativeMethodMissing } from '@/lib/native-tracking';
import { useApplicationLanguage } from './application-locale';

/** Web releases refresh only at an idle, visible, online and unedited page. */
export default function AutoUpdate() {
  const [available, setAvailable] = useState(false);
  const [native, setNative] = useState(false);
  const [androidRelease, setAndroidRelease] = useState<{version: string; url: string} | null>(null);
  const [installing, setInstalling] = useState(false);
  const [gpsBlocked, setGpsBlocked] = useState(false);
  const dirty = useRef(false);
  const interaction = useRef(Date.now());
  useEffect(() => {
    const native = Capacitor.isNativePlatform(); setNative(native);
    let disposed = false, busy = false;
    const checkAndroid = async () => {
      if (Capacitor.getPlatform() !== 'android' || document.hidden || !navigator.onLine || busy) return;
      busy = true;
      try {
        const [response, installed] = await Promise.all([fetch('/api/android-update', {cache:'no-store', signal:AbortSignal.timeout(10000)}), nativeTracking.appVersion()]);
        if (!response.ok) return;
        const release = await response.json();
        if (!disposed && release.available && Number.isInteger(release.versionCode) && release.versionCode > installed.versionCode && typeof release.version === 'string' && typeof release.url === 'string' && /^\/downloads\/AutoCare-[0-9.]+\.apk$/.test(release.url)) setAndroidRelease({version:release.version,url:release.url});
      } catch { /* A failed check never interrupts a trip or requests a downgrade. */ }
      finally { busy = false; }
    };
    void checkAndroid();
    const timer = setInterval(() => void checkAndroid(), 120000);
    window.addEventListener('focus',checkAndroid);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener('focus',checkAndroid); };
  }, []);
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
        if (!Capacitor.isNativePlatform() && !dirty.current && document.documentElement.dataset.autocareGpsActive !== 'true' && Date.now() - interaction.current > 30000) window.location.reload();
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
  if (!native || (!available && !androidRelease)) return null;
  const en = document.documentElement.lang.startsWith('en');
  return <aside role="status" style={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom))', right: 16, left: 'auto', maxWidth: 'min(370px, calc(100vw - 32px))', zIndex: 10000, padding: 18, borderRadius: 16, background: '#151b26', color: '#fff', boxShadow: '0 12px 36px #0004', border: '1px solid #3478f6' }}>
    <strong>{en ? 'Update available' : 'Actualizare disponibilă'}{androidRelease ? ` · ${androidRelease.version}` : ''}</strong>
    <p style={{ color: '#d6e2f5', margin: '8px 0 12px' }}>{en ? 'Install when your trip is saved. Android will ask you to confirm the installation.' : 'Instalează după salvarea traseului. Android îți va cere confirmarea instalării.'}</p>
    <button type="button" disabled={installing} style={{ background: '#3478f6', color: '#fff', border: 0, padding: '12px 18px', borderRadius: 10, fontWeight: 700 }} onClick={async () => {
      if (document.documentElement.dataset.autocareGpsActive === 'true') { setGpsBlocked(true); return; }
      if (dirty.current && !window.confirm(en ? 'Install the update? Unsaved form changes may be lost.' : 'Instalezi actualizarea? Modificările nesalvate din formular se pot pierde.')) return;
      setInstalling(true);
      if (androidRelease) {
        try { await nativeTracking.openAndroidUpdate(new URL(androidRelease.url,window.location.origin).href); }
        catch { setGpsBlocked(true); }
        finally { setInstalling(false); }
        return;
      }
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
  const [androidRelease,setAndroidRelease] = useState<{version:string;url:string}|null>(null);
  const [androidStatus,setAndroidStatus] = useState('');
  const [android,setAndroid] = useState(false);
  const [native,setNative] = useState(false);
  useEffect(()=>{setAndroid(Capacitor.getPlatform()==='android');setNative(Capacitor.isNativePlatform());},[]);
  const checkAndroid = async () => {
    setAndroidStatus('checking');setAndroidRelease(null);
    try {
      const response=await fetch('/api/android-update',{cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(!response.ok)throw Error('Update unavailable');
      const release=await response.json();
      if(!release.available){setAndroidStatus('unpublished');return;}
      if(!Number.isInteger(release.versionCode)||typeof release.version!=='string'||typeof release.url!=='string'||!/^\/downloads\/AutoCare-[0-9.]+\.apk$/.test(release.url))throw Error('Invalid release');
      let installed:number|null=null;
      try { installed=(await nativeTracking.appVersion()).versionCode; } catch(error) { if(!nativeMethodMissing(error))throw error; }
      if(installed!==null&&installed>=release.versionCode){setAndroidStatus('current');return;}
      setAndroidRelease({version:release.version,url:release.url});setAndroidStatus(installed===null?'unknown':'available');
    } catch { setAndroidStatus('error'); }
  };
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
  if (!native) return null;
  return <div style={{marginTop:20,paddingTop:18,borderTop:'1px solid #dbe5f3'}}>
    <h4>{en ? 'App updates' : 'Actualizările aplicației'}</h4>
    <p className="small muted">{en ? 'AutoCare checks for new versions when you reopen it and while it is active. Your account data stays saved.' : 'AutoCare verifică versiunile noi la redeschidere și cât timp este activă. Datele salvate în cont rămân păstrate.'}</p>
    <button type="button" disabled={status==='checking'} onClick={() => {setStatus('checking');window.dispatchEvent(new Event('autocare-check-update'));}}>{en ? 'Check for updates' : 'Verifică actualizările'}</button>
    {status && <p role="status" className="small">{messages[status]}</p>}
    {android && <div style={{marginTop:16}}>
      <strong>{en?'Android app · GPS and background tracking':'Aplicația Android · GPS și urmărire în fundal'}</strong>
      <p className="small muted">{en?'Android asks you to confirm installation. Stop and save your GPS trip first.':'Android îți cere confirmarea instalării. Oprește și salvează întâi traseul GPS.'}</p>
      <button type="button" disabled={androidStatus==='checking'} onClick={()=>void checkAndroid()}>{en?'Check Android update':'Verifică actualizarea Android'}</button>
      {androidStatus && <p role="status" className="small">{({checking:en?'Checking…':'Se verifică…',unpublished:en?'The new Android installer has not been published yet.':'Kitul noii versiuni Android nu este încă publicat.',current:en?'The installed Android app is up to date.':'Aplicația Android instalată este la zi.',available:en?'New Android version available.':'Este disponibilă o versiune Android nouă.',unknown:en?'Installer available. This older app cannot report its installed version.':'Kit disponibil. Această aplicație mai veche nu poate comunica versiunea instalată.',error:en?'Could not check Android updates. Try again.':'Actualizarea Android nu a putut fi verificată. Reîncearcă.',blocked:en?'Stop and save your GPS trip first.':'Oprește și salvează întâi traseul GPS.'} as Record<string,string>)[androidStatus]}</p>}
      {androidRelease && <button type="button" onClick={()=>{if(document.documentElement.dataset.autocareGpsActive==='true'){setAndroidStatus('blocked');return;}const url=new URL(androidRelease.url,window.location.origin).href;void nativeTracking.openAndroidUpdate(url).catch(error=>{if(nativeMethodMissing(error)){window.location.href='intent://'+url.slice('https://'.length)+'#Intent;scheme=https;action=android.intent.action.VIEW;category=android.intent.category.BROWSABLE;end';}else setAndroidStatus('error');});}}>{en?'Download Android':'Descarcă Android'} {androidRelease.version}</button>}
    </div>}
  </div>;
}
