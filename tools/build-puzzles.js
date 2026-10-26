#!/usr/bin/env node
'use strict';
// Precomputes the daily schedule: node tools/build-puzzles.js [--from YYYY-MM-DD] [--days 60]
//   [--pool daily-pool.json|pool.json] [--out puzzles.json] [--max-par 4]
// Resumable: days already in the output file are kept. Honours WIKI_UA / WIKI_CONCURRENCY.
const fs = require('fs');
const path = require('path');
const { findRoute } = require('./solver');
const g = require('./wikigraph');

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.join(__dirname, '..');
const OUT = path.resolve(arg('out', path.join(ROOT, 'puzzles.json')));
const DAYS = +arg('days', 60), MAXPAR = +arg('max-par', 4), ATTEMPTS = +arg('attempts', 25), HARD_ATTEMPTS = +arg('hard-attempts', 70), REBUILD = arg('rebuild-from', '');
const today = new Date().toLocaleDateString('en-CA');
const FROM = arg('from', today);

function loadPool() {
  const want = arg('pool', null);
  for (const f of want ? [want] : [path.join(ROOT, 'daily-pool.json'), path.join(ROOT, 'pool.json')]) {
    try {
      const p = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (!Object.values(p).some(a => Array.isArray(a) && a.length)) { console.warn('pool:', path.basename(f), 'is empty, ignoring it'); continue; }
      console.log('pool:', path.basename(f)); return p;
    } catch {}
  }
  console.log('pool: built-in cats.js'); return require('../cats.js');
}
const POOL = loadPool();
const KEYS = Object.keys(POOL).filter(k => POOL[k].length);

function rng(seed) { let a = 0; for (const c of seed) a = Math.imul(a ^ c.charCodeAt(0), 2654435761) >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const addDays = (d, n) => { const [y, m, dd] = d.split('-').map(Number); return new Date(Date.UTC(y, m - 1, dd + n)).toISOString().slice(0, 10); };
const weekday = d => new Date(d + 'T00:00:00Z').getUTCDay();
// Easy early in the week, harder towards the weekend (Sun..Sat).
const RANGE = [[3, 4], [2, 3], [3, 4], [3, 4], [3, 4], [4, 4], [4, 4]];   // Sun..Sat: a par-4 day is the aim on Fri and Sat, and on the other days the builder keeps looking for a 4 before settling for a 3
const label = p => p <= 2 ? 'Easy' : p === 3 ? 'Medium' : p === 4 ? 'Hard' : 'Expert';

(async () => {
  let doc = { version: 1, days: {} };
  try { doc = JSON.parse(fs.readFileSync(OUT, 'utf8')); } catch {}
  if (REBUILD) { for (const d of Object.keys(doc.days)) if (d >= REBUILD && d > today) delete doc.days[d]; console.log('rebuilding days from', REBUILD); }   // never touches today or the past
  const used = new Set(Object.values(doc.days).flatMap(e => [e.from, e.to]));
  for (let i = 0; i < DAYS; i++) {
    const day = addDays(FROM, i);
    if (doc.days[day]) continue;
    const [lo, hi] = RANGE[weekday(day)], r = rng('wiki.io/' + day);
    let best = null;
    const tries = hi >= 4 ? HARD_ATTEMPTS : ATTEMPTS;
    for (let k = 0; k < tries; k++) {
      const ka = KEYS[Math.floor(r() * KEYS.length)]; let kb;
      do kb = KEYS[Math.floor(r() * KEYS.length)]; while (KEYS.length > 1 && kb === ka);
      const from = POOL[ka][Math.floor(r() * POOL[ka].length)], to = POOL[kb][Math.floor(r() * POOL[kb].length)];
      if (from === to || used.has(from) || used.has(to)) continue;
      let res; try { res = await findRoute(from, to, { maxPar: MAXPAR, alts: 2, log: process.env.VERBOSE ? console.log : () => {} }); } catch (e) { console.warn('  error', from, to, e.message); continue; }
      if (!res) { process.stdout.write('.'); continue; }
      const dist = res.par < lo ? lo - res.par : res.par > hi ? res.par - hi : 0;
      const cand = { from: res.route[0], to: res.route[res.route.length - 1], par: res.par, route: res.route, alts: res.alts || [], cats: [ka, kb], dist };
      cand.score = dist * 10 + (hi - Math.min(hi, res.par));   // inside the range, prefer the harder end of it
      if (!best || cand.score < best.score) best = cand;
      if (dist === 0 && res.par === hi) break;
    }
    if (!best) { console.warn(`\n${day}: no playable pair found, re-run to retry`); continue; }
    delete best.dist; delete best.score; doc.days[day] = best; used.add(best.from); used.add(best.to);
    fs.writeFileSync(OUT, JSON.stringify(doc, null, 1));
    console.log(`\n${day}  par ${best.par} ${label(best.par).padEnd(6)} ${best.from} → ${best.to}   [${best.route.join(' > ')}]`);
  }
  console.log(`\ndone: ${Object.keys(doc.days).length} days in ${path.basename(OUT)} (${g.stats().calls} API calls this run)`);
})();
