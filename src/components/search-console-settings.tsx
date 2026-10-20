'use client';
import { useEffect, useState } from 'react';
import { Search, CheckCircle2, ExternalLink } from 'lucide-react';
export default function SearchConsoleSettings() {
  const [token, setToken] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let cancelled = false;
    void fetch('/api/v1/founder/seo', { cache: 'no-store' })
      .then(async (response) => {
        const out = await response.json();
        if (!response.ok) throw new Error(out.error);
        if (!cancelled) setToken(out.googleVerification || '');
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return (
    <section className="card google-console-settings">
      <div className="inline">
        <span className="list-icon">
          <Search size={22} />
        </span>
        <div>
          <p className="eyebrow">PREZENȚA ÎN GOOGLE</p>
          <h2>Google Search Console</h2>
        </div>
      </div>
      <p>
        Confirmă că ești proprietarul site-ului. Codul de verificare este emis de Google pentru
        contul tău.
      </p>
      <ol>
        <li>
          Deschide Search Console și adaugă proprietatea <strong>URL prefix</strong>:{' '}
          <code>https://autocare-garaj.vercel.app/</code>.
        </li>
        <li>
          Alege metoda <strong>Etichetă HTML / HTML tag</strong> și copiază eticheta primită.
        </li>
        <li>
          Salvează codul aici, apoi revino la Google și apasă <strong>Verifică</strong>.
        </li>
      </ol>
      <a
        className="button"
        href="https://search.google.com/search-console"
        target="_blank"
        rel="noopener noreferrer"
      >
        Deschide Search Console <ExternalLink size={15} />
      </a>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError('');
          setNotice('');
          try {
            const response = await fetch('/api/v1/founder/seo', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ googleVerification: token }),
            });
            const out = await response.json();
            if (!response.ok) throw new Error(out.error);
            setToken(out.googleVerification);
            setNotice(
              'Cod salvat pe pagina principală. Revino în Search Console și apasă Verifică.',
            );
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Codul sau eticheta de verificare Google
          <textarea
            rows={3}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            required
            disabled={loading || busy}
            placeholder="Lipește aici eticheta google-site-verification primită de la Google"
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            <CheckCircle2 size={16} /> {notice}
          </p>
        )}
        <button className="primary" disabled={loading || busy || !token.trim()}>
          {loading ? 'Se încarcă…' : busy ? 'Se salvează…' : 'Salvează verificarea Google'}
        </button>
      </form>
      <p className="small muted">
        După confirmare, trimite sitemap-ul:{' '}
        <a href="/sitemap.xml" target="_blank" rel="noopener noreferrer">
          https://autocare-garaj.vercel.app/sitemap.xml
        </a>
        . Salvarea codului nu înseamnă că Google a confirmat deja proprietatea.
      </p>
    </section>
  );
}
