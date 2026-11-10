export function autoAssistantConfigured() {
  return Boolean(
    process.env.GEMINI_API_KEY?.trim() ||
    (process.env.OPENAI_API_KEY?.trim() && process.env.AUTOCARE_AI_MODEL?.trim()),
  );
}
