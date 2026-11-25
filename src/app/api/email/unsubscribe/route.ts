import { unsubscribeEmail } from '@/lib/mail-consent';

function response(message: string, english: boolean, form = false, status = 200) {
  const action = form ? '<form method="post"><button>' + (english ? 'Unsubscribe from promotional emails' : 'Dezabonează-mă de la e-mailurile promoționale') + '</button></form>' : '';
  return new Response('<!doctype html><html lang="' + (english ? 'en' : 'ro') + '"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>AutoCare</title><main><h1>AutoCare</h1><p>' + message + '</p>' + action + '</main></html>', {
    status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow',
      'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'" },
  });
}

export function GET(request: Request) {
  const english = new URL(request.url).searchParams.get('lang') === 'en';
  return response(english ? 'Confirm that you want to stop receiving promotional emails.' : 'Confirmă că dorești să oprești e-mailurile promoționale.', english, true);
}

export async function POST(request: Request) {
  const params = new URL(request.url).searchParams;
  const english = params.get('lang') === 'en';
  const ok = await unsubscribeEmail(params.get('token') || '').catch(() => null);
  if (ok === null) return response(english ? 'Please try again later.' : 'Reîncearcă mai târziu.', english, false, 503);
  if (!ok) return response(english ? 'This link is invalid.' : 'Acest link nu mai este valid.', english, false, 400);
  return response(english ? 'You have unsubscribed. Security messages remain enabled.' : 'Te-ai dezabonat. Mesajele de securitate rămân active.', english);
}
