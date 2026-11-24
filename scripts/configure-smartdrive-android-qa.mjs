import {readFile, writeFile} from 'node:fs/promises';

const raw = process.env.AUTOCARE_QA_PREVIEW_URL;
if (!raw) throw new Error('Set AUTOCARE_QA_PREVIEW_URL to the isolated AutoCare preview.');
const preview = new URL(raw);
// Accept only the dedicated QA Git branch alias of the existing Vercel project.
if (preview.protocol !== 'https:' || preview.username || preview.password || preview.port ||
    preview.search || preview.hash || !['/', '/cont'].includes(preview.pathname) ||
    !/^auto-care-git-smartdrive-61-qa(?:-[a-f0-9]{6,12})?-auto-care4\.vercel\.app$/.test(preview.hostname)) {
  throw new Error('The QA APK requires an AutoCare Vercel preview URL for the smartdrive-61-qa branch.');
}
if (process.argv.includes('--check')) process.exit(0);
const configFile = new URL('../mobile/capacitor.config.json', import.meta.url);
const config = JSON.parse(await readFile(configFile, 'utf8'));
preview.pathname = '/cont';
config.server.url = preview.href;
await writeFile(configFile, JSON.stringify(config, null, 2) + '\n');
