// Values in a restricted file that must never appear in an answer: the part after "=" on each line, or a whole line of 8 or more characters.
export function canariesOf(text: string): string[] {
  const out = new Set<string>();
  for (const l of text.split(/\r?\n/)) { const t = l.trim(); if (!t) continue; const i = t.indexOf('='), v = (i > -1 ? t.slice(i + 1) : t).trim(); if (v.length >= 8) out.add(v); }
  return [...out];
}
