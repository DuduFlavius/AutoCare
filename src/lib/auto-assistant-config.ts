export function autoAssistantProvider(): 'openai' | 'gemini' | null {
  if (process.env.OPENAI_API_KEY?.trim() && process.env.AUTOCARE_AI_MODEL?.trim()) return 'openai';
  if (process.env.GEMINI_API_KEY?.trim() && process.env.GEMINI_MODEL?.trim()) return 'gemini';
  return null;
}
export function autoAssistantConfigured() {
  return autoAssistantProvider() !== null;
}
