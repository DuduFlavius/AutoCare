/** Stable conversation grouping. Legacy turns stay readable without rewriting them. */
export type AiTurn = { id: string; question: string; answer: string; createdAt: string; conversationId?: string | null; feedback?: number | null };
export const AI_HISTORY_LIMIT = 200;
export function conversationKey(turn: AiTurn) { return turn.conversationId || 'legacy:' + turn.createdAt.slice(0, 10); }
export const aiTitlesKey = (uid: string) => 'auto-ai-titles:' + uid;
export function conversationGroups(turns: AiTurn[], titles: Record<string,string> = {}) {
  const groups = new Map<string, { id: string; title: string; updatedAt: string; turns: AiTurn[] }>();
  for (const turn of turns) {
    const id = conversationKey(turn);
    const group = groups.get(id);
    if (group) { group.turns.push(turn); group.updatedAt = turn.createdAt; }
    else groups.set(id, { id, title: titles[id] || turn.question.replace(/\s+/g, ' ').trim().slice(0, 72), updatedAt: turn.createdAt, turns: [turn] });
  }
  return [...groups.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function conversationSections(groups: ReturnType<typeof conversationGroups>, now = new Date()) {
  const boundaries = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const today = boundaries.getTime();
  const yesterday = boundaries.setDate(boundaries.getDate() - 1);
  const week = boundaries.setDate(boundaries.getDate() - 5);
  const sections: { key: 'today' | 'yesterday' | 'week' | 'older'; groups: typeof groups }[] = [
    { key: 'today', groups: [] },
    { key: 'yesterday', groups: [] },
    { key: 'week', groups: [] },
    { key: 'older', groups: [] },
  ];
  for (const group of groups) {
    const updated = Date.parse(group.updatedAt);
    const index = updated >= today ? 0 : updated >= yesterday ? 1 : updated >= week ? 2 : 3;
    sections[index].groups.push(group);
  }
  return sections.filter(section => section.groups.length);
}
export function assistantLanguageInstruction(language: 'ro' | 'en') {
  return language === 'en'
    ? 'LANGUAGE REQUIREMENT: Write the entire answer in English, including greetings, headings and lists. The selected interface language overrides the language of previous replies and vehicle records. Never switch language because older assistant messages use Romanian.'
    : 'CERINȚĂ DE LIMBĂ: Scrie întregul răspuns în română, cu diacritice, inclusiv salutul, titlurile și listele. Limba selectată în interfață are prioritate față de limba mesajelor anterioare și a datelor mașinii. Nu continua în engleză doar fiindcă răspunsurile anterioare sunt în engleză.';
}
