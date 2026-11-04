'use client';
import { useEffect, useRef, useState } from 'react';

/** Web releases refresh only at an idle, visible, online and unedited page. */
export default function AutoUpdate() {
  const [available, setAvailable] = useState(false);
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
    const check = async () => {
      if (disposed || checking || document.visibilityState !== 'visible' || !navigator.onLine) return;
      checking = true;
      try {
        const response = await fetch('/api/app-version', { cache: 'no-store', signal: AbortSignal.timeout(10000) });
        if (!response.ok) return;
        const data = await response.json();
        if (typeof data.version !== 'string' || data.version === 'development' || data.version === current || disposed) return;
        pending = true;
        setAvailable(true);
        if (!dirty.current && document.documentElement.dataset.autocareGpsActive !== 'true' && Date.now() - interaction.current > 30000) window.location.reload();
      } catch { /* Offline, suspended app or failed deploy: keep the working page. */ }
      finally { checking = false; }
    };
    const resume = () => { void check(); };
    const timer = window.setInterval(() => { void check(); }, 120000);
    const idle = window.setInterval(() => { if (pending) void check(); }, 15000);
    document.addEventListener('input', edited, true);
    document.addEventListener('change', edited, true);
    document.addEventListener('pointerdown', interacted, true);
    document.addEventListener('keydown', interacted, true);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
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
      window.removeEventListener('focus', resume);
    };
  }, []);
  if (!available) return null;
  const en = document.documentElement.lang.startsWith('en');
  return <aside role="status" style={{ position: 'fixed', bottom: 'calc(88px + env(safe-area-inset-bottom))', right: 16, left: 'auto', maxWidth: 'min(370px, calc(100vw - 32px))', zIndex: 10000, padding: 18, borderRadius: 16, background: '#151b26', color: '#fff', boxShadow: '0 12px 36px #0004', border: '1px solid #3478f6' }}>
    <strong>{en ? 'An AutoCare update is ready' : 'O actualizare AutoCare este pregătită'}</strong>
    <p style={{ color: '#d6e2f5', margin: '8px 0 12px' }}>{en ? 'Updates install automatically when you are idle. Finish your form or GPS trip first.' : 'Se aplică automat când nu lucrezi în pagină. Finalizează întâi formularul sau traseul GPS.'}</p>
    <button type="button" style={{ background: '#3478f6', color: '#fff', border: 0, padding: '12px 18px', borderRadius: 10, fontWeight: 700 }} onClick={() => {
      if (document.documentElement.dataset.autocareGpsActive === 'true') return;
      if (!dirty.current || window.confirm(en ? 'Reload AutoCare? Unsaved form changes may be lost.' : 'Reîncarci AutoCare? Modificările nesalvate din formular se pot pierde.')) window.location.reload();
    }}>{en ? 'Update now' : 'Actualizează acum'}</button>
  </aside>;
}
