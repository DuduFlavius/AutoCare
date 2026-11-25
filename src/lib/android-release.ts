import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

type ReleaseNotes = { publishedAt?: string; changes?: { ro: string[]; en: string[] } };
type AndroidRelease = ReleaseNotes & {
  version: string;
  versionCode: number;
  url: string;
  bytes: number;
  minSdk?: number;
  previous?: ({ version: string } & ReleaseNotes)[];
};

export function readAndroidRelease(): AndroidRelease | null {
  try {
    const directory = path.join(process.cwd(), 'public', 'downloads');
    const release = JSON.parse(readFileSync(path.join(directory, 'android-release.json'), 'utf8'));
    if (typeof release.version !== 'string' || !/^\d+\.\d+\.\d+$/.test(release.version) ||
        !Number.isSafeInteger(release.versionCode) || release.versionCode < 1 ||
        release.url !== '/downloads/AutoCare-' + release.version + '.apk') return null;
    const file = statSync(path.join(directory, path.basename(release.url)));
    if (!file.isFile() || file.size === 0) return null;
    return { ...release, bytes: file.size };
  } catch {
    return null;
  }
}

export function formatReleaseDate(value: string | undefined, locale: 'ro-RO' | 'en-GB') {
  const time = value ? Date.parse(value) : NaN;
  return Number.isFinite(time) ? new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'Europe/Bucharest' }).format(time) : null;
}
