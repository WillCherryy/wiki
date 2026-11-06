// Well-test tools and key-free physics checks, ported line for line from earthbench/welltest.py and welltest_engine.py so a live trial
// is graded exactly as the Python pack grades it. Tests replay the analyst pipeline through these and compare with the Python key.
import type { WellTestPhysics } from './types.ts';

export const MD = 9.869233e-16;   // m2 per millidarcy
export const TIME_TO_H: Record<string, number> = { h: 1, min: 1 / 60, s: 1 / 3600 };
export const PRESSURE_TO_PA: Record<string, number> = { Pa: 1, kPa: 1e3, MPa: 1e6, bar: 1e5, psi: 6894.757293168361 };

/** Bourdet derivative of dp = pws - pwf against ln of the Agarwal equivalent time tp dt / (tp + dt), smoothed over L natural-log units. */
export function bourdet(dt: number[], pws: number[], pwf: number, tp: number, L = 0.2): { dp: number[]; d: number[] } {
  const x = dt.map(t => Math.log(tp * t / (tp + t))), dp = pws.map(p => p - pwf), n = x.length, d = new Array<number>(n).fill(NaN);
  for (let i = 1; i < n - 1; i++) {
    let j = i - 1; while (j > 0 && x[i]! - x[j]! < L) j--;
    let k = i + 1; while (k < n - 1 && x[k]! - x[i]! < L) k++;
    const dl = x[i]! - x[j]!, dr = x[k]! - x[i]!; if (dl <= 0 || dr <= 0) continue;
    const sl = (dp[i]! - dp[j]!) / dl, sr = (dp[k]! - dp[i]!) / dr; d[i] = (sl * dr + sr * dl) / (dl + dr);
  }
  return { dp, d };
}

/** Least-squares Horner line between two shut-in times (hours): slope m per log10 cycle, p*, the line at 1 h, r2. */
export function hornerFit(dt: number[], p: number[], tp: number, lo: number, hi: number) {
  const xs: number[] = [], ys: number[] = [];
  dt.forEach((t, i) => { if (t >= lo && t <= hi) { xs.push(Math.log10((tp + t) / t)); ys.push(p[i]!); } });
  if (xs.length < 3) throw new Error('fewer than 3 points in the window');
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; }
  const slope = sxy / sxx, icpt = my - slope * mx;
  let ssr = 0, sst = 0; for (let i = 0; i < n; i++) { ssr += (ys[i]! - (icpt + slope * xs[i]!)) ** 2; sst += (ys[i]! - my) ** 2; }
  const m = -slope;
  return { m_pa_per_cycle: m, p_star_pa: icpt, p1h_pa: icpt - m * Math.log10(tp + 1), r2: 1 - ssr / sst, points: n };
}

/** Permeability and skin from a Horner slope (Pa per log10 cycle) and the line's pressure at 1 h, SI; water, formation volume factor 1. */
export function interpret(m: number, q: number, mu: number, h: number, phi: number, ct: number, rw: number, p1h: number, pwf: number) {
  const k = 2.303 * q * mu / (4 * Math.PI * m * h);
  const s = 1.1513 * ((p1h - pwf) / m - Math.log10(k * 3600 / (phi * mu * ct * rw ** 2)) - 0.3514);
  return { k_m2: k, k_md: k / MD, kh_md_m: k / MD * h, skin: s };
}

/** numpy.percentile, linear interpolation. */
function percentile(v: number[], q: number) { const s = [...v].sort((a, b) => a - b), pos = (s.length - 1) * q / 100, lo = Math.floor(pos), hi = Math.ceil(pos); return s[lo]! + (s[hi]! - s[lo]!) * (pos - lo); }
const median = (v: number[]) => percentile(v, 50);

/** Key-free checks: the fitted window is flat on the derivative, k reproduces the data's slope there, the fault claim matches the late
 *  derivative, and skin is attainable. Uses only the data and the brief, as earthbench.welltest.physics does. */
export function physicsChecks(a: Record<string, unknown>, P: WellTestPhysics): { name: string; ok: boolean; detail: string }[] {
  const out: { name: string; ok: boolean; detail: string }[] = [];
  const lo = a['dt_from_h'] as number, hi = a['dt_to_h'] as number, k = a['k_md'] as number, skin = a['skin'] as number, fault = a['fault_seen'] as boolean;
  const { d } = bourdet(P.dt_h, P.p_pa, P.pwf, P.tp, 0.3);
  const idx = P.dt_h.map((t, i) => i).filter(i => P.dt_h[i]! >= lo && P.dt_h[i]! <= hi && Number.isFinite(d[i]!));
  if (idx.length >= 4 && hi > lo) {
    const dw = idx.map(i => d[i]!), r = percentile(dw, 90) / Math.max(percentile(dw, 10), 1e-9);
    out.push({ name: 'window flat on the derivative', ok: r <= 1.4, detail: `the derivative varies by a factor ${r.toFixed(2)} over ${lo.toPrecision(3)} to ${hi.toPrecision(3)} h (radial flow is flat: at most 1.4)` });
    const xs = idx.map(i => Math.log10((P.tp + P.dt_h[i]!) / P.dt_h[i]!)), ys = idx.map(i => P.p_pa[i]!), n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i]! - mx) * (ys[i]! - my); sxx += (xs[i]! - mx) ** 2; }
    const mObs = -sxy / sxx, mImpl = k > 0 ? 2.303 * P.q * P.mu / (4 * Math.PI * k * MD * P.h) : Infinity;
    out.push({ name: 'permeability matches the data in the window', ok: Math.abs(mImpl - mObs) <= 0.05 * Math.abs(mObs), detail: `slope implied by k ${(mImpl / 1e3).toFixed(2)} kPa/cycle against the data's ${(mObs / 1e3).toFixed(2)} kPa/cycle` });
    const plateau = median(dw), late = d.filter(Number.isFinite).slice(-12), ratio = plateau > 0 ? median(late) / plateau : 0;
    out.push({ name: 'fault claim matches the late derivative', ok: (ratio >= 1.5) === !!fault, detail: `late derivative ${ratio.toFixed(2)} times the window's; fault_seen ${fault}` });
  } else out.push({ name: 'window flat on the derivative', ok: false, detail: `the window ${lo} to ${hi} h holds fewer than 4 points` });
  out.push({ name: 'skin physically attainable', ok: skin >= -6 && skin <= 100, detail: `skin ${skin.toFixed(2)} (below about -6 is not attainable for a vertical well)` });
  return out;
}
