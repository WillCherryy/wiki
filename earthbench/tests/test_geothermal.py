import math
import unittest
import numpy as np
from earthbench import geothermal as G
from earthbench.core import score


def run(arm, t):
    s = G.SESSION(t); G.ARMS[arm][1](t, s); k = G.key(t)
    return score(t, s, k, G.checks(t, s, k) if s.answer else {}, G.physics(t, s) if s.answer else {}), s


class Engines(unittest.TestCase):
    def test_monte_carlo_collapses_to_the_closed_form(self):
        # degenerate distributions: every draw equals the USGS volumetric equation evaluated by hand
        A, h, T, phi, R = 10.0, 500.0, 240.0, 0.1, 0.12
        r = G.heat_in_place_mc((A,) * 3, (h,) * 3, (T,) * 3, (phi,) * 3, (R,) * 3, 2650, 1000, 830, 4600, 15, 0.12, 30, 0.9)
        H = A * 1e6 * h * (2650 * 1000 * (1 - phi) + 830 * 4600 * phi) * (T - 15)
        P = H * R * 0.12 / (30 * 0.9 * 365.25 * 86400) / 1e6
        self.assertAlmostEqual(r["heat_in_place_p50_ej"], H / 1e18, places=9)
        for k in ("mwe_p90", "mwe_p50", "mwe_p10"):
            self.assertAlmostEqual(r[k], P, places=6)

    def test_skin_formula_in_si_matches_field_units(self):
        # the SI constant -0.3514 and the field-unit +3.2275 give the same skin for the same well
        k_md, h_ft, mu_cp, ct_psi, rw_ft, phi, m_psi, dp_psi = 50.0, 100.0, 0.5, 1e-5, 0.35, 0.12, 20.0, 300.0
        s_field = 1.1513 * (dp_psi / m_psi - math.log10(k_md / (phi * mu_cp * ct_psi * rw_ft ** 2)) + 3.2275)
        k = k_md * 9.869233e-16; mu = mu_cp * 1e-3; ct = ct_psi / 6894.757293168361; rw = rw_ft * 0.3048
        s_si = 1.1513 * ((dp_psi * 6894.757) / (m_psi * 6894.757) - math.log10(k * 3600 / (phi * mu * ct * rw ** 2)) - 0.3514)
        self.assertAlmostEqual(s_field, s_si, places=2)


class Pack(unittest.TestCase):
    def test_analyst_passes_everywhere_without_false_alarms(self):
        for t in G.suite("main") + G.suite("heldout"):
            r, _ = run("d1", t)
            self.assertTrue(r["pass"], (t.id, r["checks"])); self.assertTrue(r["physics_ok"], t.id); self.assertTrue(r["integrity_ok"], t.id)

    def test_traps_bite(self):
        for df in ("units", "bad_null"):
            for kind in G.KINDS:
                t = G.make_task(1, kind, "L1", df)
                self.assertFalse(run("fx-naive", t)[0]["pass"], t.id)
        self.assertEqual(G.KINDS, ("hip",))                # the circular Horner kind is retired from every suite

    def test_las_reader(self):
        t = G.make_task(1, "hip", "L1", "units")
        head, curves, rows = G.parse_las(t.docs["gt1.las"])
        self.assertEqual(curves[0]["unit"], "FT"); self.assertEqual(curves[1]["unit"], "DEGF"); self.assertEqual(float(head["NULL"]["value"]), -999.25)

    def test_stress(self):
        for t in G.suite("stress"):
            self.assertTrue(run("d1", t)[0]["pass"], t.id)
            if t.faults in ("transient", "corrupt", "combined"):
                self.assertFalse(run("fx-brittle", t)[0]["pass"], t.id)


if __name__ == "__main__":
    unittest.main()
