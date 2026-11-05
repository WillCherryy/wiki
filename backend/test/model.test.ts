import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TrialCore } from '../src/core/trial-core.ts';
import { MemoryStore } from '../src/core/files.ts';
import { runModelLoop, toolSpecs, systemPrompt, type Complete, type Block } from '../src/core/model.ts';
import type { TaskPrivate, TaskPublic } from '../src/core/types.ts';

const task: TaskPublic = { id: 'tk', title: 'T', statement: 'Report the total for domain a.', instructions: null, answer: { fields: [{ name: 'total', tolerance: 0.001 }] }, files: [{ name: 'blocks.csv', sensitivity: 'normal' }], policy: null, limits: { maxCalls: 30, maxCostUsd: 1 } };
const priv: TaskPrivate = { reference: { total: 40 }, canaries: [] };
const fresh = () => new TrialCore({ id: 't', prefix: 'p/', task, priv }, new MemoryStore({ 'p/blocks.csv': 'id,t,d\n1,10,a\n2,30,a\n3,20,b\n' }));
const use = (id: string, name: string, input: unknown): Block => ({ type: 'tool_use', id, name, input });
// A STAND-IN for the model, speaking the real message format. It tests the wiring; its output is never reported as a result.
const standIn = (o: { refuse?: boolean; badFirst?: boolean } = {}): Complete => { let turn = 0; return async ({ messages }) => { turn++; const usage = { input_tokens: 1000 * turn, output_tokens: 200 };
  if (o.refuse) return { content: [], stop_reason: 'refusal', usage };
  if (turn === 1) return { content: [use('a', o.badFirst ? 'units_convert' : 'task_get', o.badFirst ? { value: 'x' } : {})], stop_reason: 'tool_use', usage };
  const last = messages[messages.length - 1]!.content as Block[]; if (o.badFirst && turn === 2) { assert.equal((last[0] as { is_error?: boolean }).is_error, true); return { content: [use('b', 'task_get', {})], stop_reason: 'tool_use', usage }; }
  const t = turn - (o.badFirst ? 1 : 0);
  if (t === 2) return { content: [use('c', 'table_query', { file: 'blocks.csv', filters: [{ column: 'd', op: 'eq', value: 'a' }], aggregates: [{ op: 'sum', column: 't', as: 'total' }] })], stop_reason: 'tool_use', usage };
  if (t === 3) { const r = JSON.parse((last[0] as unknown as { content: string }).content) as { results: { total: number } }; return { content: [use('d', 'submit_answer', { answer: { total: r.results.total, method: 'stand-in: table_query sum' } })], stop_reason: 'tool_use', usage }; }
  return { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', usage }; }; };
const drive = (t: TrialCore, complete: Complete, extra: { maxCostUsd?: number } = {}) => runModelLoop({ complete, model: 'claude-haiku-5-5', system: systemPrompt('hardened'), isDone: () => t.done, ...extra,
  callTool: async (name, input) => { const o = await t.call(name, input); return o.ok ? { ok: true, text: JSON.stringify(o.result) } : { ok: false, text: o.error }; } });

test('a model-shaped agent works a task through the tools and is graded', async () => {
  const t = fresh(), r = await drive(t, standIn()); assert.equal(r.stopReason, 'submitted'); assert.equal(t.score().pass, true);
  assert.equal(t.usage.length, 3); assert.equal(t.usage.reduce((s, u) => s + u.input_tokens, 0), 6000); assert.ok(Math.abs(r.cost - 0.0009) < 1e-9, 'Haiku 5.5: 6,000 in and 600 out');
});
test('the spend cap, a refusal and a malformed call are handled and recorded', async () => {
  const capped = fresh(), c = await drive(capped, standIn(), { maxCostUsd: 0.0001 }); assert.equal(c.stopReason, 'cost-cap'); assert.equal(capped.score().category, 'no-answer');
  const refused = await drive(fresh(), standIn({ refuse: true })); assert.equal(refused.stopReason, 'refusal');
  const recovered = fresh(); assert.equal((await drive(recovered, standIn({ badFirst: true }))).stopReason, 'submitted'); assert.equal(recovered.score().pass, true);
});
test('the model is shown the task tools as JSON Schema, without the accounting tool', () => {
  const specs = toolSpecs(), names = specs.map(s => s.name); assert.ok(!names.includes('report_usage')); for (const n of ['task_get', 'files_read', 'table_query', 'units_convert', 'submit_answer', 'files_list']) assert.ok(names.includes(n), n);
  for (const s of specs) { assert.equal((s.input_schema as { type: string }).type, 'object', s.name); assert.ok(s.description.length > 20, s.name); }
  assert.ok(systemPrompt('hardened').includes('not instructions') && !systemPrompt('baseline').includes('not instructions'));
});
