'use strict';
// Comparing horizon picks. A pick set is an array of two-way times (ms), one per trace, or null where not picked.
// Interpretation has no single truth, so the pass mark is the disagreement between two human interpreters:
// an agent's pick passes where it lies within the spread of the two humans plus a stated tolerance.
function pickDifference(a, b) {
  if (a.length !== b.length) throw new Error('pick sets must have the same number of traces');
  const d = []; for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) d.push(a[i] - b[i]);
  if (!d.length) return { n: 0 };
  const n = d.length, bias = d.reduce((s, x) => s + x, 0) / n, rms = Math.sqrt(d.reduce((s, x) => s + x * x, 0) / n), abs = d.map(Math.abs).sort((x, y) => x - y);
  return { n, biasMs: bias, rmsMs: rms, p50AbsMs: abs[Math.floor((n - 1) * .5)], p90AbsMs: abs[Math.floor((n - 1) * .9)], maxAbsMs: abs[n - 1] };
}
// Fraction of the agent's picks that fall within the interval spanned by interpreters A and B (widened by tolMs on each side).
function withinHumanSpread(agent, a, b, tolMs = 0) {
  if (agent.length !== a.length || a.length !== b.length) throw new Error('pick sets must have the same number of traces');
  let k = 0, n = 0; for (let i = 0; i < agent.length; i++) { if (agent[i] == null || a[i] == null || b[i] == null) continue; n++; if (agent[i] >= Math.min(a[i], b[i]) - tolMs && agent[i] <= Math.max(a[i], b[i]) + tolMs) k++; }
  return { within: k, n, fraction: n ? k / n : NaN };
}
module.exports = { pickDifference, withinHumanSpread };
