export function authErrorMessage(code?: string, fallback?: string) {
  const messages: Record<string, string> = {
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
  return (
    (code && messages[code]) || fallback || 'Nu am putut finaliza operațiunea. Încearcă din nou.'
  );
}
