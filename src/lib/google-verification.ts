import { z } from 'zod';
export function parseGoogleVerification(input: string) {
  const raw = input.trim();
  const token = raw.startsWith('<')
    ? /name\s*=\s*["']google-site-verification["']/i.test(raw)
      ? raw.match(/content\s*=\s*["']([A-Za-z0-9_-]+)["']/i)?.[1] || ''
      : ''
    : raw;
  return z
    .string()
    .regex(
      /^[A-Za-z0-9_-]{10,256}$/,
      'Copiază codul sau eticheta HTML google-site-verification primită din Google Search Console.',
    )
    .parse(token);
}
