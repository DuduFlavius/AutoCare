'use client';
import { useEffect, useState } from 'react';
export default function CommunicationPreferences() {
  const [prefs, setPrefs] = useState<{ transactional: boolean; promotional: boolean } | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    void fetch('/api/v1/communication-preferences', { cache: 'no-store' })
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((v) => {
        if (active) setPrefs(v);
      })
      .catch(() => {
        if (active) setMessage('Preferințele de comunicare nu au putut fi încărcate.');
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <section className="card">
      <h3>Preferințe de comunicare</h3>
      <p>
        Tu alegi ce primești. Comunicările promoționale sunt dezactivate până îți exprimi acordul.
        Poți retrage acordul oricând, aici.
      </p>
      {prefs && (
        <form
          className="stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setMessage('');
            try {
              const r = await fetch('/api/v1/communication-preferences', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(prefs),
              });
              if (!r.ok) throw new Error();
              setMessage('Preferințe salvate.');
            } catch {
              setMessage('Salvarea nu a reușit. Reîncearcă.');
            } finally {
              setBusy(false);
            }
          }}
        >
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.transactional}
              disabled={busy}
              onChange={(e) => setPrefs({ ...prefs, transactional: e.target.checked })}
            />
            Emailuri despre abonament și anunțuri administrative
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={prefs.promotional}
              disabled={busy}
              onChange={(e) => setPrefs({ ...prefs, promotional: e.target.checked })}
            />
            Doresc noutăți și oferte promoționale AutoCare prin email
          </label>
          <p className="small muted">
            Opțiunea generală „Email” din setările de notificări rămâne valabilă. Confirmarea
            adresei și resetarea parolei cerute de tine sunt mesaje de securitate și funcționează
            separat.
          </p>
          <button disabled={busy}>Salvează preferințele de comunicare</button>
        </form>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
