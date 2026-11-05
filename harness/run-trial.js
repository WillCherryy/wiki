#!/usr/bin/env node
'use strict';
// Run agents over the synthetic tasks and score them: pass rate with a Wilson interval, first attempt versus after the review gate,
// failure categories, calls and time, and a paired comparison of every agent with the first.
const fs = require('fs'), path = require('path');
const { generate, reference } = require('./tasks');
const { Trial, call } = require('./gateway');
const { gradeResource, validate } = require('./grade');
const { wilson, pairedDiff } = require('./stats');
const { AGENTS } = require('./agents');

function runArm(name, agent, tasks) {
  const rows = tasks.map(task => {
    const trial = new Trial(`${name}:${task.id}`, task), t0 = Date.now(); let error = null;
    try { agent(trial); } catch (e) { error = e.message; }
    trial.ended = trial.ended || Date.now();
    const final = trial.accepted ? gradeResource(task, trial.accepted) : { pass: false, class: 'reference', category: 'no-answer', checks: [] };
    const first = trial.attempts[0] ? (validate(trial.attempts[0].answer).length ? { pass: false } : gradeResource(task, trial.attempts[0].answer)) : { pass: false };
    return { task: task.id, pass: final.pass ? 1 : 0, firstPass: first.pass ? 1 : 0, category: final.category, gate: trial.attempts.length > 1 ? 'corrected after review gate' : null, grade: final, summary: trial.summary(), trace: trial.trace, attempts: trial.attempts.map(a => a.answer), error };
  });
  const k = rows.reduce((s, r) => s + r.pass, 0), k1 = rows.reduce((s, r) => s + r.firstPass, 0), cats = {};
  rows.forEach(r => { if (r.category) cats[r.category] = (cats[r.category] || 0) + 1; });
  return { name, rows, pass: wilson(k, rows.length), firstPass: wilson(k1, rows.length), failures: cats, corrected: rows.filter(r => r.gate).length, meanCalls: rows.reduce((s, r) => s + r.summary.calls, 0) / rows.length };
}

function runTrial({ n = 24, seed = 20261105 } = {}) {
  const tasks = generate(n, seed), arms = Object.entries(AGENTS).map(([name, fn]) => runArm(name, fn, tasks));
  const base = arms[0], pairs = arms.slice(1).map(a => ({ a: base.name, b: a.name, ...pairedDiff(base.rows.map(r => r.pass), a.rows.map(r => r.pass)) }));
  return { synthetic: true, generated: new Date().toISOString().slice(0, 10), nTasks: tasks.length, seed, class: 'reference', tasks: tasks.map(t => ({ id: t.id, inputs: t.inputs, reference: reference(t) })), arms, pairs };
}

if (require.main === module) {
  const r = runTrial(), pc = x => (x * 100).toFixed(0) + ' %';
  console.log(`Synthetic trial: ${r.nTasks} resource-estimate tasks, reference-graded\n`);
  for (const a of r.arms) console.log(`${a.name.padEnd(26)} pass ${pc(a.pass.rate)} (${pc(a.pass.lo)} to ${pc(a.pass.hi)})   first attempt ${pc(a.firstPass.rate)}   corrected by gate ${a.corrected}   failures ${JSON.stringify(a.failures)}`);
  for (const p of r.pairs) console.log(`${p.a} minus ${p.b}: ${(p.diff * 100).toFixed(0)} points (${(p.lo * 100).toFixed(0)} to ${(p.hi * 100).toFixed(0)}), ${p.verdict}`);
}
module.exports = { runTrial };
