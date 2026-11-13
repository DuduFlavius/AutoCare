'use client';
import {saveBrowserLanguage} from '@/lib/language-preference';
import VehicleSymbol from './vehicle-symbol';
import { useEffect, useState, type FormEvent } from 'react';
import { PublicAiIntro } from './public-ai-intro';
import Link from 'next/link';
import SiteLanguage from './site-language';
import {translateApplicationCopy} from '@/lib/application-language';
import './auth-premium.css';
import { ShieldCheck, Files, Wrench, Eye, EyeOff } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { authErrorMessage } from '@/lib/auth-messages';
export function AuthForm({ mode, next = '/cont' }: { mode: string; next?: string }) {
  const [language, setLanguage] = useState<'ro' | 'en'>('ro');
  useEffect(() => {
    try {
      if ((localStorage.getItem('autocare-language') === 'en' || localStorage.getItem('autocare-language') !== 'ro' && !navigator.language.toLowerCase().startsWith('ro'))) setLanguage('en');
    } catch {
      /* Preferences still work without storage. */
    }
  }, []);
  useEffect(()=>{saveBrowserLanguage(language);},[language]);
  const en=language==='en';
  const t=(ro:string,english:string)=>en?english:ro;
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const reset = mode === 'resetare-parola',
    signup = mode === 'inregistrare',
    forgot = mode === 'recuperare-parola';
  useEffect(() => {
    document.title =
      (language === 'en'
        ? signup
          ? 'Create account'
          : forgot
            ? 'Reset password'
            : reset
              ? 'New password'
              : 'Sign in'
        : signup
          ? 'Înregistrare'
          : forgot
            ? 'Recuperare parolă'
            : reset
              ? 'Parolă nouă'
              : 'Autentificare') + ' | AutoCare';
  }, [language, signup, forgot, reset]);
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
            callbackURL: next,
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
            : await authClient.signIn.email({ email, password, callbackURL: next });
      if (result.error) throw new Error(authErrorMessage(result.error.code, result.error.message));
      if (signup) window.location.assign(next);
      else if (forgot) setMessage('Dacă există un cont, vei primi instrucțiunile prin email.');
      else if (reset) setMessage('Parola a fost schimbată. Te poți autentifica.');
      else window.location.assign(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Serviciul nu este disponibil.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-layout ac-auth-premium">
      <SiteLanguage language={language} />
      <aside className="auth-editorial">
        <VehicleSymbol/>
        <div className="auth-editorial-content">
          <span className="section-kicker">AUTOCARE · GARAGE ACCESS</span>
          <h2>
            {t("Grijă pentru mașină.", "Care for your vehicle.")}
            <br />
            <em>{t("Liniște pentru tine.", "Peace of mind for you.")}</em>
          </h2>
          <p>
            {t("Un spațiu personal pentru documente, revizii și toate detaliile pe care merită să le păstrezi.", "A personal space for documents, maintenance and all the details worth keeping.")}
          </p>
          <div>
            <span>
              <Files size={16} />
              {t("Documente organizate", "Organized documents")}
            </span>
            <span>
              <Wrench size={16} />
              {t("Istoric la îndemână", "History at hand")}
            </span>
            <span>
              <ShieldCheck size={16} />
              {t("Date private", "Private data")}
            </span>
          </div>
        </div>
      </aside>
      <div className="auth-box"><div className="ac-auth-toolbar"><Link href="/start" className="ac-auth-brand"><ShieldCheck size={25}/><strong>AutoCare <span>Premium</span></strong></Link>
        <div
          className="ac-auth-language"
          data-workspace-ui
        >
          <label>
            {language === 'en' ? 'Language' : 'Limbă'}{' '}
            <select
              aria-label={language === 'en' ? 'Language' : 'Limbă'}
              value={language}
              onChange={(event) => {
                const next = event.target.value === 'en' ? 'en' : 'ro';
                setLanguage(next);
                try {
                  saveBrowserLanguage(next);
                } catch {
                  /* Optional preference persistence. */
                }
              }}
            >
              <option value="ro">{en?'Romanian':'Română'}</option>
              <option value="en">English</option>
            </select>
          </label>
        </div>
        </div><p className="eyebrow">{t("GARAJUL TĂU DIGITAL", "YOUR DIGITAL GARAGE")}</p>
        <h1>
          {signup
            ? 'Creează cont'
            : forgot
              ? 'Ai uitat parola?'
              : reset
                ? 'Alege o parolă nouă.'
                : 'Intră în cont'}
        </h1>
        <p className="muted small">
          {signup
            ? 'Creează-ți contul pentru a adăuga prima mașină.'
            : 'Documentele și istoricul mașinii tale, la îndemână.'}
        </p>
        {signup && <details className="ac-auth-ai-details"><summary><ShieldCheck size={17}/><span>AutoCare AI · Premium<small>{t('Asistentul AI este disponibil exclusiv cu Premium.','The AI assistant is available exclusively with Premium.')}</small></span></summary><PublicAiIntro compact /></details>}
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
              {t("Nume", "Name")}
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
              {t("Parolă", "Password")}
              <div className="auth-password-row">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={signup || reset ? 'new-password' : 'current-password'}
                  minLength={signup || reset ? 12 : undefined}
                  required
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  data-workspace-ui
                  aria-pressed={showPassword}
                  aria-label={
                    language === 'en'
                      ? showPassword
                        ? 'Hide password'
                        : 'Show password'
                      : showPassword
                        ? 'Ascunde parola'
                        : 'Arată parola'
                  }
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  <span>
                    {language === 'en'
                      ? showPassword
                        ? 'Hide'
                        : 'Show'
                      : showPassword
                        ? 'Ascunde'
                        : 'Arată'}
                  </span>
                </button>
              </div>
              {(signup || reset) && (
                <span className="micro">{t("Cel puțin 12 caractere.", "At least 12 characters.")}</span>
              )}
            </label>
          )}
          {signup && (
            <label className="check">
              <input name="acceptTerms" type="checkbox" required />
              <span>
                {t("Accept", "I accept")} <Link href="/termeni">{t("termenii", "the terms")}</Link> {t("și am citit", "and have read")}{' '}
                <Link href="/confidentialitate">{t("politica de confidențialitate", "the privacy policy")}</Link>.
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
            {translateApplicationCopy(error,language)}
          </p>
        )}
        {message && (
          <p role="status" className="notice">
            {translateApplicationCopy(message,language)}
          </p>
        )}
        <div className="stack small" style={{ marginTop: 20 }}>
          <Link href={(signup ? '/autentificare?' : '/inregistrare?') + new URLSearchParams({ next })}>
            {signup ? 'Ai deja cont? Autentifică-te' : 'Nu ai cont? Înregistrează-te'}
          </Link>
          <Link href="/recuperare-parola">Recuperează parola</Link>
        </div>
      </div>
    </main>
  );
}
