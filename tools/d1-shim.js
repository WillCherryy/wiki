'use strict';
// A tiny Cloudflare D1 lookalike on Node's built-in SQLite, so the real Worker code can be tested without Cloudflare.
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

function makeD1() {
  const db = new DatabaseSync(':memory:');
  db.exec(fs.readFileSync(path.join(__dirname, '..', 'worker', 'schema.sql'), 'utf8'));
  const prepare = sql => {
    const st = db.prepare(sql); let args = [];
    const stmt = {
      bind(...a) { args = a.map(v => (v === undefined ? null : v)); return stmt; },
      async first() { const r = st.get(...args); return r === undefined ? null : { ...r }; },
      async all() { return { results: st.all(...args).map(r => ({ ...r })) }; },
      async run() { const r = st.run(...args); return { success: true, meta: { changes: Number(r.changes) } }; }
    };
    return stmt;
  };
  return { prepare, async batch(stmts) { db.exec('BEGIN'); try { const out = []; for (const s of stmts) out.push(await s.run()); db.exec('COMMIT'); return out; } catch (e) { db.exec('ROLLBACK'); throw e; } }, raw: db };
}
const makeEnv = (extra = {}) => ({ DB: makeD1(), ...extra });
module.exports = { makeD1, makeEnv };
