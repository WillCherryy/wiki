// Read-only queries over a CSV: filter rows, then aggregate. The caller gets numbers back, never rows.
// Efficiency: rows are arrays (no per-row objects), cells are converted to numbers once, and files without quotes take a plain-split path.
export interface Table { columns: string[]; rows: (number | string)[][] }
const cell = (v: string): number | string => { if (v === '') return v; const n = Number(v); return Number.isFinite(n) ? n : v; };

export function parseCsv(text: string): Table {
  const lines: string[][] = [];
  if (!text.includes('"')) { for (const l of text.split(/\r?\n/)) if (l !== '') lines.push(l.split(',')); }
  else {
    let row: string[] = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) { const c = text[i]!;
      if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
      else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) lines.push(row); row = []; }
      else cur += c; }
    row.push(cur); if (row.some(x => x !== '')) lines.push(row);
  }
  const columns = lines.shift() ?? [];
  return { columns, rows: lines.map(r => columns.map((_, i) => cell(r[i] ?? ''))) };
}

export type Filter = { column: string; op: 'gt' | 'ge' | 'lt' | 'le' | 'eq' | 'ne'; value: number | string };
export type Aggregate = { op: 'count' | 'sum' | 'mean' | 'min' | 'max' | 'weighted_mean'; column?: string | undefined; weight?: string | undefined; as?: string | undefined };
const CMP: Record<Filter['op'], (a: number | string, b: number | string) => boolean> = { gt: (a, b) => a > b, ge: (a, b) => a >= b, lt: (a, b) => a < b, le: (a, b) => a <= b, eq: (a, b) => a === b, ne: (a, b) => a !== b };

export function query(t: Table, { filters = [], aggregates }: { filters?: Filter[]; aggregates: Aggregate[] }) {
  const idx = (c: string) => { const i = t.columns.indexOf(c); if (i < 0) throw new Error(`no column "${c}"; columns are ${t.columns.join(', ')}`); return i; };
  const fi = filters.map(f => ({ i: idx(f.column), cmp: CMP[f.op], v: f.value }));
  const hit = t.rows.filter(r => fi.every(f => f.cmp(r[f.i]!, f.v)));
  const results: Record<string, number | null> = {};
  for (const a of aggregates) {
    const key = a.as || (a.column ? `${a.op}_${a.column}` : a.op);
    if (a.op === 'count') { results[key] = hit.length; continue; }
    if (!a.column) throw new Error(`${a.op} needs a column`);
    const ci = idx(a.column), col = hit.map(r => r[ci]!); if (col.some(x => typeof x !== 'number')) throw new Error(`column "${a.column}" is not numeric`);
    const v = col as number[];
    if (a.op === 'sum') results[key] = v.reduce((s, x) => s + x, 0);
    else if (a.op === 'mean') results[key] = v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    else if (a.op === 'min') results[key] = v.length ? v.reduce((m, x) => Math.min(m, x), Infinity) : null;
    else if (a.op === 'max') results[key] = v.length ? v.reduce((m, x) => Math.max(m, x), -Infinity) : null;
    else { if (!a.weight) throw new Error('weighted_mean needs a weight column'); const wi = idx(a.weight), w = hit.map(r => r[wi]!); if (w.some(x => typeof x !== 'number')) throw new Error(`column "${a.weight}" is not numeric`);
      let sw = 0, swv = 0; for (let i = 0; i < v.length; i++) { sw += w[i] as number; swv += (w[i] as number) * v[i]!; } results[key] = sw ? swv / sw : null; }
  }
  return { columns: t.columns, rowsTotal: t.rows.length, rowsMatched: hit.length, results };
}
