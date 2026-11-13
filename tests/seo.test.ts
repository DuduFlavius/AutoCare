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
      /\/(?:cont|admin|api|autentificare|inregistrare|previzualizare|confidentialitate|termeni)(?:\/|$)/,
    );
  }
  assert.ok(entries[0].images?.[0].endsWith('.png'));
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

test('Application discovery follows the canonical domain and exposes only public sources', async () => {
  const { GET } = await import('../src/app/llms.txt/route');
  const response = GET();
  const content = await response.text();
  assert.match(response.headers.get('content-type') || '', /text\/plain/);
  assert.ok(content.includes(process.env.APP_URL + '/aplicatie-auto'));
  assert.doesNotMatch(content, /\/cont|\/api\/|project-sxage/);
  assert.ok(sitemap().some(entry => entry.url.endsWith('/aplicatie-auto')));
});

test('Every indexable page has reciprocal RO/EN URLs, including guides, with private auth pages excluded', async()=>{
 const {publicRoutePairs,publicLanguageAlternates,romanianPublicPath}=await import('../src/lib/public-routes');
 const paths=['/',...indexableSlugs.map(slug=>'/'+slug),'/ghiduri',...Object.keys(guides).map(slug=>'/ghiduri/'+slug)];
 for(const path of paths){
  assert.ok(publicRoutePairs[path],path);
  const ro=publicLanguageAlternates(path,process.env.APP_URL!);const en=publicLanguageAlternates(publicRoutePairs[path],process.env.APP_URL!);
  assert.deepEqual(ro,en,path);assert.equal(romanianPublicPath(publicRoutePairs[path]),path);
  assert.equal(ro?.ro,process.env.APP_URL+path);assert.equal(ro?.en,process.env.APP_URL+publicRoutePairs[path]);
 }
 for(const entry of sitemap()){assert.ok(entry.alternates?.languages);assert.doesNotMatch(entry.url,/sign-in|sign-up|forgot-password|reset-password|compare-plans|comparatie/);}
});
test('English public editorial content and guides are translated at the server data boundary',async()=>{
 const {pages}=await import('../src/lib/pages');const {englishPage,englishGuide}=await import('../src/lib/public-content');
 for(const slug of Object.keys(pages)){
  const page=englishPage(slug)!;assert.ok(page?.title&&page.intro,slug);
  for(const text of [page.title,page.intro,...page.sections.flat()])assert.doesNotMatch(text,/[ăâîșțĂÂÎȘȚ]/,slug+': '+text);
 }
 for(const slug of Object.keys(guides)){const guide=englishGuide(slug)!;for(const text of [guide.title,guide.description,...guide.sections.flat()])assert.doesNotMatch(text,/[ăâîșțĂÂÎȘȚ]/,slug);}
});
test('Analytics rejects placeholder IDs and unknown events without exposing user data',async()=>{
 const {analyticsMeasurementId,analyticsEventAllowed}=await import('../src/lib/analytics');
 assert.equal(analyticsMeasurementId(undefined),null);assert.equal(analyticsMeasurementId('G-XXXX'),null);assert.equal(analyticsMeasurementId('<script>'),null);
 assert.equal(analyticsEventAllowed('sign_up'),true);assert.equal(analyticsEventAllowed('document_uploaded'),false);
});

test('Robots keeps account URLs private without accidentally blocking the public contact page',()=>{
 const rule=robots().rules;assert.ok(!Array.isArray(rule));
 const values=Array.isArray(rule.disallow)?rule.disallow:[rule.disallow];
 assert.ok(values.includes('/cont$'));assert.ok(values.includes('/cont?'));assert.ok(!values.includes('/cont'));
 assert.ok(indexableSlugs.includes('contact'));
});
