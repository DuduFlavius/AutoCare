import type { MetadataRoute } from 'next';
import { origin } from '@/lib/config';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/cont',
        '/admin',
        '/start',
        '/previzualizare',
        '/api/',
        '/autentificare',
        '/inregistrare',
        '/recuperare-parola',
        '/resetare-parola',
      ],
    },
    sitemap: origin() + '/sitemap.xml',
  };
}
