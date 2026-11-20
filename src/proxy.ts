import { NextRequest, NextResponse } from 'next/server';
import { canonicalDocumentURL } from '@/lib/canonical';
import { origin } from '@/lib/config';
import {isMaintenancePublicAsset} from '@/lib/maintenance-public-assets';

const open = ['/api/auth/', '/api/maintenance-access', '/autentificare', '/inregistrare', '/recuperare-parola', '/en/sign-in', '/en/sign-up', '/en/forgot-password', '/mentenanta', '/favicon.ico', '/robots.txt', '/sitemap.xml'];
function exempt(path: string) {
  return isMaintenancePublicAsset(path) || open.some(p => path === p || (p.endsWith('/') && path.startsWith(p))) ||
    path.startsWith('/api/webhooks/') || path.startsWith('/api/webhook/') ||
    path.startsWith('/api/cron/') || path.startsWith('/api/stripe/webhook');
}
export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (process.env.VERCEL_ENV !== 'preview' && !exempt(path)) {
    let allowed = false;
    try {
      const result = await fetch(new URL('/api/maintenance-access', request.url), {
        headers: { cookie: request.headers.get('cookie') ?? '' },
        cache: 'no-store',
        signal: AbortSignal.timeout(3500),
      });
      allowed = result.ok && (await result.json()).allowed === true;
    } catch { /* Fail closed if authentication is unavailable. */ }
    if (!allowed) {
      if (path.startsWith('/api/')) {
        return NextResponse.json({ error: 'MAINTENANCE', message: 'AutoCare Premium este temporar în mentenanță.' }, { status: 503, headers: { 'Retry-After': '3600', 'Cache-Control': 'no-store' } });
      }
      return NextResponse.redirect(new URL('/mentenanta', request.url), 307);
    }
  }
  const destination = canonicalDocumentURL(request.url, request.method, origin(), process.env.VERCEL_ENV);
  if (destination) return NextResponse.redirect(destination, 307);
  return NextResponse.next();
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|icon-192.png|icon-512.png|icon.svg).*)'],
};
