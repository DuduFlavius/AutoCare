import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalDocumentURL } from '../src/lib/canonical';
import { authErrorMessage } from '../src/lib/auth-messages';
const canonical = 'https://autocare-garaj.vercel.app';
const deployment = 'https://autocare-garaj-mgzwjuw1k-roomlyy.vercel.app';
test('Deployment and legacy document links redirect to canonical while preserving the requested page', () => {
  for (const host of [
    deployment,
    'https://project-z0iz5.vercel.app',
    'https://autocare-garaj-roomlyy.vercel.app',
  ]) {
    assert.equal(
      canonicalDocumentURL(host + '/autentificare?next=%2Fcont', 'GET', canonical, 'production')
        ?.href,
      canonical + '/autentificare?next=%2Fcont',
    );
    assert.equal(
      canonicalDocumentURL(host + '/inregistrare', 'HEAD', canonical, 'production')?.origin,
      canonical,
    );
  }
  assert.equal(
    canonicalDocumentURL(deployment + '//example.invalid/path', 'GET', canonical, 'production')
      ?.origin,
    canonical,
  );
});
test('Canonical navigation leaves API mutations, other projects, development and preview trust unchanged', () => {
  for (const url of [
    canonical + '/cont',
    'https://other.vercel.app/autentificare',
    'https://autocare-garaj-example-evil.vercel.app/autentificare',
    'https://autocare-garaj-mgzwjuw1k-roomlyy.vercel.app.evil.invalid/autentificare',
  ])
    assert.equal(canonicalDocumentURL(url, 'GET', canonical, 'production'), null);
  assert.equal(
    canonicalDocumentURL(deployment + '/api/auth/sign-in/email', 'POST', canonical, 'production'),
    null,
  );
  assert.equal(
    canonicalDocumentURL(deployment + '/api/v1/dashboard', 'GET', canonical, 'production'),
    null,
  );
  assert.equal(
    canonicalDocumentURL(deployment + '/_next/static/a.js', 'GET', canonical, 'production'),
    null,
  );
  assert.equal(
    canonicalDocumentURL(deployment + '/inregistrare', 'GET', canonical, 'preview'),
    null,
  );
  assert.equal(
    canonicalDocumentURL(
      deployment + '/inregistrare',
      'GET',
      'http://localhost:3000',
      'production',
    ),
    null,
  );
});
test('Authentication failures explain wrong credentials, duplicate accounts and origin mismatch in Romanian', () => {
  assert.match(authErrorMessage('INVALID_EMAIL_OR_PASSWORD'), /Emailul sau parola/);
  assert.match(authErrorMessage('USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'), /Există deja un cont/);
  assert.match(authErrorMessage('INVALID_ORIGIN'), /adresa oficială/);
  assert.equal(authErrorMessage('UNKNOWN', 'Mesaj util'), 'Mesaj util');
});
