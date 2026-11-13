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
  if(destination)return NextResponse.redirect(destination,307);
  const headers=new Headers(request.headers);
  headers.set('x-autocare-public-language',request.nextUrl.pathname==='/en'||request.nextUrl.pathname.startsWith('/en/')?'en':'ro');
  return NextResponse.next({request:{headers}});
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|icon-192.png|icon-512.png|icon.svg).*)'],
};
