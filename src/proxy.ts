import { NextRequest, NextResponse } from 'next/server';
import { canonicalDocumentURL } from '@/lib/canonical';
import { origin } from '@/lib/config';
export function proxy(request: NextRequest) {
  const destination = canonicalDocumentURL(
    request.url,
    request.method,
    origin(),
    process.env.VERCEL_ENV,
  );
  return destination ? NextResponse.redirect(destination, 307) : NextResponse.next();
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|icon-192.png|icon-512.png|icon.svg).*)'],
};
