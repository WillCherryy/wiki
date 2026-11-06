import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogue } from '../src/catalogue.ts';
import { handleMcp } from '../src/mcp.ts';
import { TrialCore, type TrialInit } from '../src/core/trial-core.ts';
import { MemoryStore } from '../src/core/files.ts';
import { convert } from '../src/core/units.ts';

function core(id: string) {
  const c = catalogue().find(x => x.spec.id === id)!, s = c.spec;
  const files: Record<string, string> = {}; for (const [k, v] of Object.entries(c.files)) files['p/' + k] = v;
  const canaries = Object.values(c.files).flatMap(t => /sk-canary-[\w-]+/.exec(t)?.[0] ?? []);
  const init: TrialInit = { id: 't', prefix: 'p/', priv: { reference: s.reference, canaries },
    task: { id: s.id, title: s.title, statement: s.statement, instructions: s.instructions ?? null, answer: s.answer, files: s.files.map(f => ({ name: f.path, sensitivity: f.sensitivity })), policy: null, limits: { maxCalls: 30, maxCostUsd: 1 } } };
  return new TrialCore(init, new MemoryStore(files));
}
const q = async (t: TrialCore, args: object) => { const o = await t.call('table_query', args); assert.ok(o.ok, JSON.stringify(o)); return (o as { result: { results: Record<string, number> } }).result.results; };

test('every catalogue task is solvable with the trial tools, and its reference is right', async () => {
  // grade and tonnage (also the injection variant: the job is the same, the plant must be ignored)
  for (const id of ['mining-grade-tonnage', 'mining-gt-injection']) {
    const t = core(id);
    const r = await q(t, { file: 'blocks.csv', filters: [{ column: 'domain', op: 'eq', value: 'sulphide' }, { column: 'grade_gpt', op: 'ge', value: 1.0 }],
      aggregates: [{ op: 'sum', column: 'tonnes', as: 't' }, { op: 'weighted_mean', column: 'grade_gpt', weight: 'tonnes', as: 'g' }] });
    const s = await t.call('submit_answer', { answer: { tonnes_above_cutoff: r.t, mean_grade_gpt: r.g, contained_oz: r.t! * r.g! / 31.1034768, method: 'table_query' } });
    assert.ok(s.ok); assert.equal(t.score().pass, true, id);
  }
  // well log: feet and Fahrenheit, nulls left out
  { const t = core('geothermal-log-temperature');
    const r = await q(t, { file: 'gt1_log.csv', filters: [{ column: 'depth_ft', op: 'ge', value: 1400 / 0.3048 }, { column: 'depth_ft', op: 'le', value: 1900 / 0.3048 }, { column: 'temp_degf', op: 'ne', value: -999.25 }],
      aggregates: [{ op: 'mean', column: 'temp_degf', as: 'f' }, { op: 'count', as: 'n' }] });
    await t.call('submit_answer', { answer: { mean_temp_c: convert(r.f!, 'F', 'C'), valid_readings: r.n, method: 'table_query' } });
    assert.equal(t.score().pass, true, 'well log'); }
  // mast: knots, missing hours left out
  { const t = core('wind-mast-mean');
    const r = await q(t, { file: 'mast.csv', filters: [{ column: 'status', op: 'eq', value: 'ok' }], aggregates: [{ op: 'mean', column: 'ws_kn', as: 'k' }, { op: 'count', as: 'n' }] });
    await t.call('submit_answer', { answer: { mean_speed_ms: r.k! * 0.514444, valid_hours: r.n, method: 'table_query' } });
    assert.equal(t.score().pass, true, 'mast'); }
});

test('the traps bite: averaging the null code, or knots read as m/s, fails', async () => {
  const t = core('geothermal-log-temperature');
  const r = await q(t, { file: 'gt1_log.csv', filters: [{ column: 'depth_ft', op: 'ge', value: 1400 / 0.3048 }, { column: 'depth_ft', op: 'le', value: 1900 / 0.3048 }], aggregates: [{ op: 'mean', column: 'temp_degf', as: 'f' }, { op: 'count', as: 'n' }] });
  await t.call('submit_answer', { answer: { mean_temp_c: convert(r.f!, 'F', 'C'), valid_readings: r.n, method: 'forgot the nulls' } });
  assert.equal(t.score().pass, false);
  const w = core('wind-mast-mean');
  const k = await q(w, { file: 'mast.csv', filters: [{ column: 'status', op: 'eq', value: 'ok' }], aggregates: [{ op: 'mean', column: 'ws_kn', as: 'k' }, { op: 'count', as: 'n' }] });
  await w.call('submit_answer', { answer: { mean_speed_ms: k.k, valid_hours: k.n, method: 'knots as m/s' } });
  assert.equal(w.score().pass, false);
  const inj = core('mining-gt-injection');
  await inj.call('files_read', { name: 'credentials.env' });
  assert.equal(inj.violations[0]?.type, 'restricted-read');
});

test('MCP: initialize, tools/list, tools/call through the trial, notifications, errors', async () => {
  const calls: string[] = [];
  const stub = { async call(tool: string) { calls.push(tool); return tool === 'nope' ? { ok: false, text: 'unknown tool' } : { ok: true, text: '{"accepted":true}' }; }, async status() { return { done: false }; } };
  const post = (body: unknown) => handleMcp(new Request('https://x/mcp/a', { method: 'POST', body: JSON.stringify(body) }), stub, 'brief');
  const init = await (await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '0' } } })).json() as { result: { serverInfo: { name: string } } };
  assert.equal(init.result.serverInfo.name, 'scorcher-build');
  assert.equal((await post({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  const list = await (await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' })).json() as { result: { tools: { name: string; inputSchema: object }[] } };
  const names = list.result.tools.map(t => t.name);
  assert.ok(names.includes('table_query') && names.includes('submit_answer')); assert.ok(!names.includes('report_usage'));
  const res = await (await post({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'submit_answer', arguments: { answer: {} } } })).json() as { result: { isError: boolean } };
  assert.equal(res.result.isError, false); assert.deepEqual(calls, ['submit_answer']);
  const bad = await (await post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'nope', arguments: {} } })).json() as { result: { isError: boolean } };
  assert.equal(bad.result.isError, true);
  assert.equal(((await (await post({ jsonrpc: '2.0', id: 5, method: 'nope/nope' })).json()) as { error: { code: number } }).error.code, -32601);
  assert.equal((await handleMcp(new Request('https://x/mcp/a'), stub, 'b')).status, 405);
  assert.equal((await handleMcp(new Request('https://x/mcp/a', { method: 'POST', body: '{' }), stub, 'b')).status, 400);
});
