import { readAndroidRelease } from '@/lib/android-release';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  const headers = { 'Cache-Control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=30' };
  const release = readAndroidRelease();
  return Response.json(release ? {
    available: true,
    version: release.version,
    versionCode: release.versionCode,
    url: release.url,
  } : { available: false }, { headers });
}
