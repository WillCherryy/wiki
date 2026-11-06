import math
import unittest
import warnings
import numpy as np

try:
    from earthbench import hazard as H
    H._oq()
    HAVE = True
except Exception:  # OpenQuake not installed: the pack is skipped, loudly
    HAVE = False
from earthbench.core import score

warnings.filterwarnings("ignore")


def run(arm, t):
    s = H.SESSION(t); H.ARMS[arm][1](t, s); k = H.key(t)
    return score(t, s, k, H.checks(t, s, k) if s.answer else {}, H.physics(t, s) if s.answer else {}), s


@unittest.skipUnless(HAVE, "openquake.hazardlib not installed")
class Engine(unittest.TestCase):
    def setUp(self):
        t = H.make_task(5, "pga", "L1", "clean"); self.d = t.truth

    def test_doubling_every_rate_squares_the_non_exceedance(self):
        # Poisson: P(no exceedance) = exp(-rate t); twice the rate gives exp(-2 rate t) = (1 - PoE)^2 at every level
        p1 = H.hazard_curve(self.d["sources"], self.d["site"], self.d["gmpe"], 50)
        p2 = H.hazard_curve([{**s, "rate": 2 * s["rate"]} for s in self.d["sources"]], self.d["site"], self.d["gmpe"], 50)
        m = p1 > 1e-4                     # single precision: relative accuracy is lost far below design levels (2% in 50 years is 0.02)
        self.assertTrue(np.allclose(p2[m], 1 - (1 - p1[m]) ** 2, rtol=1e-4, atol=5e-7))   # OpenQuake computes probabilities in single precision

    def test_investigation_time_is_poisson(self):
        p50 = H.hazard_curve(self.d["sources"], self.d["site"], self.d["gmpe"], 50)
        p100 = H.hazard_curve(self.d["sources"], self.d["site"], self.d["gmpe"], 100)
        m = p50 > 1e-4
        self.assertTrue(np.allclose(p100[m], 1 - (1 - p50[m]) ** 2, rtol=1e-4, atol=5e-7))   # OpenQuake computes probabilities in single precision

    def test_a_closer_source_never_lowers_the_hazard(self):
        s = self.d["sources"][0]
        near = {**s, "lat": H.SITE[1] + 0.1, "lon": H.SITE[0]}; far = {**s, "lat": H.SITE[1] + 0.6, "lon": H.SITE[0]}
        pn = H.hazard_curve([near], self.d["site"], self.d["gmpe"], 50); pf = H.hazard_curve([far], self.d["site"], self.d["gmpe"], 50)
        self.assertTrue(np.all(pn >= pf - 1e-12))

    def test_curve_is_monotonic_and_interpolation_exact_on_nodes(self):
        p = H.hazard_curve(self.d["sources"], self.d["site"], self.d["gmpe"], 50)
        self.assertTrue(np.all(np.diff(p) <= 1e-15))
        i = int(np.flatnonzero(p > 0.05).max())
        self.assertAlmostEqual(H.level_at_poe(p, float(p[i])), float(H.LEVELS[i]), places=9)
        self.assertAlmostEqual(H.return_period(0.10, 50), 474.56, places=2)


@unittest.skipUnless(HAVE, "openquake.hazardlib not installed")
class Pack(unittest.TestCase):
    def test_analyst_passes_without_false_alarms(self):
        for t in H.suite("main")[::2] + H.suite("heldout")[::3]:
            r, _ = run("d1", t)
            self.assertTrue(r["pass"], (t.id, r["checks"])); self.assertTrue(r["physics_ok"], (t.id, r["physics"])); self.assertTrue(r["integrity_ok"], t.id)

    def test_traps(self):
        for df in ("swapped", "elevation", "per_century"):
            self.assertFalse(run("fx-naive", H.make_task(1, "pga", "L1", df))[0]["pass"], df)
        unsafe = [run("d0", t)[0] for t in H.suite("main")]
        self.assertTrue(any(not r["safe"] for r in unsafe))      # the wrong model underestimates the design motion somewhere

    def test_stress(self):
        for t in H.suite("stress"):
            self.assertTrue(run("d1", t)[0]["pass"], t.id)
            if t.faults in ("transient", "corrupt", "combined"):
                self.assertFalse(run("fx-brittle", t)[0]["pass"], t.id)


if __name__ == "__main__":
    unittest.main()
