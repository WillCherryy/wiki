import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, query } from '../src/core/table.ts';
import { verifyChain } from '../src/core/chain.ts';
import { TrialCore } from '../src/core/trial-core.ts';
import { MemoryStore } from '../src/core/files.ts';

// Regression guards with generous limits: they exist so a change that makes the hot paths ten times slower fails a test.
test('a 5 MB CSV parses and queries in well under a second and a half', () => {
  const head = 'block_id,x,y,z,tonnes,grade_gpt,domain', rows = [head]; let size = head.length;
  for (let i = 0; size < 5_000_000; i++) { const l = `B${i},${i % 200},${(i / 200) | 0},0,${2000 + (i % 1500)},${(0.1 + (i % 97) / 20).toFixed(3)},${i % 3 ? 'oxide' : 'sulphide'}`; rows.push(l); size += l.length + 1; }
  const text = rows.join('\n');
  const t0 = performance.now(), tab = parseCsv(text), t1 = performance.now();
  const r = query(tab, { filters: [{ column: 'domain', op: 'eq', value: 'oxide' }, { column: 'grade_gpt', op: 'ge', value: 1 }], aggregates: [{ op: 'sum', column: 'tonnes' }, { op: 'weighted_mean', column: 'grade_gpt', weight: 'tonnes' }] });
  const t2 = performance.now();
  console.log(`  ${(text.length / 1e6).toFixed(1)} MB, ${tab.rows.length} rows: parse ${(t1 - t0).toFixed(0)} ms, query ${(t2 - t1).toFixed(0)} ms`);
  assert.ok(r.rowsMatched > 0); assert.ok(t2 - t0 < 1500);
});

test('a call costs well under 5 ms including the audit hash; 500 calls stay verifiable', async () => {
  const t = new TrialCore({ id: 't', prefix: 'p/', priv: { reference: {}, canaries: [] }, task: { id: 'tk', title: 'T', statement: 'x'.repeat(30), instructions: null, answer: { fields: [{ name: 'v', tolerance: 0.1 }] }, files: [], policy: null, limits: { maxCalls: 1000, maxCostUsd: 1 } } }, new MemoryStore({}));
  const t0 = performance.now(); for (let i = 0; i < 500; i++) await t.call('units_convert', { value: i, from: 'm', to: 'ft' });
  const per = (performance.now() - t0) / 500;
  console.log(`  ${per.toFixed(3)} ms per call, 500 calls`);
  assert.ok(per < 5); assert.equal((await verifyChain(t.trace)).ok, true);
});
