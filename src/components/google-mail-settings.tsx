'use client';
import { useEffect, useState } from 'react';
import { Mail } from 'lucide-react';
type Status = {
  configured: boolean;
  connected: boolean;
  from?: string;
  testedAt?: string | null;
  reconnectRequired?: boolean;
};
async function request(action: string, method = 'GET') {
  const response = await fetch('/api/v1/mail/google/' + action, { method, cache: 'no-store' });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Operațiunea Gmail nu a reușit.');
  return result;
}
export default function GoogleMailSettings() {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let cancelled = false;
    const outcome = new URLSearchParams(window.location.search).get('gmail');
    if (outcome) {
      const url = new URL(window.location.href);
      url.searchParams.delete('gmail');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    if (outcome === 'connected')
      setNotice('Autorizarea Gmail a fost salvată. Trimite un email de test.');
    if (outcome === 'failed')
      setError('Conectarea Gmail nu a fost finalizată sau a expirat. Reconectează contul.');
    void request('status')
      .then((value) => {
        if (!cancelled) setStatus(value);
      })
      .catch(() => {
        if (!cancelled) setError('Starea Gmail nu a putut fi încărcată.');
      });
    return () => {
      cancelled = true;
    };
  }, []);
  async function act(action: 'connect' | 'test' | 'disconnect') {
    if (busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await request(action, 'POST');
      if (action === 'connect') {
        const url = new URL(result.url);
        if (url.origin !== 'https://accounts.google.com' || url.pathname !== '/o/oauth2/v2/auth')
          throw new Error('Adresă Google invalidă.');
        window.location.assign(url.toString());
        return;
      }
      setStatus(await request('status'));
      setNotice(
        action === 'test'
          ? `Emailul de test a fost trimis către ${result.to}. Verifică Inbox și Spam.`
          : 'Autorizarea Gmail a fost eliminată din AutoCare.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card google-console-settings">
      <div className="inline">
        <Mail size={24} />
        <div>
          <p className="eyebrow">DOAR FONDATOR</p>
          <h2>Conectare Gmail</h2>
        </div>
      </div>
      <p>
        Conectează contul oficial pentru trimitere prin Gmail API. Google solicită exclusiv
        permisiunea de a trimite emailuri.
      </p>
      {!status ? (
        <p>Se încarcă starea conexiunii…</p>
      ) : (
        <>
          <p>
            <strong>
              {status.connected
                ? 'Autorizare salvată'
                : status.reconnectRequired
                  ? 'Reconectare necesară'
                  : 'Neconectat'}
            </strong>
            {status.from ? ` · ${status.from}` : ''}
          </p>
          {!status.configured && <p>Configurarea Gmail pe server este incompletă.</p>}
          {status.testedAt && (
            <p>Ultimul test trimis: {new Date(status.testedAt).toLocaleString('ro-RO')}</p>
          )}
          <div className="inline">
            <button
              className="primary"
              disabled={busy || !status.configured}
              onClick={() => void act('connect')}
            >
              {status.connected ? 'Reconectează Gmail' : 'Conectează Gmail'}
            </button>
            <button disabled={busy || !status.connected} onClick={() => void act('test')}>
              Trimite email de test
            </button>
            {status.connected && (
              <button disabled={busy} onClick={() => void act('disconnect')}>
                Deconectează Gmail
              </button>
            )}
          </div>
          {status.from && (
            <p className="small muted">
              Testul manual se trimite exclusiv către {status.from}, cel mult o dată pe minut.
            </p>
          )}
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <p className="small muted">
        Notificările automate Gmail sunt controlate separat din Mail Center și prin configurarea
        serverului. Emailurile existente continuă prin serviciul configurat anterior. Deconectarea
        elimină autorizarea locală; accesul Google poate fi revocat și din contul Google.
      </p>
    </section>
  );
}
