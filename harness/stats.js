'use strict';
// Statistics for scoring agents. Rates carry a Wilson interval; two agents run on the same tasks are compared with a paired bootstrap.

// Seeded generator (mulberry32): every run is reproducible.
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// Wilson score interval for k successes in n trials (95 % by default).
function wilson(k, n, z = 1.959964) {
  if (!(n > 0)) return { rate: NaN, lo: NaN, hi: NaN, n: 0, k };
  const p = k / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  // at k = 0 and k = n the bounds are exactly 0 and 1 (rounding would leave them a hair off)
  return { rate: p, lo: k === 0 ? 0 : Math.max(0, c - h), hi: k === n ? 1 : Math.min(1, c + h), n, k };
}

// q-quantile of an ascending array, linear interpolation.
function quantile(sorted, q) { const n = sorted.length; if (!n) return NaN; const x = (n - 1) * q, i = Math.floor(x), f = x - i; if (i + 1 >= n || sorted[i] === sorted[i + 1]) return sorted[i]; return sorted[i] + (sorted[i + 1] - sorted[i]) * f; }   // equal neighbours return exactly that value, so identical samples give identical percentiles

// Distribution-free 95 % interval for the q-quantile of a sample, from the binomial: the sampling error of a Monte Carlo percentile.
function quantileCI(sorted, q, z = 1.959964) {
  const n = sorted.length, m = n * q, s = z * Math.sqrt(n * q * (1 - q));
  return { lo: sorted[Math.max(0, Math.floor(m - s))], hi: sorted[Math.min(n - 1, Math.ceil(m + s))] };
}

// Paired comparison of two agents on the same tasks. a and b are 0/1 arrays of equal length.
// Returns the difference in pass rate (a - b) with a bootstrap 95 % interval, and the discordant counts.
function pairedDiff(a, b, { reps = 4000, seed = 1 } = {}) {
  if (a.length !== b.length) throw new Error('paired arrays must have equal length');
  const n = a.length, d = a.map((x, i) => x - b[i]), mean = d.reduce((s, x) => s + x, 0) / n, r = rng(seed), means = [];
  for (let k = 0; k < reps; k++) { let s = 0; for (let i = 0; i < n; i++) s += d[(r() * n) | 0]; means.push(s / n); }
  means.sort((x, y) => x - y);
  const aOnly = d.filter(x => x > 0).length, bOnly = d.filter(x => x < 0).length;
  const lo = quantile(means, .025), hi = quantile(means, .975);
  return { diff: mean, lo, hi, aOnly, bOnly, n, verdict: lo > 0 ? 'a better' : hi < 0 ? 'b better' : 'inconclusive' };
}

module.exports = { rng, wilson, quantile, quantileCI, pairedDiff };
