'use strict';
// Scoring shared by the fixture trial and the model trial: one row per task, one summary per agent.
const { gradeResource, validate } = require('./grade');
const { wilson } = require('./stats');

// task: the task; trial: a finished Trial; error: a message if the agent crashed; extra: fields to add to the row (cost, stop reason, ...)
function scoreRow(task, trial, error = null, extra = {}) {
  trial.ended = trial.ended || Date.now();
  const final = trial.accepted ? gradeResource(task, trial.accepted) : { pass: false, class: 'reference', category: extra.stopReason && extra.stopReason !== 'submitted' ? extra.stopReason : 'no-answer', checks: [] };
  const first = trial.attempts[0] ? (validate(trial.attempts[0].answer).length ? { pass: false } : gradeResource(task, trial.attempts[0].answer)) : { pass: false };
  return { task: task.id, pass: final.pass ? 1 : 0, firstPass: first.pass ? 1 : 0, category: final.category, gate: trial.attempts.length > 1 ? 'corrected after review gate' : null,
    grade: final, summary: trial.summary(), trace: trial.trace, attempts: trial.attempts.map(a => a.answer), error, ...extra };
}

function summarise(name, rows, extra = {}) {
  const k = rows.reduce((s, r) => s + r.pass, 0), k1 = rows.reduce((s, r) => s + r.firstPass, 0), cats = {};
  rows.forEach(r => { if (r.category) cats[r.category] = (cats[r.category] || 0) + 1; });
  return { name, rows, pass: wilson(k, rows.length), firstPass: wilson(k1, rows.length), failures: cats, corrected: rows.filter(r => r.gate).length, meanCalls: rows.reduce((s, r) => s + r.summary.calls, 0) / rows.length, ...extra };
}
module.exports = { scoreRow, summarise };
