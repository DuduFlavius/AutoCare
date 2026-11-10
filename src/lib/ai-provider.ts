import { z } from 'zod';
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

async function generateGemini(instructions: string, input: string | { role: 'user'; content: InputPart[] }[], maxTokens: number) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new AppError(503, 'Gemini nu este configurat.');
  const model = process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash-lite';
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(22000),
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: geminiParts(input) }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.5 },
    }),
  });
  if (!response.ok) {
    if (response.status === 429) throw new AppError(429, 'Limita gratuită Gemini a fost atinsă. Încearcă mai târziu.');
    throw new AppError(502, 'Gemini nu a putut răspunde. Verifică modelul și cheia API.');
  }
  const result: unknown = await response.json();
  const parsed = z.object({
    candidates: z.array(z.object({
      content: z.object({ parts: z.array(z.object({ text: z.string().optional() }).passthrough()) }).optional(),
    })).optional(),
  }).parse(result);
  const answer = parsed.candidates?.[0]?.content?.parts.map(part => part.text || '').join('\n').trim();
  if (!answer) throw new AppError(502, 'Gemini nu a returnat un răspuns. Reîncearcă.');
  return answer.slice(0, 5000);
}

export async function generateAi(instructions: string, input: string | { role: 'user'; content: InputPart[] }[], maxTokens = 950) {
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
    const answer = responseSchema.parse(await response.json()).output
      .filter(item => item.type === 'message')
      .flatMap(item => item.content ?? [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text ?? '').join('\n').trim();
    if (!answer) throw Error('No response');
    return answer.slice(0, 5000);
  } catch {
    throw new AppError(502, 'Furnizorul AI nu a putut răspunde. Reîncearcă mai târziu.');
  }
}
