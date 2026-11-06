import math
import unittest
import numpy as np
from earthbench import wind as W
from earthbench.core import score


def run(arm, t):
    s = W.SESSION(t); W.ARMS[arm][1](t, s); k = W.key(t)
    return score(t, s, k, W.checks(t, s, k) if s.answer else {}, W.physics(t, s) if s.answer else {}), s


class Engine(unittest.TestCase):
    def test_power_curve_respects_betz(self):
        v, p = W.power_curve()
        A = math.pi * (W.ROTOR_D / 2) ** 2
        cp = np.divide(p * 1000, 0.5 * W.RHO0 * A * v ** 3, out=np.zeros_like(p), where=v > 0)
        self.assertTrue(np.all(cp <= 16 / 27 + 1e-12)); self.assertEqual(p.max(), W.RATED)

    def test_no_shear_at_equal_height_and_standard_air(self):
        n = 200; ws = np.linspace(4, 14, n); T = np.full(n, 15.0); p = np.full(n, W.RHO0 * W.RD * 288.15)
        r = W.aep(ws, T, p, 100, 100, 0.2, 1.0, 0.0)
        self.assertAlmostEqual(r["mean_hub_speed_ms"], ws.mean(), places=9)          # alpha does nothing at equal heights
        self.assertAlmostEqual(r["mean_density"], W.RHO0, places=9)
        cv, cp = W.power_curve()
        expect = np.interp(ws, cv, cp).sum() / 1000 * W.HOURS / n                      # density correction is exactly 1 at 1.225 kg/m3
        self.assertAlmostEqual(r["gross_aep_mwh"], expect, places=6)

    def test_shear_scales_speed_exactly(self):
        ws, T, p = W.wind_year(4)
        a = W.aep(ws, T, p, 80, 120, 0.2, 1, 0)
        self.assertAlmostEqual(a["mean_hub_speed_ms"], ws.mean() * (120 / 80) ** 0.2, places=9)

    def test_denser_air_never_lowers_energy(self):
        ws, T, p = W.wind_year(4)
        self.assertGreaterEqual(W.aep(ws, T - 15, p, 80, 120, 0.2, 1, 0)["gross_aep_mwh"], W.aep(ws, T, p, 80, 120, 0.2, 1, 0)["gross_aep_mwh"])


class Pack(unittest.TestCase):
    def test_analyst_passes_without_false_alarms(self):
        for t in W.suite("main") + W.suite("heldout"):
            r, _ = run("d1", t)
            self.assertTrue(r["pass"], (t.id, r["checks"])); self.assertTrue(r["physics_ok"], t.id)

    def test_knots_read_as_metres_per_second_break_betz(self):
        r, _ = run("fx-naive", W.make_task(1, "aep", "L1", "knots"))
        self.assertFalse(r["pass"]); self.assertFalse(r["safe"]); self.assertFalse(r["physics"]["betz_limit"]["ok"])

    def test_pressure_in_hpa_is_refused_by_the_tool(self):
        t = W.make_task(1, "aep", "L1", "hpa"); s = W.SESSION(t)
        ok, e = s.call("wind_aep", {"dataset": "mast", "measurement_height_m": 80, "hub_height_m": 120, "shear_alpha": 0.2, "availability": 0.97, "losses_fraction": 0.1})
        self.assertFalse(ok); self.assertIn("density", e)

    def test_stress(self):
        for t in W.suite("stress"):
            self.assertTrue(run("d1", t)[0]["pass"], t.id)
            if t.faults in ("transient", "corrupt", "combined"):
                self.assertFalse(run("fx-brittle", t)[0]["pass"], t.id)


if __name__ == "__main__":
    unittest.main()
