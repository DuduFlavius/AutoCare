import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateAi } from '../src/lib/ai-provider';
import { autoAssistantProvider } from '../src/lib/auto-assistant-config';

test('Gemini uses server credentials, limits generation, supports inline documents and hides thought parts', async t => {
  delete process.env.OPENAI_API_KEY;
  delete process.env.AUTOCARE_AI_MODEL;
  process.env.GEMINI_API_KEY = 'isolated-test-key';
  process.env.GEMINI_MODEL = 'models/gemini-test';
  t.after(() => { delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL; });
  assert.equal(autoAssistantProvider(), 'gemini');
  const provider = t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    assert.doesNotMatch(url, /isolated-test-key/);
    const payload = JSON.parse(String(options.body));
    assert.equal(payload.generationConfig.candidateCount, 1);
    assert.ok(payload.generationConfig.maxOutputTokens <= 2800);
    assert.equal(payload.systemInstruction.parts[0].text, 'Answer naturally.');
    assert.equal(payload.contents[0].parts[1].inlineData.mimeType, 'application/pdf');
    return Response.json({ candidates: [{ content: { parts: [{ text: 'Hidden', thought: true }, { text: 'Salut! Cu ce te pot ajuta?' }] } }] });
  });
  const answer = await generateAi('Answer naturally.', [{ role: 'user', content: [
    { type: 'input_text', text: 'Extract document' },
    { type: 'input_file', filename: 'document.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' },
  ] }]);
  assert.equal(answer, 'Salut! Cu ce te pot ajuta?');
  assert.equal(provider.mock.callCount(), 1);
  provider.mock.restore();
  t.mock.method(globalThis, 'fetch', async () => new Response('secret-provider-error', { status: 403 }));
  await assert.rejects(() => generateAi('Answer naturally.', 'Hello'), error =>
    error instanceof Error && !error.message.includes('secret-provider-error') && !error.message.includes('isolated-test-key'));
});
