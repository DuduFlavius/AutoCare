'use client';
import {requestConfirmation} from '@/components/premium-dialogs';

import { useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { nativeTracking, nativeAutomation, nativeMethodMissing } from '@/lib/native-tracking';
import { useApplicationLanguage } from './application-locale';

type AndroidRelease = { version: string; versionCode: number; url: string };
const officialAndroidOrigin = 'https://www.autocareapp.ro';

async function fetchAndroidRelease(): Promise<AndroidRelease | null> {
  const response = await fetch('/api/android-update', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error('Update unavailable');
  const release = await response.json();
  if (!release.available) return null;
  if (!Number.isSafeInteger(release.versionCode) || release.versionCode < 1 ||
      typeof release.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(release.version) ||
      release.url !== '/downloads/AutoCare-' + release.version + '.apk') throw new Error('Invalid release');
  return { version: release.version, versionCode: release.versionCode, url: officialAndroidOrigin + release.url };
}

function tripBlocksUpdate() {
  const {autocareGpsActive, autocareNavigationActive} = document.documentElement.dataset;
  return autocareGpsActive === 'true' || autocareNavigationActive === 'true';
}

async function installAndroidRelease(release: AndroidRelease) {
  if (tripBlocksUpdate()) return 'blocked';
  const {autocareNativeOwner: owner, autocareNativeUpdateSafe: safe} = document.documentElement.dataset;
  if (owner) {
    const [trip, queue] = await Promise.all([nativeTracking.snapshot(owner), nativeAutomation.pending(owner)]);
    if (trip?.active || queue.length || safe !== 'true' || tripBlocksUpdate()) return 'blocked';
  }
  try {
    await nativeTracking.installAndroidUpdate(release);
    return 'installer';
  } catch (error) {
    const code = (error as {code?:string})?.code;
    if (code === 'UPDATE_PERMISSION') return 'permission';
    if (code === 'UPDATE_TRIP_ACTIVE') return 'blocked';
    throw error;
  }
}

/** Web releases refresh only at an idle, visible, online and unedited page. */
export default function AutoUpdate() {
  const [available, setAvailable] = useState(false);
  const [native, setNative] = useState(false);
  const [androidRelease, setAndroidRelease] = useState<AndroidRelease | null>(null);
  const [installing, setInstalling] = useState(false);
  const [gpsBlocked, setGpsBlocked] = useState(false);
  const [installError, setInstallError] = useState(false);
  const [permissionNeeded, setPermissionNeeded] = useState(false);
  const dirty = useRef(false);
  const interaction = useRef(Date.now());
  useEffect(() => {
    if ('serviceWorker' in navigator && !Capacitor.isNativePlatform()) {
      void navigator.serviceWorker.register('/sw.js', {updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
    }
  }, []);
  useEffect(() => {
    const native = Capacitor.isNativePlatform(); setNative(native);
    let disposed = false, busy = false;
    const checkAndroid = async () => {
      if (Capacitor.getPlatform() !== 'android' || document.hidden || !navigator.onLine || busy) return;
      busy = true;
      try {
        const [release, installed] = await Promise.all([fetchAndroidRelease(), nativeTracking.appVersion()]);
        if (!disposed) setAndroidRelease(release && installed.directUpdate && release.versionCode > installed.versionCode ? release : null);
      } catch { /* A failed check never interrupts a trip or requests a downgrade. */ }
      finally { busy = false; }
    };
    void checkAndroid();
    const timer = setInterval(() => void checkAndroid(), 120000);
    window.addEventListener('focus',checkAndroid);
    window.addEventListener('online',checkAndroid);
    document.addEventListener('visibilitychange',checkAndroid);
    return () => { disposed = true; clearInterval(timer); window.removeEventListener('focus',checkAndroid); window.removeEventListener('online',checkAndroid); document.removeEventListener('visibilitychange',checkAndroid); };
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
        setGpsBlocked(tripBlocksUpdate());
        if (manual) report('available');
        let nativeSafe = !Capacitor.isNativePlatform();
        const ownerId = document.documentElement.dataset.autocareNativeOwner;
        if (!nativeSafe && ownerId && document.documentElement.dataset.autocareNativeUpdateSafe === 'true') {
          const [active, queue] = await Promise.all([nativeTracking.snapshot(ownerId), nativeAutomation.pending(ownerId)]);
          nativeSafe = !active?.active && queue.length === 0;
        }
        if (!disposed && document.visibilityState === 'visible' && navigator.onLine && (!Capacitor.isNativePlatform() || (document.documentElement.dataset.autocareNativeOwner === ownerId && document.documentElement.dataset.autocareNativeUpdateSafe === 'true')) && nativeSafe && !dirty.current && !tripBlocksUpdate() && Date.now() - interaction.current > 30000) window.location.reload();
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
  return <aside role="status" style={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom))', right: 16, left: 'auto', maxWidth: 'min(370px, calc(100vw - 32px))', zIndex: 10000, padding: 18, borderRadius: 16, background: '#091611', color: '#fff', boxShadow: '0 12px 36px #0004', border: '1px solid #5AFFC4' }}>
    <strong>{en ? 'Update available' : 'Actualizare disponibilă'}{androidRelease ? ` · ${androidRelease.version}` : ''}</strong>
    <p style={{ color: '#FFFFFF', margin: '8px 0 12px' }}>{androidRelease ? (en ? 'Android will ask you to confirm installation. Save your trip first.' : 'Android îți va cere confirmarea instalării. Salvează întâi traseul.') : (en ? 'The interface refreshes automatically when idle, after trips sync and without unsaved edits.' : 'Interfața se actualizează automat în repaus, după sincronizarea traseelor și fără modificări nesalvate.')}</p>
    <button type="button" disabled={installing} style={{ background: '#5AFFC4', color: '#083d31', border: 0, padding: '12px 18px', borderRadius: 10, fontWeight: 700 }} onClick={async () => {
      if (tripBlocksUpdate()) { setGpsBlocked(true); return; }
      if (dirty.current && !await requestConfirmation(en ? 'Install the update? Unsaved form changes may be lost.' : 'Instalezi actualizarea? Modificările nesalvate din formular se pot pierde.')) return;
      setInstallError(false);
      setPermissionNeeded(false);
      setGpsBlocked(false);
      setInstalling(true);
      if (androidRelease) {
        try {
          const result = await installAndroidRelease(androidRelease);
          setPermissionNeeded(result === 'permission');
          setGpsBlocked(result === 'blocked');
        }
        catch { setInstallError(true); }
        finally { setInstalling(false); }
        return;
      }
      if (Capacitor.isNativePlatform()) {
        const ownerId = document.documentElement.dataset.autocareNativeOwner;
        if (ownerId) {
          try {
            const [active, queue] = await Promise.all([nativeTracking.snapshot(ownerId), nativeAutomation.pending(ownerId)]);
            if (active?.active || queue.length > 0 || document.documentElement.dataset.autocareNativeUpdateSafe !== 'true') { setGpsBlocked(true); setInstalling(false); return; }
          } catch { setInstallError(true); setInstalling(false); return; }
        }
      }
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          await reg?.update();
        }
      } catch { /* The network-first page still refreshes to the current release. */ }
      window.location.reload();
    }}>{installing ? (en ? 'Preparing the update…' : 'Se pregătește actualizarea…') : (en ? 'Install update' : 'Instalează actualizarea')}</button>
    {permissionNeeded && <p role="alert">{en ? 'Allow AutoCare to install apps in Android settings and retry.' : 'Permite instalarea din AutoCare în setările Android și reîncearcă.'}</p>}
    {installError && <p role="alert">{en ? 'Could not open the installer. Try again after saving your trip.' : 'Kitul de instalare nu a putut fi deschis. Reîncearcă după salvarea traseului.'}</p>}
    {gpsBlocked && <p style={{color:'var(--color-warning-ink)',margin:'10px 0 0'}}>{en ? 'Stop and save your GPS trip before installing.' : 'Oprește și salvează traseul GPS înainte de instalare.'}</p>}
  </aside>;
}


export function AppUpdateSettings() {
  const en = useApplicationLanguage() === 'en';
  const [status,setStatus] = useState('');
  const [androidRelease,setAndroidRelease] = useState<AndroidRelease|null>(null);
  const [androidStatus,setAndroidStatus] = useState('');
  const [android,setAndroid] = useState(false);
  const [native,setNative] = useState(false);
  useEffect(()=>{setAndroid(Capacitor.getPlatform()==='android');setNative(Capacitor.isNativePlatform());},[]);
  const checkAndroid = async () => {
    setAndroidStatus('checking');setAndroidRelease(null);
    try {
      const release = await fetchAndroidRelease();
      if (!release) { setAndroidStatus('unpublished'); return; }
      const installed = await nativeTracking.appVersion();
      if (installed.directUpdate === false) { setAndroidStatus('store'); return; }
      if (installed.versionCode >= release.versionCode) { setAndroidStatus('current'); return; }
      if (installed.directUpdate !== true) { setAndroidStatus('bootstrap'); return; }
      setAndroidRelease(release);
      setAndroidStatus('available');
    } catch (error) { setAndroidStatus(nativeMethodMissing(error) ? 'bootstrap' : 'error'); }
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
      {androidStatus && <p role="status" className="small">{({checking:en?'Checking…':'Se verifică…',unpublished:en?'The new Android installer has not been published yet.':'Kitul noii versiuni Android nu este încă publicat.',current:en?'The installed Android app is up to date.':'Aplicația Android instalată este la zi.',available:en?'New Android version available.':'Este disponibilă o versiune Android nouă.',bootstrap:en?'Install the latest version once from the official AutoCare site. Future updates install from this screen.':'Instalează o singură dată ultima versiune de pe site-ul oficial AutoCare. Următoarele actualizări se instalează din acest ecran.',store:en?'Update this installation through Google Play.':'Actualizează această instalare din Google Play.',installing:en?'Preparing the update…':'Se pregătește actualizarea…',installer:en?'Confirm installation in Android.':'Confirmă instalarea în Android.',permission:en?'Allow AutoCare to install apps in Android settings and retry.':'Permite instalarea din AutoCare în setările Android și reîncearcă.', error:en?'Could not check Android updates. Try again.':'Actualizarea Android nu a putut fi verificată. Reîncearcă.',blocked:en?'Stop and save your GPS trip first.':'Oprește și salvează întâi traseul GPS.'} as Record<string,string>)[androidStatus]}</p>}
      {androidRelease && <button type="button" disabled={androidStatus==='installing'} onClick={async()=>{
        setAndroidStatus('installing');
        try { setAndroidStatus(await installAndroidRelease(androidRelease)); }
        catch { setAndroidStatus('error'); }
      }}>{en ? 'Install Android update' : 'Instalează actualizarea Android'} {androidRelease.version}</button>}
    </div>}
  </div>;
}
