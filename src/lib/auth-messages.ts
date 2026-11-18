export function authErrorMessage(code?: string, fallback?: string, language:'ro'|'en'='ro') {
  const messages: Record<string, string> = {
    EMAIL_NOT_VERIFIED: 'Confirmă adresa de email folosind codul primit.',
    INVALID_OTP: 'Codul nu este corect. Verifică mesajul primit și încearcă din nou.',
    OTP_EXPIRED: 'Codul a expirat. Solicită un cod nou.',
    TOO_MANY_ATTEMPTS: 'Ai introdus prea multe coduri greșite. Solicită un cod nou.',
    INVALID_EMAIL_OR_PASSWORD:
      'Emailul sau parola nu sunt corecte. Verifică datele și încearcă din nou.',
    INVALID_EMAIL: 'Introdu o adresă de email validă.',
    USER_ALREADY_EXISTS:
      'Există deja un cont cu această adresă. Intră în cont sau recuperează parola.',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
      'Există deja un cont cu această adresă. Intră în cont sau recuperează parola.',
    PASSWORD_TOO_SHORT: 'Parola trebuie să aibă cel puțin 12 caractere.',
    INVALID_ORIGIN: 'Deschide AutoCare la adresa oficială și încearcă din nou.',
    TOO_MANY_REQUESTS: 'Prea multe încercări. Așteaptă un minut și încearcă din nou.',
  };
  const english:Record<string,string>={
    INVALID_EMAIL_OR_PASSWORD:'The email or password is incorrect. Check your details and try again.',INVALID_EMAIL:'Enter a valid email address.',USER_ALREADY_EXISTS:'An account already uses this email. Sign in or reset your password.',USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:'An account already uses this email. Sign in or reset your password.',PASSWORD_TOO_SHORT:'Your password must contain at least 12 characters.',INVALID_ORIGIN:'Open AutoCare at its official address and try again.',TOO_MANY_REQUESTS:'Too many attempts. Wait a minute and try again.',EMAIL_NOT_VERIFIED:'Verify your email using the code you received.',INVALID_OTP:'The code is incorrect. Check your email and try again.',OTP_EXPIRED:'The code expired. Request a new one.',TOO_MANY_ATTEMPTS:'Too many incorrect codes. Request a new one.'
  };
  if(language==='en')return code&&english[code]||fallback||'Could not complete this action. Try again.';
  return (
    (code && messages[code]) || fallback || 'Nu am putut finaliza operațiunea. Încearcă din nou.'
  );
}
