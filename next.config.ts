import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  outputFileTracingIncludes: { '/api/android-update': ['./public/downloads/**/*'] },
  env: { NEXT_PUBLIC_AUTOCARE_BUILD: process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || process.env.RENDER_GIT_COMMIT || "development" },
  serverExternalPackages: ['@electric-sql/pglite'],
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }] },
      ...['/api/:path*', '/cont', '/admin', '/start', '/previzualizare', '/dosar/:path*', '/autentificare', '/inregistrare', '/recuperare-parola', '/resetare-parola', '/en/sign-in', '/en/sign-up', '/en/forgot-password', '/en/reset-password'].map((source) => ({
        source,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com https://tile.openstreetmap.org https://tiles.openfreemap.org; font-src 'self'; connect-src 'self' https://tiles.openfreemap.org https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com; worker-src 'self'; frame-src 'self' https://www.openstreetmap.org https://checkout.stripe.com https://billing.stripe.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
          },
        ],
      },
      // The synthetic design preview may be framed only by this same site for
      // accurate mobile viewport review. Private/account pages retain DENY.
      {
        source: '/previzualizare',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://images.unsplash.com https://tile.openstreetmap.org https://tiles.openfreemap.org; font-src 'self'; connect-src 'self' https://tiles.openfreemap.org https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com; worker-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
        ],
      },
    ];
  },
};
export default config;
