'use client';
import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import SiteLanguage from './site-language';
import { ShieldCheck, Files, Wrench } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/lib/auth-messages';
export function AuthForm({ mode }: { mode: string }) {
  const [language,setLanguage]=useState<'ro'|'en'>('ro');
  useEffect(()=>{try{if(localStorage.getItem('autocare-language')==='en')setLanguage('en');}catch{/* Preferences still work without storage. */}},[]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const reset = mode === 'resetare-parola',
    signup = mode === 'inregistrare',
    forgot = mode === 'recuperare-parola';
  useEffect(()=>{document.title=(language==='en'?(signup?'Create account':forgot?'Reset password':reset?'New password':'Sign in'):(signup?'Înregistrare':forgot?'Recuperare parolă':reset?'Parolă nouă':'Autentificare'))+' | AutoCare';},[language,signup,forgot,reset]);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email') || '')
      .trim()
      .toLowerCase();
    const password = String(f.get('password') || '');
    try {
      const result = signup
        ? await authClient.signUp.email({
            email,
            password,
            name: String(f.get('name')).trim(),
            callbackURL: '/cont',
          })
        : forgot
          ? await authClient.requestPasswordReset({
              email,
              redirectTo: window.location.origin + '/resetare-parola',
            })
          : reset
            ? await authClient.resetPassword({
                newPassword: password,
                token: new URLSearchParams(window.location.search).get('token') || '',
              })
            : await authClient.signIn.email({ email, password, callbackURL: '/cont' });
      if (result.error) throw new Error(authErrorMessage(result.error.code, result.error.message));
      if (signup) window.location.assign('/cont');
      else if (forgot) setMessage('Dacă există un cont, vei primi instrucțiunile prin email.');
      else if (reset) setMessage('Parola a fost schimbată. Te poți autentifica.');
      else window.location.assign('/cont');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Serviciul nu este disponibil.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <SiteLanguage language={language}/>
      <aside className="auth-editorial">
        <img src="/design-car.jpg" alt="Fotografie auto de ambianță" />
        <div className="auth-editorial-content">
          <span className="section-kicker">PENTRU DRUMURILE CARE URMEAZĂ</span>
          <h2>
            Grijă pentru mașină.
            <br />
            <em>Liniște pentru tine.</em>
          </h2>
          <p>
            Un spațiu personal pentru documente, revizii și toate detaliile pe care merită să le
            păstrezi.
          </p>
          <div>
            <span>
              <Files size={16} />
              Documente organizate
            </span>
            <span>
              <Wrench size={16} />
              Istoric la îndemână
            </span>
            <span>
              <ShieldCheck size={16} />
              Date private
            </span>
          </div>
        </div>
        <small className="auth-image-caption">Fotografie de ambianță</small>
      </aside>
      <div className="auth-box">
        <div style={{display:'flex',justifyContent:'flex-end',marginBottom:18}} data-workspace-ui><label style={{fontSize:12,color:'#47607f'}}>{language==='en'?'Language':'Limbă'} <select aria-label={language==='en'?'Language':'Limbă'} value={language} onChange={event=>{const next=event.target.value==='en'?'en':'ro';setLanguage(next);try{localStorage.setItem('autocare-language',next);}catch{/* Optional preference persistence. */}}} style={{minHeight:40,padding:'8px 12px',border:'1px solid #d2deed',borderRadius:9,background:'#fff',color:'#193b68'}}><option value="ro">Română</option><option value="en">English</option></select></label></div>
        <p className="eyebrow">GARAJUL TĂU DIGITAL</p>
        <h1>
          {signup
            ? 'Bine ai venit.'
            : forgot
              ? 'Ai uitat parola?'
              : reset
                ? 'Alege o parolă nouă.'
                : 'Bine ai revenit.'}
        </h1>
        <p className="muted small">
          {signup
            ? 'Contul se creează imediat, fără confirmare prin email.'
            : 'Documentele și istoricul mașinii tale, la îndemână.'}
        </p>
        <form
          method="post"
          className="stack"
          onSubmit={submit}
          onInvalidCapture={(event) => {
            const input = event.target as HTMLInputElement;
            setError(
              input.name === 'acceptTerms'
                ? 'Bifează acceptarea termenilor pentru a crea contul.'
                : input.name === 'password' && input.validity.tooShort
                  ? 'Parola trebuie să aibă cel puțin 12 caractere.'
                  : input.name === 'email'
                    ? 'Introdu o adresă de email validă.'
                    : 'Completează toate câmpurile obligatorii.',
            );
          }}
        >
          {signup && (
            <label>
              Nume
              <input name="name" autoComplete="name" required maxLength={100} />
            </label>
          )}
          {!reset && (
            <label>
              Email
              <input
                name="email"
                type="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                required
              />
            </label>
          )}
          {!forgot && (
            <label>
              Parolă
              <input
                name="password"
                type="password"
                autoComplete={signup || reset ? 'new-password' : 'current-password'}
                minLength={signup || reset ? 12 : undefined}
                required
              />
              {(signup || reset) && (
                <span className="micro">Minimum 12 caractere. Contul se activează imediat.</span>
              )}
            </label>
          )}
          {signup && (
            <label className="check">
              <input name="acceptTerms" type="checkbox" required />
              <span>
                Accept <Link href="/termeni">termenii</Link> și am citit{' '}
                <Link href="/confidentialitate">politica de confidențialitate</Link>.
              </span>
            </label>
          )}
          <button type="submit" className="primary" disabled={busy}>
            {busy
              ? 'Se procesează…'
              : signup
                ? 'Creează cont'
                : forgot
                  ? 'Trimite instrucțiunile'
                  : reset
                    ? 'Salvează parola'
                    : 'Intră în cont'}
          </button>
        </form>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {message}
          </p>
        )}
        <div className="stack small" style={{ marginTop: 20 }}>
          <Link href={signup ? '/autentificare' : '/inregistrare'}>
            {signup ? 'Ai deja cont? Autentifică-te' : 'Nu ai cont? Înregistrează-te'}
          </Link>
          <Link href="/recuperare-parola">Recuperează parola</Link>
        </div>
      </div>
    </div>
  );
}
