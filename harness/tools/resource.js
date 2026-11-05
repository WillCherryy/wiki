'use strict';
// Volumetric heat-in-place resource estimate with Monte Carlo.
//   heat in place   Q  = A h (rho c) (T - T0)
//   recoverable     Qr = Rg Q
//   electric power  P  = Qr eta / (life * seconds per year * load factor)
// A volumetric method of this kind is standard for a first-pass geothermal resource estimate (Muffler and Cataldi, 1978 is the usual
// reference; check the citation before relying on it). Every input is a distribution, so the answer is a distribution.
// Exceedance convention (oil, gas and geothermal practice): P90 is the value exceeded with 90 % probability, so P90 < P50 < P10.
const { rng, quantile, quantileCI } = require('../stats');
const YEAR = 3.15576e7;

function sampler(d, r) {   // d: { kind: 'tri'|'uniform'|'fixed', min, mode, max, value }
  if (d.kind === 'fixed') return () => d.value;
  if (d.kind === 'uniform') return () => d.min + (d.max - d.min) * r();
  if (d.kind === 'tri') { const a = d.min, b = d.max, c = d.mode, F = (c - a) / (b - a); return () => { const u = r(); return u < F ? a + Math.sqrt(u * (b - a) * (c - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - c)); }; }
  throw new Error('unknown distribution kind: ' + d.kind);
}

// inputs (SI-friendly units): areaKm2, thicknessM, tempC (reservoir), refTempC, rhoC (MJ/m3/K), recovery (0..1), efficiency (0..1), lifeYears, loadFactor (0..1)
const KEYS = ['areaKm2', 'thicknessM', 'tempC', 'refTempC', 'rhoC', 'recovery', 'efficiency', 'lifeYears', 'loadFactor'];
function powerMWe(v) { const Q = v.areaKm2 * 1e6 * v.thicknessM * v.rhoC * 1e6 * (v.tempC - v.refTempC); return Q * v.recovery * v.efficiency / (v.lifeYears * YEAR * v.loadFactor) / 1e6; }

function monteCarlo(inputs, { n = 20000, seed = 1 } = {}) {
  for (const k of KEYS) if (!inputs[k]) throw new Error('missing input: ' + k);
  const r = rng(seed), S = {}; for (const k of KEYS) S[k] = sampler(inputs[k], r);
  const out = new Float64Array(n), v = {};
  for (let i = 0; i < n; i++) { for (const k of KEYS) v[k] = S[k](); out[i] = v.tempC > v.refTempC ? powerMWe(v) : 0; }
  const s = Array.from(out).sort((x, y) => x - y), mean = s.reduce((a, b) => a + b, 0) / n;
  const P = p => quantile(s, 1 - p / 100), CI = p => quantileCI(s, 1 - p / 100);   // P(p): value exceeded with probability p %
  const bins = 40, lo = s[0], hi = s[n - 1], w = (hi - lo) / bins || 1, hist = new Array(bins).fill(0); for (const x of s) hist[Math.min(bins - 1, Math.floor((x - lo) / w))]++;
  // sensitivity: rank correlation is overkill here; use the share of log-variance each input contributes (inputs are independent)
  return { n, seed, unit: 'MWe', mean, p90: P(90), p50: P(50), p10: P(10), p50ci: CI(50), p90ci: CI(90), p10ci: CI(10), hist: { lo, hi, counts: hist } };
}

// Field-unit conversion for the inputs a task may be given in.
const AREA = { km2: 1, acre: 0.00404685642, mi2: 2.58998811 }, LEN = { m: 1, ft: 0.3048 };
const toC = (x, u) => u === 'F' ? (x - 32) * 5 / 9 : u === 'K' ? x - 273.15 : x;
function normalise(task) {   // a task's inputs (with units) to the SI-friendly inputs above
  const t = task.inputs, dist = (d, f) => d.kind === 'fixed' ? { kind: 'fixed', value: f(d.value) } : d.kind === 'uniform' ? { kind: 'uniform', min: f(d.min), max: f(d.max) } : { kind: 'tri', min: f(d.min), mode: f(d.mode), max: f(d.max) };
  const a = AREA[t.area.unit], l = LEN[t.thickness.unit];
  return { areaKm2: dist(t.area, x => x * a), thicknessM: dist(t.thickness, x => x * l), tempC: dist(t.temperature, x => toC(x, t.temperature.unit)), refTempC: dist(t.refTemp, x => toC(x, t.refTemp.unit)),
    rhoC: t.rhoC, recovery: t.recovery, efficiency: t.efficiency, lifeYears: t.lifeYears, loadFactor: t.loadFactor };
}
// the same inputs read as if they were already SI (what an agent that skips unit handling would do)
function unitBlind(task) { const t = task.inputs, same = d => d; return { areaKm2: same(t.area), thicknessM: same(t.thickness), tempC: same(t.temperature), refTempC: same(t.refTemp), rhoC: t.rhoC, recovery: t.recovery, efficiency: t.efficiency, lifeYears: t.lifeYears, loadFactor: t.loadFactor }; }
// a single deterministic point estimate: every input at its central value (what an agent that ignores uncertainty would do)
function pointEstimate(inputs) { const c = d => d.kind === 'fixed' ? d.value : d.kind === 'uniform' ? (d.min + d.max) / 2 : d.mode; const v = {}; for (const k of KEYS) v[k] = c(inputs[k]); return powerMWe(v); }

module.exports = { monteCarlo, normalise, unitBlind, pointEstimate, powerMWe, KEYS };
