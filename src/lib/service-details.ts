const prefix = 'AutoCare · ';
export function parseServiceDetails(parts: string) {
  const out: Record<string, string> = {};
  for (const line of parts.split('\n')) {
    if (line.startsWith(prefix)) {
      const i = line.indexOf(': ', prefix.length);
      if (i > 0) out[line.slice(prefix.length, i)] = line.slice(i + 2);
    }
  }
  return out;
}
export function serializeServiceDetails(parts: string, form: FormData) {
  const old = parts
    .split('\n')
    .filter((x) => !x.startsWith(prefix))
    .join('\n')
    .trim();
  const lines: string[] = [];
  for (const [key, value] of form.entries()) {
    if (!key.startsWith('ac_')) continue;
    const v = String(value).trim();
    if (v) lines.push(prefix + key.slice(3) + ': ' + v.replace(/\r?\n/g, ' / '));
  }
  return [old, ...lines].filter(Boolean).join('\n');
}
