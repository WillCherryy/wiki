#!/usr/bin/env node
'use strict';
// Scorcher Tree: the Newick parser, MRCA, bounded ages, and every evidence rule in docs/tree-data.md, plus the real built dataset.
const fs = require('fs'), path = require('path'), assert = require('assert');
const { parseNewick, mrca, deriveBounds, ttUsable, build } = require('./build-tree.js'), { validate } = require('./check-tree.js');
// parser: quoted labels, branch lengths, comments
const t = parseNewick("(('Homo sapiens ott1':1.2,Pan_troglodytes[x]:0.5)Hominini:3,Gorilla)Homininae;");
assert.strictEqual(t.label, 'Homininae'); assert.strictEqual(t.children[0].label, 'Hominini'); assert.strictEqual(t.children[0].children[0].label, 'Homo sapiens ott1'); assert.strictEqual(t.children[1].label, 'Gorilla');
assert.throws(() => parseNewick('((a,b);'));
// mrca and bounds on a small tree
const tree = { id: 'root', children: [{ id: 'ab', children: [{ id: 'a' }, { id: 'b' }] }, { id: 'c' }] };
assert.strictEqual(mrca(tree, ['a', 'b']).id, 'ab'); assert.strictEqual(mrca(tree, ['a', 'c']).id, 'root');
const N = () => ({ root: { name: 'Root', relationship: { status: 'pending' }, age: { display: { lo: 100, hi: 120, source: 'synthesis' }, clock: [{ lo: 100, hi: 120, cite: 'k' }] } }, ab: { name: 'AB', relationship: { status: 'pending' }, age: {} } });
{ const n = N(); deriveBounds(tree, n); assert.deepStrictEqual(n.ab.age.display, { lo: null, hi: 120, source: 'bounded' }, 'a node under a dated parent is bounded above only'); }
{ const n = N(); n.ab.age.fossilMin = { ma: 50, cite: 'k' }; delete n.root.age.display; delete n.root.age.clock; deriveBounds(tree, n); assert.deepStrictEqual(n.root.age.display, { lo: 50, hi: null, source: 'bounded' }, 'a fossil below sets a floor, never a midpoint'); }
{ const n = N(); n.ab.age = { fossilMin: { ma: 70, cite: 'k' }, softMax: { ma: 90, cite: 'k' } }; deriveBounds(tree, n); assert.deepStrictEqual(n.ab.age.display, { lo: 70, hi: 90, source: 'bounded' }, 'a node\'s own fossil minimum and soft maximum bound it'); }
// rules
const base = () => ({ taxa: { a: { sci: 'A a' }, b: { sci: 'B b' }, c: { sci: 'C c' } }, tree: JSON.parse(JSON.stringify(tree)), nodes: N(), citations: { k: { doi: '10.1/x', verified: true } } });
const errs = (d, o) => validate(d, o).errors;
assert.deepStrictEqual(errs(base()), [], 'a clean dataset passes');
{ const d = base(); d.nodes.root.age.clock[0].cite = undefined; assert(errs(d).some(e => /no citation/.test(e)), 'number without citation'); }
{ const d = base(); d.nodes.root.age.display.hi = 125; assert(errs(d).some(e => /never invent/.test(e)), 'displayed interval not from a published record'); }
{ const d = base(); d.nodes.root.age.display.mid = 110; assert(errs(d).some(e => /midpoint/.test(e)), 'invented midpoint'); }
{ const d = base(); d.nodes.ab.age = { clock: [{ lo: 130, hi: 140, cite: 'k' }], display: { lo: 130, hi: 140, source: 'synthesis' } }; assert(errs(d).some(e => /older than its ancestor/.test(e)), 'child older than parent'); }
{ const d = base(); d.tree.children.push({ id: 'd' }); d.taxa.d = { sci: 'D d' }; d.nodes.root.relationship.status = 'resolved'; assert(errs(d).some(e => /polytomy/.test(e)), 'resolved polytomy'); }
{ const d = base(); d.nodes.ab.relationship = { status: 'debated', competing: [{ name: 'x' }] }; assert(errs(d).some(e => /two competing/.test(e)), 'debate needs two hypotheses'); }
{ const d = base(); d.nodes.ab.age = { fossilMin: { ma: 60, cite: 'k' }, softMax: { ma: 50, cite: 'k' } }; assert(errs(d).some(e => /soft maximum is younger/.test(e)), 'max younger than min'); }
{ const d = base(); d.citations.k.verified = false; assert.deepStrictEqual(errs(d), []); assert(errs(d, { strict: true }).some(e => /not verified/.test(e)), 'strict mode needs verified DOIs'); }
{ const d = base(); d.nodes.root.age.display.mid = undefined; d.nodes.root.age.display = { lo: 100, hi: 120, mid: 110, source: 'bounded' }; assert(errs(d).some(e => /bounded node must not have a midpoint/.test(e))); }
{ const d = base(); d.taxa.a.image = { licence: 'All rights reserved', artist: 'X' }; assert(errs(d).some(e => /not free/.test(e)), 'unfree image'); }
{ const d = base(); d.nodes.ab.age = { fossilMin: { ma: 50, cite: 'k' }, softMax: { ma: 60, cite: 'k' }, display: { lo: 50, hi: 60, source: 'calibration' } }; assert.deepStrictEqual(errs(d), [], 'a calibration bracket from its own records passes'); d.nodes.ab.age.display.hi = 61; assert(errs(d).some(e => /calibration display/.test(e)), 'calibration bracket must match its records'); }
// TimeTree entries: only an interval TimeTree actually published, for a clade that matches ours
{ const e = { clade: ['A a', 'B b'], query: ['A a', 'B b'], median: 10, ciLow: 8, ciHigh: 12, studies: 5 };
  assert(ttUsable(e)); assert(!ttUsable({ ...e, conflict: 'x' }), 'topology conflict'); assert(!ttUsable({ ...e, ciLow: 0, ciHigh: 0 }), 'no interval');
  assert(!ttUsable({ ...e, studies: 1 }), 'one study is not a synthesis'); assert(!ttUsable({ ...e, unavailable: 'x' })); assert(!ttUsable({ ...e, median: 13 }), 'median outside its interval'); }
// the real dataset
const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'treedata', 'vertebrates.json'), 'utf8')), r = validate(real);
assert.deepStrictEqual(r.errors, [], 'the built vertebrate dataset breaks a rule');
// every evidence record attaches on the offline draft topology (records marked "exact" may be absent there, never misplaced)
(async () => {
  const warn = console.warn, said = []; console.warn = (...a) => said.push(a.join(' ')); let draft; try { draft = await build({}); } finally { console.warn = warn; }
  assert.deepStrictEqual(said.filter(m => /matches no node|both match/.test(m)), [], 'an evidence record does not attach to the draft tree');
  const tipsUnder = (n, id) => { let hit = null; (function f(x) { if (x.id === id) hit = x; (x.children || []).forEach(f); })(n); const out = []; (function g(x) { if (!x.children) out.push(x.id); else x.children.forEach(g); })(hit); return out.sort().join('|'); };
  for (const f of fs.readdirSync(path.join(__dirname, '..', 'tree', 'nodes')).filter(f => f.endsWith('.json'))) { const r = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tree', 'nodes', f), 'utf8')); if (!r.exact) continue;
    const id = Object.keys(draft.nodes).find(k => draft.nodes[k].age && JSON.stringify(draft.nodes[k].age.clock || []) === JSON.stringify(r.age.clock)); if (id) assert.strictEqual(tipsUnder(draft.tree, id), r.mrca.map(s => s.toLowerCase().replace(/ /g, '-')).sort().join('|'), f + ' attached to a different clade'); }
  for (const r of Object.values(real.nodes)) for (const c of (r.age && r.age.clock) || []) assert(c.method && c.cite, 'a clock estimate without its method or citation');
  console.log(`ok: tree evidence rules (parser, MRCA, bounded ages, 12 rule checks); vertebrates.json: ${Object.keys(real.taxa).length} species, ${Object.keys(real.nodes).length} nodes, ${r.warnings.length} draft warnings`);
})().catch(e => { console.error(e); process.exit(1); });
