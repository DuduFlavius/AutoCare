import type { MetadataRoute } from 'next';
import { origin } from '@/lib/config';
import { indexableSlugs } from '@/lib/seo';
import { guides } from '@/lib/guides';
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    '',
    ...indexableSlugs,
    'ghiduri',
    ...Object.keys(guides).map((slug) => 'ghiduri/' + slug),
  ].map((path) => ({
    url: new URL('/' + path, origin()).toString(),
    ...(path.startsWith('ghiduri/') ? { lastModified: '2026-10-20T07:26:00.000Z' } : {}),
    ...(path === '' ? { images: [origin() + '/images/aplicatie-intretinere-auto.webp'] } : {}),
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
}
