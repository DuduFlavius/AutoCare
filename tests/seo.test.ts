import { test } from 'node:test';
import assert from 'node:assert/strict';
import sitemap from '../src/app/sitemap';
import robots from '../src/app/robots';
import { indexableSlugs, publicMetadata, serializeJsonLd, publicTopics } from '../src/lib/seo';
import { guides } from '../src/lib/guides';
process.env.APP_URL = 'https://autocare-garaj.vercel.app';
test('SEO sitemap contains canonical public pages and image URLs without private or draft content', () => {
  const entries = sitemap();
  const urls = entries.map((x) => x.url);
  assert.equal(new Set(urls).size, urls.length);
  for (const slug of indexableSlugs) assert.ok(urls.includes(process.env.APP_URL + '/' + slug));
  for (const slug of Object.keys(guides))
    assert.ok(urls.includes(process.env.APP_URL + '/ghiduri/' + slug));
  for (const url of urls) {
    assert.ok(url.startsWith(process.env.APP_URL + '/'));
    assert.doesNotMatch(
      url,
      /cont$|admin|api\/|autentificare|inregistrare|previzualizare|confidentialitate|termeni/,
    );
  }
  assert.ok(entries[0].images?.[0].endsWith('.webp'));
  const rules = robots().rules;
  assert.ok(!Array.isArray(rules) && rules.allow === '/');
});
test('Public metadata has matching canonical, Open Graph URL and real absolute share image', () => {
  const meta = publicMetadata('Documente', 'Organizare documente', '/documente-auto');
  assert.equal(meta.alternates?.canonical, process.env.APP_URL + '/documente-auto');
  assert.equal(meta.openGraph?.url, meta.alternates?.canonical);
  assert.ok(meta.twitter && 'card' in meta.twitter);
  assert.equal(meta.twitter.card, 'summary_large_image');
  assert.equal(Object.keys(publicTopics).length, 3);
  assert.equal(Object.keys(guides).length, 3);
});
test('JSON-LD escapes script-closing content and stays valid JSON', () => {
  const data = { name: '</script><script>bad</script>' };
  const result = serializeJsonLd(data);
  assert.doesNotMatch(result, /</);
  assert.deepEqual(JSON.parse(result), data);
});

test('Google verification accepts a real-format token or HTML tag, never arbitrary markup', async () => {
  const { parseGoogleVerification } = await import('../src/lib/google-verification');
  const token = 'test_VerificationToken-123456789';
  assert.equal(parseGoogleVerification(token), token);
  assert.equal(
    parseGoogleVerification('<meta content="' + token + '" name="google-site-verification">'),
    token,
  );
  assert.throws(() => parseGoogleVerification('<meta name="other" content="' + token + '">'));
  assert.throws(() => parseGoogleVerification('<script>alert(1)</script>'));
  assert.throws(() => parseGoogleVerification(''));
});
