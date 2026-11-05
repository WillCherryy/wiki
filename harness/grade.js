'use strict';
// Grading in three classes. A task declares its class; the scorecard reports them separately because they mean different things.
//   rule       a script decides (file converts, units right, schema valid)
//   reference  compared with an expert or reference answer within a stated tolerance
//   judgement  no single truth: pass means within the spread of human experts (see tools/seismic.js)
const { reference } = require('./tasks');

// Review gate: deterministic checks that need no reference answer. The agent is told what failed and may correct itself;
// the scorecard counts how many tries that took.
function validate(answer) {
  const e = [], num = k => typeof answer[k] === 'number' && isFinite(answer[k]);
  if (!answer || typeof answer !== 'object') return ['answer must be an object'];
  for (const k of ['p90', 'p50', 'p10']) if (!num(k)) e.push(`${k} must be a finite number`);
  if (answer.unit !== 'MWe') e.push('unit must be "MWe"');
  if (!e.length) {
    if (!(answer.p90 > 0)) e.push('p90 must be positive');
    if (!(answer.p90 <= answer.p50 && answer.p50 <= answer.p10)) e.push('exceedance order violated: need p90 <= p50 <= p10');
    if (answer.p50 > 5000) e.push('p50 above 5,000 MWe is physically implausible for one prospect: check units');
  }
  if (typeof answer.method !== 'string' || answer.method.length < 10) e.push('method must say how the estimate was made');
  return e;
}

const TOL = { p50: 0.05, p90: 0.10, p10: 0.10 };   // relative; wider than the Monte Carlo error of the reference (well under 1 %)
function gradeResource(task, answer) {
  const ref = reference(task), checks = [], rel = (a, b) => Math.abs(a - b) / b;
  const bad = validate(answer); if (bad.length) return { pass: false, class: 'reference', category: 'format', checks: bad.map(m => ({ name: 'valid', ok: false, detail: m })) };
  for (const k of ['p50', 'p90', 'p10']) { const err = rel(answer[k], ref[k]); checks.push({ name: k + ' within ' + TOL[k] * 100 + ' % of reference', ok: err <= TOL[k], detail: `${answer[k].toFixed(2)} vs ${ref[k].toFixed(2)} (${(err * 100).toFixed(1)} %)` }); }
  const spread = (answer.p10 - answer.p90) / answer.p50, refSpread = (ref.p10 - ref.p90) / ref.p50;
  const pass = checks.every(c => c.ok);
  const category = pass ? null : spread < 0.05 && refSpread > 0.2 ? 'no-uncertainty' : 'value';
  return { pass, class: 'reference', category, checks };
}
module.exports = { validate, gradeResource, TOL };
