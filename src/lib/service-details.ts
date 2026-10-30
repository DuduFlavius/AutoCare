const prefix = 'AutoCare · ';
export function parseServiceDetails(parts: string) {
  const out: Record<string, string> = {};
  for (const line of parts.split('\n')) {
    if (!line.startsWith(prefix)) continue;
    const index = line.indexOf(': ', prefix.length);
    if (index > 0) out[line.slice(prefix.length, index)] = line.slice(index + 2);
  }
  return out;
}
/** Update submitted fields while preserving metadata from older editor versions. */
export function serializeServiceDetails(parts: string, form: FormData, existingParts = parts) {
  const text = parts
    .split('\n')
    .filter((line) => !line.startsWith(prefix))
    .join('\n')
    .trim();
  const details = { ...parseServiceDetails(existingParts), ...parseServiceDetails(parts) };
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('ac_')) continue;
    const name = key.slice(3),
      content = String(value).trim().replace(/\r?\n/g, ' / ');
    if (content) details[name] = content;
    else delete details[name];
  }
  return [text, ...Object.entries(details).map(([key, value]) => prefix + key + ': ' + value)]
    .filter(Boolean)
    .join('\n');
}
