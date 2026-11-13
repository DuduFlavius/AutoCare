import { publicLanguageAlternates, publicRoutePairs } from '@/lib/public-routes';
import type { MetadataRoute } from 'next';
import { origin } from '@/lib/config';
import { indexableSlugs } from '@/lib/seo';
import { guides } from '@/lib/guides';
export default function sitemap(): MetadataRoute.Sitemap {
  const entries = [
    '',
    ...indexableSlugs,
    'ghiduri',
    ...Object.keys(guides).map((slug) => 'ghiduri/' + slug),
  ].map((path) => ({
    url: new URL('/' + path, origin()).toString(),
    alternates: { languages: publicLanguageAlternates('/' + path, origin()) ?? {} },
    ...(path.startsWith('ghiduri/') ? { lastModified: '2026-10-20T07:26:00.000Z' } : {}),
    ...(path === '' ? { images: [origin() + '/icon-512.png'] } : {}),
    ...(['documente-auto', 'intretinere-auto', 'cheltuieli-auto'].includes(path)
      ? {
          images: [
            origin() +
              '/images/' +
              (
                {
                  'documente-auto': 'organizare-documente-auto.svg',
                  'intretinere-auto': 'istoric-intretinere-auto.svg',
                  'cheltuieli-auto': 'evidenta-cheltuieli-auto.svg',
                } as Record<string, string>
              )[path],
          ],
        }
      : {}),
  }));
  return entries.flatMap(entry => {
    const path=new URL(entry.url).pathname;
    return publicRoutePairs[path] ? [entry,{url:new URL(publicRoutePairs[path],origin()).href,alternates:entry.alternates}] : [entry];
  });
}
