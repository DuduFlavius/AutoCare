'use client';
import {EmailVerification} from './email-verification';
import {publicConversion} from '@/lib/analytics';
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
export function AuthForm({ mode, next = '/cont', initialLanguage, verificationPreview=false }: { mode: string; next?: string; initialLanguage?:'ro'|'en';verificationPreview?:boolean }) {
  const [language, setLanguage] = useState<'ro' | 'en'>(initialLanguage??'ro');
  useEffect(() => {
    try {
      if (!initialLanguage && (localStorage.getItem('autocare-language') === 'en' || localStorage.getItem('autocare-language') !== 'ro' && !navigator.language.toLowerCase().startsWith('ro'))) setLanguage('en');
    } catch {
      /* Preferences still work without storage. */
    }
  }, [initialLanguage]);
  useEffect(()=>{saveBrowserLanguage(language);},[language]);
  const en=language==='en';
  const t=(ro:string,english:string)=>en?english:ro;
  const [pendingEmail,setPendingEmail]=useState(verificationPreview?'demo@example.invalid':'');
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
            : await authClient.signIn.email({ email, password, callbackURL: next, rememberMe: true });
      if (result.error) {
        if(!signup&&!forgot&&!reset&&result.error.code==='EMAIL_NOT_VERIFIED'){
          const sent=await authClient.emailOtp.sendVerificationOtp({email,type:'email-verification'});
          if(sent.error)throw new Error(t('Nu am putut trimite codul. Așteaptă un minut și încearcă din nou.','Could not send the code. Wait a minute and try again.'));
          setPendingEmail(email);return;
        }
        throw new Error(authErrorMessage(result.error.code, result.error.message,language));
      }
      if(signup&&!(result.data&&'token' in result.data&&result.data.token)){setPendingEmail(email);return;}
      if(signup||!forgot&&!reset)publicConversion(signup?'sign_up':'login');
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
    <main className="auth-layout ac-auth-premium" data-verification={!!pendingEmail||undefined}>
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
        </div>{pendingEmail?<EmailVerification preview={verificationPreview} email={pendingEmail} language={language} onBack={()=>{setPendingEmail('');setError('');}} onVerified={()=>{publicConversion(signup?'sign_up':'login');window.location.assign(next);}}/>:<><p className="eyebrow">{t("GARAJUL TĂU DIGITAL", "YOUR DIGITAL GARAGE")}</p>
        <h1>
          {signup
            ? t('Creează cont','Create account')
            : forgot
              ? t('Ai uitat parola?','Forgot your password?')
              : reset
                ? t('Alege o parolă nouă.','Choose a new password.')
                : t('Bine ai revenit!', 'Welcome back!')}
        </h1>
        <p className="muted small">
          {signup
            ? t('Creează-ți contul și confirmă emailul cu un cod pentru a adăuga prima mașină.','Create your account and verify your email with a code to add your first vehicle.')
            : forgot
              ? t('Introdu emailul contului pentru a primi instrucțiunile de resetare.', 'Enter your account email to receive password reset instructions.')
              : reset
                ? t('Alege o parolă nouă de cel puțin 12 caractere.', 'Choose a new password with at least 12 characters.')
                : t('Documentele și istoricul mașinii tale, la îndemână.', 'Your vehicle documents and history, within reach.')}
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
                placeholder="Email"
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
                  placeholder={t('Parolă','Password')}
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
                {t("Accept", "I accept")} <Link href={en?'/en/terms':'/termeni'}>{t("termenii", "the terms")}</Link> {t("și am citit", "and have read")}{' '}
                <Link href={en?'/en/privacy':'/confidentialitate'}>{t("politica de confidențialitate", "the privacy policy")}</Link>.
              </span>
            </label>
          )}
          <button type="submit" className="primary" disabled={busy}>
            {busy
              ? t('Se procesează…','Processing…')
              : signup
                ? t('Trimite codul de verificare','Send verification code')
                : forgot
                  ? t('Trimite instrucțiunile','Send instructions')
                  : reset
                    ? t('Salvează parola','Save password')
                    : t('Conectare', 'Sign in')}
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
          <Link href={((signup||forgot||reset) ? (en?'/en/sign-in?':'/autentificare?') : (en?'/en/sign-up?':'/inregistrare?')) + new URLSearchParams({ next })}>
            {forgot||reset ? t('Înapoi la autentificare','Back to sign in') : signup ? t('Ai deja cont? Autentifică-te','Already have an account? Sign in') : t('Nu ai cont? Înregistrează-te','No account yet? Sign up')}
          </Link>
          {!forgot&&!reset&&<Link href={en?'/en/forgot-password':'/recuperare-parola'}>{t('Recuperează parola','Reset password')}</Link>}
        </div>
      </>} </div>
    </main>
  );
}
