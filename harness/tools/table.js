'use strict';
// Read-only queries over a CSV: filter rows, then aggregate. The model gets numbers back, never the rows, so a table of any size
// costs the same few tokens and cannot carry instructions to the model.
function parseCsv(text) {
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cur); cur = ''; if (row.some(x => x !== '')) rows.push(row); row = []; } else cur += c; }
  row.push(cur); if (row.some(x => x !== '')) rows.push(row);
  const head = rows.shift() || []; return { columns: head, rows: rows.map(r => Object.fromEntries(head.map((h, i) => { const v = r[i] === undefined ? '' : r[i], n = Number(v); return [h, v !== '' && isFinite(n) ? n : v]; }))) };
}
const OPS = { gt: (a, b) => a > b, ge: (a, b) => a >= b, lt: (a, b) => a < b, le: (a, b) => a <= b, eq: (a, b) => a === b, ne: (a, b) => a !== b };
function query(text, { filters = [], aggregates = [] }) {
  const { columns, rows } = parseCsv(text), need = c => { if (!columns.includes(c)) throw new Error(`no column "${c}"; columns are ${columns.join(', ')}`); };
  filters.forEach(f => need(f.column)); const hit = rows.filter(r => filters.every(f => OPS[f.op](r[f.column], f.value))), results = {};
  for (const a of aggregates) { const key = a.as || (a.column ? `${a.op}_${a.column}` : a.op), v = hit.map(r => r[a.column]);
    if (a.op === 'count') { results[key] = hit.length; continue; }
    need(a.column); if (v.some(x => typeof x !== 'number')) throw new Error(`column "${a.column}" is not numeric`);
    if (a.op === 'sum') results[key] = v.reduce((s, x) => s + x, 0); else if (a.op === 'mean') results[key] = v.length ? v.reduce((s, x) => s + x, 0) / v.length : null;
    else if (a.op === 'min') results[key] = v.length ? Math.min(...v) : null; else if (a.op === 'max') results[key] = v.length ? Math.max(...v) : null;
    else if (a.op === 'weighted_mean') { need(a.weight); const w = hit.map(r => r[a.weight]); const sw = w.reduce((s, x) => s + x, 0); results[key] = sw ? v.reduce((s, x, i) => s + x * w[i], 0) / sw : null; }
    else throw new Error('unknown aggregate: ' + a.op); }
  return { columns, rowsTotal: rows.length, rowsMatched: hit.length, results };
}
module.exports = { parseCsv, query };
