import { z } from 'zod';
import { AppError } from './service';
import { autoAssistantProvider } from './auto-assistant-config';

const responseSchema = z.object({
  output: z.array(z.object({
    type: z.string(),
    content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
  })),
});

type InputPart = { type: 'input_text'; text: string }
  | { type: 'input_file'; filename: string; file_data: string }
  | { type: 'input_image'; image_url: string; detail: 'high' };

export async function generateAi(instructions: string, input: string | { role: 'user'; content: InputPart[] }[], maxTokens = 950) {
  const provider = autoAssistantProvider();
  if (!provider) throw new AppError(503, 'Furnizorul AI nu este configurat.');
  try {
    if (provider === 'gemini') {
      const contents = typeof input === 'string'
        ? [{ role: 'user', parts: [{ text: input }] }]
        : input.map(message => ({
          role: message.role,
          parts: message.content.map(part => {
            if (part.type === 'input_text') return { text: part.text };
            const dataUrl = part.type === 'input_file' ? part.file_data : part.image_url;
            const data = /^data:(application\/pdf|image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
            if (!data) throw Error('Invalid attachment');
            return { inlineData: { mimeType: data[1], data: data[2] } };
          }),
        }));
      const model = process.env.GEMINI_MODEL!.trim().replace(/^models\//, '');
      if (!/^[A-Za-z0-9._-]+$/.test(model)) throw Error('Invalid model');
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
        method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(22000),
        headers: { 'x-goog-api-key': process.env.GEMINI_API_KEY!.trim(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: instructions }] },
          contents, generationConfig: { maxOutputTokens: Math.min(2800, maxTokens * 3), candidateCount: 1 },
        }),
      });
      if (!response.ok) throw Error('Provider error');
      const data = z.object({
        candidates: z.array(z.object({
          content: z.object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() })) }).optional(),
        })).optional(),
      }).parse(await response.json());
      const answer = (data.candidates?.[0]?.content?.parts ?? []).filter(part => !part.thought).map(part => part.text ?? '').join('\n').trim();
      if (!answer) throw Error('No response');
      return answer.slice(0, 5000);
    }
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
