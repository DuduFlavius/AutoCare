/** Stable conversation grouping. Legacy turns stay readable without rewriting them. */
export type AiTurn = { id: string; question: string; answer: string; createdAt: string; conversationId?: string | null; feedback?: number | null };
export function conversationKey(turn: AiTurn) { return turn.conversationId || 'legacy:' + turn.createdAt.slice(0, 10); }
export function conversationGroups(turns: AiTurn[]) {
  const groups = new Map<string, { id: string; title: string; updatedAt: string; turns: AiTurn[] }>();
  for (const turn of turns) {
    const id = conversationKey(turn);
    const group = groups.get(id);
    if (group) { group.turns.push(turn); group.updatedAt = turn.createdAt; }
    else groups.set(id, { id, title: turn.question.replace(/\s+/g, ' ').trim().slice(0, 72), updatedAt: turn.createdAt, turns: [turn] });
  }
  return [...groups.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
export function assistantLanguageInstruction(language: 'ro' | 'en') {
  return language === 'en'
    ? 'LANGUAGE REQUIREMENT: Write the entire answer in English, including greetings, headings and lists. The selected interface language overrides the language of previous replies and vehicle records. Never switch language because older assistant messages use Romanian.'
    : 'CERINȚĂ DE LIMBĂ: Scrie întregul răspuns în română, cu diacritice, inclusiv salutul, titlurile și listele. Limba selectată în interfață are prioritate față de limba mesajelor anterioare și a datelor mașinii. Nu continua în engleză doar fiindcă răspunsurile anterioare sunt în engleză.';
}
