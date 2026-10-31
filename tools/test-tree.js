#!/usr/bin/env node
'use strict';
// Scorcher Tree: the Newick parser, MRCA, bounded ages, and every evidence rule in docs/tree-data.md, plus the real built dataset.
const fs = require('fs'), path = require('path'), assert = require('assert');
const { parseNewick, mrca, deriveBounds } = require('./build-tree.js'), { validate } = require('./check-tree.js');
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
// the real dataset
const real = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'treedata', 'vertebrates.json'), 'utf8')), r = validate(real);
assert.deepStrictEqual(r.errors, [], 'the built vertebrate dataset breaks a rule');
console.log(`ok: tree evidence rules (parser, MRCA, bounded ages, 11 rule checks); vertebrates.json: ${Object.keys(real.taxa).length} species, ${Object.keys(real.nodes).length} nodes, ${r.warnings.length} draft warnings`);
