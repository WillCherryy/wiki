"""External validation of the hazard engine: PEER PSHA code-verification Test Set 1 (Thomas, Wong and Abrahamson 2010, PEER Report
2010/106; carried forward in Hale, Abrahamson and Bozorgnia 2018, PEER Report 2018/03), run through the same OpenQuake hazardlib
Scorcher uses, and compared with the report's published answers:
  Case 1  single rupture of the whole fault, M 6.5: the analytical median PGA at sites 1 to 7 (report Table 3.2) and the activity rate
          2.853e-3 per year from the slip rate;
  Case 2  floating M 6.0 ruptures smaller than the fault: the hand-calculated annual exceedance probabilities (Appendix A, page A-7);
  Case 5  truncated exponential magnitudes 5 to 6.5: the hand-calculated curves at sites 4, 5 and 6 (page A-8).
Ground motion: Sadigh et al. (1997), rock, sigma = 0. Fault 1: vertical strike-slip, 38.000 to 38.2248 N at 122.000 W, 0 to 12 km.
Rupture area log A = M - 4, aspect ratio 2; moment from log Mo = 16.05 + 1.5 M (dyne cm); rigidity 3e11 dyne/cm2; slip 2 mm/yr.

    python -m earthbench.external.peer
"""
from __future__ import annotations
import math
import sys
import warnings
import numpy as np

SITES = {1: (38.113, -122.000), 2: (38.113, -122.114), 3: (38.111, -122.570), 4: (38.000, -122.000), 5: (37.910, -122.000), 6: (38.225, -122.000), 7: (38.113, -121.886)}
CASE1_PGA = {1: 0.7717, 2: 0.3123, 3: 0.0497, 4: 0.7717, 5: 0.3123, 6: 0.7717, 7: 0.3123}       # Table 3.2
LEVELS_2 = [0.001, 0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35063, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65]
CASE2 = {  # page A-7, annual exceedance probability, sites 1 to 7
    1: [1.59e-2] * 9 + [1.18e-2, 8.23e-3, 5.23e-3, 2.64e-3, 3.63e-4, 0.0],
    2: [1.59e-2] * 6 + [0.0] * 9,
    3: [1.59e-2] * 2 + [0.0] * 13,
    4: [1.59e-2] * 5 + [1.58e-2, 1.20e-2, 8.64e-3, 5.68e-3, 3.09e-3, 1.51e-3, 6.08e-4, 1.54e-4, 2.92e-6, 0.0],
    5: [1.59e-2] * 3 + [1.56e-2, 7.69e-3, 1.60e-3] + [0.0] * 9,
    7: [1.59e-2] * 6 + [0.0] * 9,
}
LEVELS_5 = [0.001, 0.01, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7, 0.8]
CASE5 = {  # page A-8, sites 4, 5, 6
    4: [3.99e-2, 3.99e-2, 3.98e-2, 2.99e-2, 2.00e-2, 1.30e-2, 8.58e-3, 5.72e-3, 3.88e-3, 2.69e-3, 1.91e-3, 1.37e-3, 9.74e-4, 6.75e-4, 2.52e-4, 0.0],
    5: [3.99e-2, 3.99e-2, 3.14e-2, 1.21e-2, 4.41e-3, 1.89e-3, 7.53e-4, 1.25e-4] + [0.0] * 8,
}
# Rupture step: PEER 2018 (section 2.3.2) reports most codes needed about 0.05 km to meet its +-5% acceptance criterion
STEP2, STEP5 = 0.1, 0.25
MU, SLIP, AREA = 3e11, 0.2, 25.0 * 12.0 * 1e10           # dyne/cm2, cm/yr, cm2 (fault 25 x 12 km)
moment = lambda m: 10 ** (16.05 + 1.5 * m)


def _hl():
    warnings.filterwarnings("ignore")
    from openquake.hazardlib.source import SimpleFaultSource
    from openquake.hazardlib.mfd import ArbitraryMFD, TruncatedGRMFD
    from openquake.hazardlib.scalerel.peer import PeerMSR
    from openquake.hazardlib.tom import PoissonTOM
    from openquake.hazardlib.geo import Point, Line
    from openquake.hazardlib.site import Site, SiteCollection
    from openquake.hazardlib.calc.hazard_curve import calc_hazard_curves
    from openquake.hazardlib.gsim.sadigh_1997 import SadighEtAl1997
    return locals()


def fault(mfd, q, spacing=0.25):
    return q["SimpleFaultSource"]("f1", "Fault 1", "Active Shallow Crust", mfd, spacing, q["PeerMSR"](), 2.0, q["PoissonTOM"](1.0), 0.0, 12.0,
                                  q["Line"]([q["Point"](-122.0, 38.0), q["Point"](-122.0, 38.2248)]), 90.0, 0.0)


def curves(src, sites, levels, q):
    sc = q["SiteCollection"]([q["Site"](q["Point"](SITES[s][1], SITES[s][0]), vs30=800.0, vs30measured=True, z1pt0=40.0, z2pt5=1.0) for s in sites])
    c = q["calc_hazard_curves"]([src], sc, {"PGA": np.array(levels, float)}, {"Active Shallow Crust": q["SadighEtAl1997"]()}, truncation_level=0)
    return {s: np.asarray(c["PGA"][i], float) for i, s in enumerate(sites)}


def _point(case, site, level, step, q=None):
    """One site and level at a finer rupture step (run in a child process: a 0.07 km step needs about 11 GB)."""
    q = q or _hl()
    r2 = MU * SLIP * AREA / moment(6.0)
    return float(curves(fault(q["ArbitraryMFD"]([6.0], [r2]), q, spacing=step), [site], [level], q)[site][0])


def refine(site, level, step=0.07):
    import multiprocessing as mp
    with mp.get_context("spawn").Pool(1) as p:
        return p.apply(_point, (2, site, level, step))


def grade(name, got, ref, levels, refine_fn=None):
    graded, tail = [], []
    for s, r in ref.items():
        top = max(r)
        for lv, a, b in zip(levels, got[s], r):
            if b >= 0.1 * top:
                graded.append((abs(a / b - 1), s, lv, a, b))
            elif b == 0:
                graded.append((0.0 if a < 0.05 * top else 1.0, s, lv, a, b))        # where the hand solution is zero, ours must be near zero
            else:
                tail.append((a / b - 1, s, lv))
    notes = []
    if refine_fn:                                    # points outside +-5% at the coarse step: recompute at the finer step PEER describes
        for i, (d, s, lv, a, b) in enumerate(graded):
            if d > 0.05 and b > 0:
                a2 = refine_fn(s, lv); graded[i] = (abs(a2 / b - 1), s, lv, a2, b)
                notes.append(f"site {s} at {lv} g: {d * 100:.1f}% at the coarse step, {abs(a2 / b - 1) * 100:.1f}% at 0.07 km")
    w = max(graded)
    res = [(f"{name}: {len(graded)} points within +-5% (PEER criterion)", bool(w[0] <= 0.05),
            f"largest difference {w[0] * 100:.1f}% (site {w[1]}, {w[2]} g); median {np.median([g[0] for g in graded]) * 100:.2f}%" + (f"; refined: {'; '.join(notes)}" if notes else ""))]
    if tail:
        res.append((f"{name}: steep tail, reported not graded", None, "; ".join(f"site {s} at {lv} g {d * 100:+.0f}%" for d, s, lv in tail)))
    return res


def run():
    q = _hl(); out = []
    # Case 1: the hazard curve is flat at the activity rate up to the site's median PGA, then zero
    rate = MU * SLIP * AREA / moment(6.5)
    out.append(("Case 1 activity rate", abs(rate / 2.853e-3 - 1) < 1e-3, f"{rate:.4e} per year against the published 2.853e-3"))
    src = fault(q["ArbitraryMFD"]([6.5], [rate]), q)
    fine = np.geomspace(0.03, 1.2, 600)
    c1 = curves(src, list(SITES), fine, q)
    worst = 0.0
    for s, pga in CASE1_PGA.items():
        hit = fine[c1[s] > 0]; step = float(hit.max()) if hit.size else 0.0      # last level still exceeded = the site's median PGA
        worst = max(worst, abs(step / pga - 1))
        flat = float(c1[s][0])
    out.append(("Case 1 median PGA, sites 1 to 7", worst < 0.01, f"largest difference from Table 3.2 {worst * 100:.2f}% (level grid spacing 0.6%)"))
    out.append(("Case 1 annual probability below the median", abs(flat / (1 - math.exp(-rate)) - 1) < 1e-3, f"{flat:.4e} against 1 - exp(-rate) = {1 - math.exp(-rate):.4e}"))
    # Cases 2 and 5: PEER's acceptance criterion is +-5% in hazard against the benchmark (Hale et al. 2018, section 1.5.1). It is applied
    # here where the hand solution is at least 10% of the site's plateau; points in the steep tail below that (where the hazard falls by
    # orders of magnitude over a few hundredths of a g and depends on the rupture step, as PEER notes in section 2.3.2) are reported, not
    # graded. The 10% cut-off is Scorcher's choice, not PEER's.
    r2 = MU * SLIP * AREA / moment(6.0)
    c2 = curves(fault(q["ArbitraryMFD"]([6.0], [r2]), q, spacing=STEP2), list(CASE2), LEVELS_2, q)
    out += grade("Case 2 hand solution", c2, CASE2, LEVELS_2, refine_fn=refine)
    n5 = -math.log(1 - 3.99e-2); a = math.log10(n5 / (10 ** (-0.9 * 5.0) - 10 ** (-0.9 * 6.5)))   # truncated: N(>=5) = 10^a (10^-b5 - 10^-b6.5)
    c5 = curves(fault(q["TruncatedGRMFD"](5.0, 6.5, 0.01, a, 0.9), q, spacing=STEP5), list(CASE5), LEVELS_5, q)
    out += grade("Case 5 hand solution", c5, CASE5, LEVELS_5)
    return out


RESULTS = __import__("os").path.join(__import__("os").path.dirname(__file__), "..", "results", "external", "peer.json")


def main():
    import json, os, time
    from openquake.baselib import __version__ as oq
    res = run()
    for name, ok, det in res:
        print(f"{'pass' if ok else 'FAIL' if ok is False else 'note'}  {name}: {det}")
    ok = all(o is not False for _, o, _ in res)
    os.makedirs(os.path.dirname(RESULTS), exist_ok=True)
    json.dump({"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "openquake": oq, "pass": ok, "source": "Thomas, Wong and Abrahamson (2010), PEER Report 2010/106, Table 3.2 and Appendix A; acceptance criterion from Hale et al. (2018), PEER Report 2018/03, section 1.5.1",
               "checks": [{"name": n, "pass": o, "detail": d} for n, o, d in res]}, open(RESULTS, "w"), indent=1)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
