export function autoAssistantConfigured() {
  return Boolean(process.env.OPENAI_API_KEY?.trim() && process.env.AUTOCARE_AI_MODEL?.trim());
}
