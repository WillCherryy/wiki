'use strict';
// A small VOTable reader for the data tools: TABLEDATA, BINARY and BINARY2 serialisations, numeric scalars and character strings (fixed or variable length).
// readVOTable(xml) -> { fields: [name], rows: [[value]] }, with null for missing values. Errors reported by a TAP service are thrown.
function readVOTable(xml) {
  const err = /<INFO[^>]*name="QUERY_STATUS"[^>]*value="ERROR"[^>]*>([\s\S]*?)<\/INFO>/.exec(xml); if (err) throw new Error('TAP error: ' + err[1].trim().slice(0, 300));
  const fields = [...xml.matchAll(/<FIELD\b([^>]*?)\/?>/g)].map(m => { const a = k => (new RegExp('\\b' + k + '="([^"]*)"').exec(m[1]) || [])[1]; return { name: a('name').replace(/^"|"$/g, ''), type: a('datatype'), size: a('arraysize') }; });
  const unesc = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/&amp;/g, '&');
  const num = (f, s) => { if (s == null || s === '') return null; if (f.type === 'char' || f.type === 'unicodeChar') return s; const v = Number(s); return Number.isFinite(v) ? v : null; };
  const td = /<TABLEDATA>([\s\S]*?)<\/TABLEDATA>/.exec(xml);
  if (td) return { fields: fields.map(f => f.name), rows: td[1].split(/<TR[^>]*>/).slice(1).map(tr => [...tr.matchAll(/<TD[^>]*>([\s\S]*?)<\/TD>|<TD\s*\/>/g)].map((m, k) => num(fields[k], m[1] == null ? '' : unesc(m[1])))) };
  const st = /<(BINARY2?)>\s*<STREAM[^>]*>([\s\S]*?)<\/STREAM>/.exec(xml); if (!st) return { fields: fields.map(f => f.name), rows: [] };
  const two = st[1] === 'BINARY2', buf = Buffer.from(st[2].replace(/\s+/g, ''), 'base64'), W = { double: 8, float: 4, long: 8, int: 4, short: 2, unsignedByte: 1, boolean: 1, char: 1, unicodeChar: 2 }, nb = two ? Math.ceil(fields.length / 8) : 0, rows = [];
  const one = (t, o) => { switch (t) { case 'double': return buf.readDoubleBE(o); case 'float': return buf.readFloatBE(o); case 'long': return Number(buf.readBigInt64BE(o)); case 'int': return buf.readInt32BE(o); case 'short': return buf.readInt16BE(o); case 'boolean': return 'TtYy1'.includes(String.fromCharCode(buf[o])); default: return buf[o]; } };
  let o = 0;
  while (o < buf.length) { const nulls = buf.subarray(o, o + nb); o += nb; const row = [];
    fields.forEach((f, k) => { const w = W[f.type]; if (!w) throw new Error('VOTable: unsupported datatype ' + f.type + ' in ' + f.name);
      let n = 1; if (f.size) { if (/\*$/.test(f.size)) { n = buf.readInt32BE(o); o += 4; } else n = parseInt(f.size, 10) || 1; }   // variable length: a 4-byte count first
      let v; if (f.type === 'char' || f.type === 'unicodeChar') { v = f.type === 'char' ? buf.toString('latin1', o, o + n) : buf.subarray(o, o + 2 * n).swap16().toString('utf16le'); v = v.replace(/\0[\s\S]*$/, '').trim(); o += n * w; }
      else if (n === 1) { v = one(f.type, o); o += w; if (typeof v === 'number' && !Number.isFinite(v)) v = null; }
      else { v = []; for (let i = 0; i < n; i++) { v.push(one(f.type, o)); o += w; } }
      const isNull = two && (nulls[k >> 3] >> (7 - (k & 7)) & 1); row.push(isNull || v === '' ? null : v); });
    rows.push(row); }
  return { fields: fields.map(f => f.name), rows };
}
// A synchronous TAP query (ADQL) returning { fields, rows }.
async function tap(url, adql, { timeout = 300000 } = {}) {
  const body = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', QUERY: adql }), ac = new AbortController(), t = setTimeout(() => ac.abort(), timeout);
  try { const r = await fetch(url.replace(/\/$/, '') + '/sync', { method: 'POST', body, signal: ac.signal, headers: { 'user-agent': 'ScorcherSky/1.0 (https://playscorcher.com/sky)' } }); const x = await r.text(); if (!r.ok && !/<VOTABLE/.test(x)) throw new Error(url + ' HTTP ' + r.status); return readVOTable(x); }
  finally { clearTimeout(t); }
}
module.exports = { readVOTable, tap };
