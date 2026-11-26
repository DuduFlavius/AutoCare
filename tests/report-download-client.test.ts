import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentDownloadError, fetchDownloadDocument } from '../src/lib/document-download-client';

test('report downloads reject incorrect or corrupt data before starting a browser or native save', async context => {
  const fetch = context.mock.method(globalThis,'fetch',async () => new Response('fake', {headers:{'Content-Type':'application/pdf'}}));
  await assert.rejects(fetchDownloadDocument('/report','report.pdf','application/pdf'),/DOWNLOAD_FAILED/);
  fetch.mock.mockImplementation(async () => new Response('<html>Sign in</html>', {headers:{'Content-Type':'text/html'}}));
  await assert.rejects(fetchDownloadDocument('/report','report.pdf','application/pdf'),/DOWNLOAD_FAILED/);
  fetch.mock.mockImplementation(async () => new Response(null,{status:401}));
  await assert.rejects(fetchDownloadDocument('/report','report.pdf','application/pdf'),/SESSION_EXPIRED/);
  fetch.mock.mockImplementation(async () => new Response('%PDF-1.6', {
    headers:{'Content-Type':'application/pdf','Content-Disposition':"attachment; filename*=UTF-8''revizii%20lunare.pdf"},
  }));
  const file = await fetchDownloadDocument('/report','report.pdf','application/pdf');
  assert.equal(file.name,'revizii lunare.pdf');
  assert.equal(file.mime,'application/pdf');
  assert.match(documentDownloadError(Error('SESSION_EXPIRED'),true),/Sign in/);
});
