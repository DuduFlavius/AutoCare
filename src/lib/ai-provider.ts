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

export async function generateAi(instructions: string, input: string | { role: 'user'; content: InputPart[] }[], maxTokens = 950) {
  if (!autoAssistantConfigured()) throw new AppError(503, 'Furnizorul AI nu este configurat.');
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
