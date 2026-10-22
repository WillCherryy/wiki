#!/usr/bin/env node
'use strict';
// Verifies every companion-pack puzzle against real Wikipedia links: node tools/build-packs.js [--out packs.json]
// Writes { packs: { id: [ {from,to,par,route} | null, ... ] } }; null = no route of <= max-par clicks found.
const fs = require('fs');
const path = require('path');
const { findRoute } = require('./solver');

async function build(packs, { maxPar = 4, log = () => {} } = {}) {
  const out = {};
  for (const p of packs) {
    out[p.id] = [];
    for (const z of p.puzzles) {
      let r = null;
      try { r = await findRoute(z.from, z.to, { maxPar }); } catch (e) { console.warn('  error', z.from, '→', z.to, e.message); }
      out[p.id].push(r ? { from: r.route[0], to: r.route[r.route.length - 1], par: r.par, route: r.route } : null);
      log(`${p.id}: ${z.from} → ${z.to}  ${r ? 'par ' + r.par : 'no route ≤ ' + maxPar}`);
    }
  }
  return out;
}
module.exports = { build };

if (require.main === module) {
  const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
  const outFile = path.resolve(arg('out', path.join(__dirname, '..', 'packs.json')));
  build(require('../packs.js'), { maxPar: +arg('max-par', 4), log: console.log }).then(packs => {
    fs.writeFileSync(outFile, JSON.stringify({ version: 1, packs }, null, 1));
    console.log('wrote', path.basename(outFile));
  });
}
