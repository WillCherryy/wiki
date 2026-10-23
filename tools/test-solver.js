'use strict';
// The shared solver on a small hand-made link graph: shortest route, alternatives of the same length, par limits.
const assert = require('assert');
const { makeSolver } = require('../solver.js');
const L = { A: ['B', 'X', 'Y'], B: ['C'], X: ['C'], Y: ['C'], C: ['D'], D: [], P: ['Q'], Q: ['R'], R: ['S'], S: ['T'], T: ['U'], U: [] };
const norm = t => t.toLowerCase(), inv = {};
for (const [k, v] of Object.entries(L)) for (const t of v) (inv[t] = inv[t] || []).push(k);
const g = { norm, async playable(t) { return L[t] ? { title: t, links: L[t], set: new Set(L[t].map(norm)) } : null; }, async outLinks(ts) { return new Map(ts.map(t => [t, L[t] || []])); }, async inLinks(t) { return inv[t] || []; } };
(async () => {
  const { findRoute } = makeSolver(g);
  let r = await findRoute('A', 'D');
  assert.deepStrictEqual([r.par, r.route.join('>'), r.alts.length], [3, 'A>B>C>D', 0], 'shortest route, no alternatives by default');
  r = await findRoute('A', 'D', { alts: 2 });
  assert.deepStrictEqual([r.par, r.alts.map(x => x.join('>')).sort()], [3, ['A>X>C>D', 'A>Y>C>D']], 'two alternatives of the same length');
  assert.strictEqual((await findRoute('A', 'C')).par, 2); assert.strictEqual((await findRoute('A', 'B')).par, 1);
  assert.strictEqual(await findRoute('P', 'U'), null, 'a 5-click route is not accepted: every puzzle must be solvable in 4 or fewer');
  assert.strictEqual(await findRoute('A', 'Nope'), null, 'missing pages give no route');
  assert.strictEqual(await findRoute('A', 'A'), null);
  console.log('ok: shared solver (shortest route, alternatives, 4-click limit)');
})().catch(e => { console.error(e); process.exit(1); });
