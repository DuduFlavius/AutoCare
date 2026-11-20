import {emailAssets} from './email-assets';

// Only public product artwork and installation metadata. No wildcard file/API exemptions.
const assets = new Set<string>([
  '/manifest.webmanifest', '/sw.js', '/offline.html', '/apple-splash',
  '/favicon.ico', '/favicon.svg', '/favicon-96.png', '/apple-touch-icon.png',
  '/icon-192.png', '/icon-512.png', '/brand/autocare-pearl-mark.svg',
  ...Object.values(emailAssets).map(asset=>asset.path),
  '/email/autocare-hero-1aa3b6e6cfe6.png', '/email/autocare-hero-6c2dc3e1fe8c.jpg',
  '/email/phone-5aab078200ea.png', '/email/globe-12e46bf4e21f.png',
]);
export function isMaintenancePublicAsset(path:string){return assets.has(path);}
