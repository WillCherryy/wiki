#!/usr/bin/env node
'use strict';
// Verifies every companion-pack puzzle against real Wikipedia links: node tools/build-packs.js [--out packs.json] [--retry] [--max-par 4]
// Writes { packs: { id: [ {key, from, to, par, route} | {key, fail: 1}, ... ] } }, in the same order as packs.js.
// Incremental: pairs already checked (same from|to) are reused, so adding puzzles only costs the new ones. --retry re-checks the failures too.
const fs = require('fs');
const path = require('path');
const { findRoute } = require('./solver');

async function build(packs, { maxPar = 4, existing = {}, retry = false, log = () => {}, onProgress = null } = {}) {
  const out = {};
  for (const p of packs) {
    const prev = new Map(((existing[p.id]) || []).filter(Boolean).map(e => [e.key, e]));
    out[p.id] = [];
    for (const z of p.puzzles) {
      const key = z.from + '|' + z.to, old = prev.get(key);
      if (old && (!old.fail || !retry)) { out[p.id].push(old); continue; }
      let r = null;
      try { r = await findRoute(z.from, z.to, { maxPar }); } catch (e) { console.warn('  error', z.from, '→', z.to, e.message); }
      out[p.id].push(r ? { key, from: r.route[0], to: r.route[r.route.length - 1], par: r.par, route: r.route } : { key, fail: 1 });
      log(`${p.id}: ${z.from} → ${z.to}  ${r ? 'par ' + r.par : 'no route ≤ ' + maxPar}`);
      if (onProgress) onProgress(out, p, z);
    }
  }
  return out;
}
module.exports = { build };

if (require.main === module) {
  const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
  const outFile = path.resolve(arg('out', path.join(__dirname, '..', 'packs.json')));
  let existing = {}; try { existing = JSON.parse(fs.readFileSync(outFile, 'utf8')).packs || {}; } catch {}
  // old files had no keys: recover them from the pack definitions (same order)
  const defs = require('../packs.js'); for (const p of defs) if (Array.isArray(existing[p.id])) existing[p.id] = existing[p.id].map((e, i) => (e && !e.key && p.puzzles[i] ? { ...e, key: p.puzzles[i].from + '|' + p.puzzles[i].to } : e === null && p.puzzles[i] ? { key: p.puzzles[i].from + '|' + p.puzzles[i].to, fail: 1 } : e));
  const save = packs => fs.writeFileSync(outFile, JSON.stringify({ version: 2, packs }, null, 1));
  build(defs, { maxPar: +arg('max-par', 4), existing, retry: process.argv.includes('--retry'), log: console.log }).then(packs => { save(packs); console.log('wrote', path.basename(outFile)); });
}
