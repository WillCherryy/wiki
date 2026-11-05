import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { verifyChain } from '../src/core/chain.ts';
import { parseCsv, query } from '../src/core/table.ts';
import { convert } from '../src/core/units.ts';
import { canariesOf } from '../src/core/secrets.ts';
import { callCost } from '../src/core/pricing.ts';
import { gradeNumeric } from '../src/core/grade.ts';
import { TaskSpec } from '../src/core/types.ts';
import type { TraceEntry } from '../src/core/types.ts';

const require = createRequire(import.meta.url);
const harnessTable = require('../../harness/tools/table.js'), harnessUnits = require('../../harness/tools/units.js'), harnessPrices = require('../../harness/pricing.js');
const fixture = JSON.parse(readFileSync(new URL('./fixtures/harness-trace.json', import.meta.url), 'utf8')) as TraceEntry[];

test('a trace written by the JavaScript harness verifies in TypeScript', async () => {
  const v = await verifyChain(fixture); assert.equal(v.ok, true); if (v.ok) assert.equal(v.length, fixture.length);
});
test('editing, removing or reordering a call breaks the chain', async () => {
  const edit = structuredClone(fixture); edit[2]!.args = { name: 'edited' }; const r = await verifyChain(edit); assert.deepEqual(r, { ok: false, firstBad: 3 });
  const del = structuredClone(fixture); del.splice(1, 1); assert.equal((await verifyChain(del)).ok, false);
  const swap = structuredClone(fixture); [swap[1], swap[2]] = [swap[2]!, swap[1]!]; assert.equal((await verifyChain(swap)).ok, false);
});

const CSV = 'id,t,g,d\n1,10,2,a\n2,30,1,a\n3,20,4,b\n';
test('table query: weighted mean is by weight, not a simple mean', () => {
  const r = query(parseCsv(CSV), { filters: [{ column: 'd', op: 'eq', value: 'a' }], aggregates: [{ op: 'sum', column: 't', as: 's' }, { op: 'weighted_mean', column: 'g', weight: 't', as: 'w' }, { op: 'mean', column: 'g', as: 'm' }, { op: 'count' }] });
  assert.deepEqual(r.results, { s: 40, w: 1.25, m: 1.5, count: 2 }); assert.equal(r.rowsMatched, 2); assert.equal(r.rowsTotal, 3);
});
test('table query: quoted fields, errors name the columns, and it agrees with the JS harness on random data', () => {
  assert.deepEqual(parseCsv('a,b\n"x,y",2\n').rows, [['x,y', 2]]);
  assert.throws(() => query(parseCsv(CSV), { aggregates: [{ op: 'sum', column: 'zz' }] }), /columns are id, t, g, d/);
  assert.throws(() => query(parseCsv(CSV), { aggregates: [{ op: 'sum', column: 'd' }] }), /not numeric/);
  let s = 12345; const rnd = () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const rows = ['k,x,w']; for (let i = 0; i < 500; i++) rows.push(`${i % 7},${(rnd() * 100).toFixed(3)},${1 + Math.floor(rnd() * 9)}`); const text = rows.join('\n') + '\n';
  const a = { filters: [{ column: 'k', op: 'ge' as const, value: 3 }], aggregates: [{ op: 'sum' as const, column: 'x', as: 'sx' }, { op: 'weighted_mean' as const, column: 'x', weight: 'w', as: 'wm' }, { op: 'max' as const, column: 'x', as: 'mx' }, { op: 'count' as const, as: 'n' }] };
  const mine = query(parseCsv(text), a).results, theirs = harnessTable.query(text, a).results; for (const k of Object.keys(theirs)) assert.ok(Math.abs((mine[k] as number) - theirs[k]) < 1e-9, k);
});
test('units agree with the JS harness and refuse unlike quantities', () => {
  for (const [v, f, t] of [[1, 'acre', 'm2'], [100, 'C', 'F'], [1, 'psi', 'pa'], [1000, 'ft', 'm'], [3, 'mi2', 'km2'], [300, 'K', 'C']] as const) assert.ok(Math.abs(convert(v, f, t) - harnessUnits.convert(v, f, t)) < 1e-9, `${v} ${f} to ${t}`);
  assert.throws(() => convert(1, 'm', 'pa'), /cannot convert/);
});
test('guarded secrets: the value after "=" or a long line', () => { assert.deepEqual(canariesOf('TOKEN=abcdefgh1\nshort=x\nlonglinewithoutequals\n'), ['abcdefgh1', 'longlinewithoutequals']); });
test('prices agree with the JS harness; an unknown model is refused', () => {
  for (const m of Object.keys(harnessPrices.PRICES)) { const u = { input_tokens: 123456, output_tokens: 7890 }; assert.ok(Math.abs(callCost(m, u) - harnessPrices.callCost(m, u).total) < 1e-12, m); }
  assert.throws(() => callCost('nope', { input_tokens: 1, output_tokens: 1 }), /no price/);
});
test('numeric grading: tolerance is relative; a zero reference is absolute; format errors are named', () => {
  const f = [{ name: 'v', tolerance: 0.01 }], ok = gradeNumeric(f, { v: 100 }, { v: 100.5, method: 'a stated method' }), bad = gradeNumeric(f, { v: 100 }, { v: 102, method: 'a stated method' });
  assert.equal(ok.pass, true); assert.equal(bad.pass, false); assert.equal(bad.category, 'value'); assert.equal(gradeNumeric(f, { v: 100 }, { v: 'x' }).category, 'format'); assert.equal(gradeNumeric(f, { v: 0 }, { v: 0.005, method: 'a stated method' }).pass, true);
});
test('the task spec rejects a reference that lacks an answer field, unknown keys and bad ids', () => {
  const ok = { id: 'my-task-1', title: 'A task', domain: 'mining', statement: 'Report the total tonnes above the cut-off grade.', answer: { fields: [{ name: 't', tolerance: 0.01 }] }, reference: { t: 5 } };
  assert.equal(TaskSpec.safeParse(ok).success, true); assert.equal(TaskSpec.safeParse({ ...ok, reference: {} }).success, false); assert.equal(TaskSpec.safeParse({ ...ok, extra: 1 }).success, false); assert.equal(TaskSpec.safeParse({ ...ok, id: 'Bad Id' }).success, false);
});
