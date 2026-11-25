import { createHash } from 'node:crypto';
import { z } from 'zod';
import { origin } from './config';
import { AppError } from './service';

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const releaseProofSchema = z.object({
  commit: z.string().regex(/^[a-f0-9]{40}$/),
  testsPassed: z.literal(true),
  android: z.object({
    version:z.string().regex(/^\d+\.\d+\.\d+$/),
    sha256,
    signatureVerified:z.literal(true),
  }).strict().optional(),
}).strict();
export type ReleaseProof = z.infer<typeof releaseProofSchema>;

export async function verifyPublishedRelease(proof: ReleaseProof, request = fetch) {
  const fetchPublished = (path:string) => request(new URL(path,origin()), {
    cache:'no-store', signal:AbortSignal.timeout(10000), redirect:'error',
  });
  try {
    const response = await fetchPublished('/api/app-version');
    if (!response.ok || (await response.json()).version !== proof.commit) throw new Error('DEPLOYMENT_NOT_LIVE');
    if (proof.android) {
      const manifest = await fetchPublished('/api/android-update');
      if (!manifest.ok) throw new Error('APK_NOT_LIVE');
      const release = await manifest.json();
      const path = '/downloads/AutoCare-' + proof.android.version + '.apk';
      if (!release.available || release.version !== proof.android.version || release.url !== path) throw new Error('APK_NOT_LIVE');
      const apk = await fetchPublished(path);
      if (!apk.ok || !apk.body || Number(apk.headers.get('content-length')) > 64_000_000) throw new Error('APK_NOT_LIVE');
      const hash = createHash('sha256');
      let size = 0;
      const reader = apk.body.getReader();
      try {
        for (;;) {
          const {done,value}=await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > 64_000_000) throw new Error('APK_TOO_LARGE');
          hash.update(value);
        }
      } finally { await reader.cancel().catch(()=>{}); }
      if (size === 0 || hash.digest('hex') !== proof.android.sha256) throw new Error('APK_HASH_MISMATCH');
    }
  } catch {
    throw new AppError(409,'Buildul sau APK-ul verificat nu este disponibil la adresa de producție.');
  }
}
