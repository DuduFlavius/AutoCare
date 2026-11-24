import { z } from 'zod';
import { streamLines } from './ai-stream';
import { AppError } from './service';
import { autoAssistantConfigured } from './auto-assistant-config';

const responseSchema = z.object({
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  })),
});

type InputPart = { type: 'input_text'; text: string }
  | { type: 'input_file'; filename: string; file_data: string }
  | { type: 'input_image'; image_url: string; detail: 'high' };

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

function geminiParts(input: string | { role: 'user'; content: InputPart[] }[]): GeminiPart[] {
  if (typeof input === 'string') return [{ text: input }];
  return input.flatMap(message => message.content.map(part => {
    if (part.type === 'input_text') return { text: part.text };
    const source = part.type === 'input_image' ? part.image_url : part.file_data;
    const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(source);
    if (!match || !['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(match[1]))
      throw new AppError(400, 'Format de document neacceptat de furnizorul AI.');
    return { inlineData: { mimeType: match[1], data: match[2] } };
  }));
}

async function availableGeminiModels(key: string, preferred: string, signal = AbortSignal.timeout(12000)): Promise<string[]> {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100', {
    headers: { 'x-goog-api-key': key }, cache: 'no-store', signal,
  });
  if (!response.ok) throw new AppError(502, 'Nu pot verifica modelele Gemini disponibile pentru cheia API.');
  const data: unknown = await response.json();
  const parsed = z.object({ models: z.array(z.object({
    name: z.string(), supportedGenerationMethods: z.array(z.string()).optional(),
  })).default([]) }).parse(data);
  const available = parsed.models.filter(m => m.supportedGenerationMethods?.includes('generateContent'))
    .map(m => m.name.replace(/^models\//, ''));
  const priority = [preferred, 'gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash', 'gemini-2.0-flash-lite'];
  const candidates = [...new Set([...priority, ...available.filter(m => /^gemini-.*(?:flash|pro)/.test(m))])]
    .filter(m => available.includes(m) && /^gemini-.*(?:flash|pro)/.test(m) && !/(?:tts|audio|image|live|embedding|robotics|computer-use)/i.test(m));
  if (!candidates.length) throw new AppError(503, 'Cheia API nu are niciun model Gemini Flash disponibil pentru generateContent.');
  console.info('AutoCare Gemini compatible models', { models: candidates });
  return candidates.slice(0, 10);
}

async function generateGemini(instructions: string, input: string | { role: 'user'; content: InputPart[] }[], maxTokens: number) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new AppError(503, 'Gemini nu este configurat.');
  const preferred = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash-lite';
  const models = await availableGeminiModels(key, preferred);
  const payload = JSON.stringify({
    systemInstruction: { parts: [{ text: instructions }] },
    contents: [{ role: 'user', parts: geminiParts(input) }],
    generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5 },
  });
  for (const model of models) {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(22000),
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: payload,
    });
    if (response.status === 404 || response.status === 400) {
      const details = await response.json().catch(() => ({}));
      console.error('AutoCare Gemini model rejected request', { model, httpStatus: response.status, errorCode: (details as {error?:{status?:string}}).error?.status, detail: String((details as {error?:{message?:string}}).error?.message || '').slice(0, 450) });
      continue;
    }
    if (response.status === 429) throw new AppError(429, 'Limita gratuită Gemini a fost atinsă. Încearcă mai târziu.');
    if (response.status === 401 || response.status === 403) throw new AppError(502, 'Cheia Gemini nu are acces la model. Verifică GEMINI_API_KEY.');
    if (!response.ok) {
      console.error('AutoCare Gemini request failed', { status: response.status, model });
      throw new AppError(502, 'Gemini nu a putut răspunde.');
    }
    const result: unknown = await response.json();
    const parsed = z.object({
      candidates: z.array(z.object({
        finishReason: z.string().optional(),
        content: z.object({ parts: z.array(z.object({ text: z.string().optional() }).passthrough()) }).optional(),
      })).optional(),
    }).parse(result);
    const answer = parsed.candidates?.[0]?.content?.parts.map(part => part.text || '').join('\n').trim();
    if (parsed.candidates?.[0]?.finishReason === 'MAX_TOKENS') throw new AppError(502, 'Răspunsul AI a depășit limita de generare. Reformulează întrebarea mai specific sau cere analiza pe secțiuni.');
    if (answer) return answer;
    throw new AppError(502, 'Gemini nu a returnat text. Reîncearcă.');
  }
  throw new AppError(502, 'Niciun model Gemini text disponibil nu a acceptat cererea. Verifică accesul la modele în Google AI Studio.');
}

export async function generateAi(instructions: string, input: string | { role: 'user'; content: InputPart[] }[], maxTokens = 2600) {
  if (!autoAssistantConfigured()) throw new AppError(503, 'Furnizorul AI nu este configurat.');
  if (process.env.GEMINI_API_KEY?.trim()) return generateGemini(instructions, input, maxTokens);
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      cache: 'no-store',
      signal: AbortSignal.timeout(22000),
      headers: {
        Authorization: 'Bearer ' + process.env.OPENAI_API_KEY!.trim(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.AUTOCARE_AI_MODEL!.trim(),
        store: false,
        max_output_tokens: maxTokens,
        instructions,
        input,
      }),
    });
    if (!response.ok) throw Error('Provider error');
    const providerResult: unknown = await response.json();
    if (z.object({ status: z.string().optional() }).parse(providerResult).status === 'incomplete') throw new AppError(502, 'Furnizorul AI a întrerupt răspunsul. Încearcă o întrebare mai specifică.');
    const answer = responseSchema.parse(providerResult).output
      .filter(item => item.type === 'message')
      .flatMap(item => item.content ?? [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text ?? '').join('\n').trim();
    if (!answer) throw Error('No response');
    return answer;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'Furnizorul AI nu a putut răspunde. Reîncearcă mai târziu.');
  }
}

export type AiStream = { signal: AbortSignal; delta: (text: string) => void };

async function readProviderStream(response: Response, gemini: boolean, stream: AiStream) {
  if (!response.ok || !response.body) {
    await response.body?.cancel();
    if (response.status === 429) throw new AppError(429, 'Limita furnizorului AI a fost atinsă. Încearcă mai târziu.');
    throw new AppError(502, 'Furnizorul AI nu a putut răspunde.');
  }
  let answer = '', completed = false, data: string[] = [];
  for await (const line of streamLines(response.body)) {
    stream.signal.throwIfAborted();
    if (line.startsWith('data:')) { data.push(line.slice(5).trimStart()); continue; }
    if (line || !data.length) continue;
    const payload = data.join('\n');
    data = [];
    if (payload === '[DONE]') continue;
    const event = JSON.parse(payload);
    const candidate = event.candidates?.[0];
    const delta = gemini
      ? (candidate?.content?.parts ?? []).filter((part: { thought?: boolean }) => !part.thought).map((part: { text?: string }) => part.text ?? '').join('')
      : event.type === 'response.output_text.delta' ? event.delta : '';
    if (typeof delta === 'string' && delta) { answer += delta; stream.delta(delta); }
    if (gemini ? candidate?.finishReason === 'STOP' : event.type === 'response.completed') completed = true;
    if (event.error || (gemini ? candidate?.finishReason && candidate.finishReason !== 'STOP' : ['error','response.failed','response.incomplete'].includes(event.type))) break;
    if (completed) break;
  }
  if (!completed || !answer.trim()) throw new AppError(502, 'Furnizorul AI a întrerupt răspunsul. Poți reîncerca.');
  return answer.trim();
}

export async function streamAi(instructions: string, input: string, stream: AiStream, maxTokens = 2600) {
  if (!autoAssistantConfigured()) throw new AppError(503, 'Furnizorul AI nu este configurat.');
  const signal = AbortSignal.any([stream.signal, AbortSignal.timeout(55000)]);
  const key = process.env.GEMINI_API_KEY?.trim();
  if (key) {
    const preferred = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash-lite';
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: geminiParts(input) }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5 },
    });
    async function send(model: string) {
      return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', {
        method: 'POST', cache: 'no-store', signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key! }, body: payload,
      });
    }
    let response = await send(preferred);
    if (response.status === 404 || response.status === 400) {
      await response.body?.cancel();
      for (const model of (await availableGeminiModels(key, preferred, signal)).filter(model => model !== preferred)) {
        response = await send(model);
        if (response.status !== 404 && response.status !== 400) break;
        await response.body?.cancel();
      }
    }
    return readProviderStream(response, true, stream);
  }
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', cache: 'no-store', signal,
    headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY!.trim(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: process.env.AUTOCARE_AI_MODEL!.trim(), store: false, max_output_tokens: maxTokens, instructions, input, stream: true }),
  });
  return readProviderStream(response, false, stream);
}
