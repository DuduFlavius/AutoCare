'use client';
import { Capacitor } from '@capacitor/core';
import { nativeDocumentBridge } from './native-tracking';

export async function fetchDownloadDocument(url: string, fallback: string, expectedMime?: string) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw Error(response.status === 401 ? 'SESSION_EXPIRED' : response.status === 403 ? 'FORBIDDEN' : 'DOWNLOAD_FAILED');
  const mime = (response.headers.get('content-type') ?? '').split(';')[0];
  if (expectedMime && mime !== expectedMime) throw Error('DOWNLOAD_FAILED');
  const disposition = response.headers.get('content-disposition') ?? '';
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  let name = disposition.match(/filename="([^"]+)"/i)?.[1] ?? fallback;
  if (encoded) {
    try { name = decodeURIComponent(encoded[1]); } catch { /* Preserve the safe fallback. */ }
  }
  const blob = await response.blob();
  if (!blob.size || (mime === 'application/pdf' && await blob.slice(0,5).text() !== '%PDF-')) throw Error('DOWNLOAD_FAILED');
  return { blob, name: name.replace(/[\\/\r\n]/g, '_'), mime };
}

async function nativeFile(file: Awaited<ReturnType<typeof fetchDownloadDocument>>) {
  const bytes = new Uint8Array(await file.blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return { name: file.name, mime: file.mime, data: btoa(binary) };
}

function bridgeError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  return code === 'UNIMPLEMENTED' || code === 'UNAVAILABLE' ? 'ANDROID_UPDATE_REQUIRED' : code;
}

export function nativeDocumentPlatform() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function nativeReportShareAvailable() {
  if (!nativeDocumentPlatform()) return false;
  try { return (await nativeDocumentBridge.version()).versionCode >= 27; }
  catch { return false; }
}

export async function downloadDocument(url: string, name: string, expectedMime?: string) {
  const file = await fetchDownloadDocument(url, name, expectedMime);
  if (nativeDocumentPlatform()) {
    if (file.mime === 'text/csv' && !await nativeReportShareAvailable()) throw Error('ANDROID_UPDATE_REQUIRED');
    try {
      const result = await nativeDocumentBridge.save(await nativeFile(file));
      if (result.saved) return 'saved';
      throw Error('DOWNLOAD_FAILED');
    } catch (error) {
      const code = bridgeError(error);
      if (code === 'DOCUMENT_SAVE_CANCELLED') return 'cancelled';
      throw Error(code || 'DOWNLOAD_FAILED', {cause:error});
    }
  }
  const object = URL.createObjectURL(file.blob);
  const anchor = document.createElement('a');
  anchor.href = object;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(object), 60000);
  return 'started';
}

export async function shareDocument(url: string, name: string, expectedMime: string) {
  const file = await fetchDownloadDocument(url, name, expectedMime);
  try { await nativeDocumentBridge.share(await nativeFile(file)); }
  catch (error) { throw Error(bridgeError(error) || 'DOWNLOAD_FAILED', {cause:error}); }
}

export function documentDownloadError(error: unknown, en: boolean) {
  const code = error instanceof Error ? error.message : '';
  if (code === 'SESSION_EXPIRED') return en ? 'Sign in again to download the document.' : 'Reconectează-te pentru a descărca documentul.';
  if (code === 'FORBIDDEN') return en ? 'Your account does not have access to this document.' : 'Contul tău nu are acces la acest document.';
  if (code === 'ANDROID_UPDATE_REQUIRED') return en ? 'Update AutoCare to use this Android action.' : 'Actualizează AutoCare pentru a folosi această acțiune pe Android.';
  return en ? 'The document could not be saved or shared. Try again.' : 'Documentul nu a putut fi salvat sau distribuit. Încearcă din nou.';
}
