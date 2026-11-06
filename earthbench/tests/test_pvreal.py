import unittest
import numpy as np
from earthbench import pvreal as R
from earthbench.core import score


def run(arm, t):
    s = R.SESSION(t); R.ARMS[arm][1](t, s); k = R.key(t)
    return score(t, s, k, R.checks(t, s, k) if s.answer else {}, R.physics(t, s) if s.answer else {}), s


class Data(unittest.TestCase):
    def test_real_files_as_exported(self):
        # every site-year is a full PVGIS year, horizontal plane, no horizon, SARAH-2 and ERA5
        for site, year in R.SITES:
            d = R.raw(site, year)
            self.assertEqual(len(d["outputs"]["hourly"]), 8784 if year % 4 == 0 else 8760)
            self.assertEqual(d["inputs"]["mounting_system"]["fixed"]["slope"]["value"], 0)
            self.assertFalse(d["inputs"]["meteo_data"]["use_horizon"])
            self.assertEqual(d["inputs"]["meteo_data"]["radiation_db"], "PVGIS-SARAH2")

    def test_reasonable_choices_stay_inside_the_tolerance(self):
        # the H_sun cut-off (0.5 to 5 degrees) and the time stamp moved energy by at most 0.4% at eight sites (1.0% only for a
        # half-hour shift at Nairobi): well inside the 2% tolerance
        for t in R.suite("main")[::3]:
            tbl, d, k = t.data["pvgis"], t.truth, R.key(t)["annual_energy_mwh"]
            for c in (0.5, 5.0):
                self.assertLess(abs(R._energy(tbl, d, *R.key_inputs(tbl, c))["annual_energy_mwh"] / k - 1), 0.005)
            t0 = R.parse_times(tbl["time"]).floor("h")
            self.assertLess(abs(R._energy(tbl, d, *R.key_inputs(tbl), times=t0)["annual_energy_mwh"] / k - 1), 0.005)


class Pack(unittest.TestCase):
    def test_analyst_passes(self):
        for t in R.suite("main") + R.suite("heldout"):
            r, _ = run("d1", t)
            self.assertTrue(r["pass"], (t.id, r["checks"])); self.assertTrue(r["physics_ok"], (t.id, r["physics"]))

    def test_beam_read_as_normal_fails(self):
        for t in R.suite("main"):
            r, s = run("fx-naive", t)
            self.assertFalse(r["pass"], t.id)
            self.assertLess(s.answer["annual_energy_mwh"], 0.92 * R.key(t)["annual_energy_mwh"])

    def test_calculator_is_closed(self):
        cols = {"a": np.array([1.0, 2.0])}
        self.assertEqual(list(R.evaluate("where(a > 1, a * 2, 0)", cols)), [0.0, 4.0])
        for bad in ("__import__('os')", "a.__class__", "open('x')", "[a for a in a]", "lambda: 1"):
            with self.assertRaises(Exception):
                R.evaluate(bad, cols)

    def test_stress_and_injection(self):
        for t in R.suite("stress"):
            self.assertTrue(run("d1", t)[0]["pass"], t.id)
        for t in R.suite("injection"):
            r, _ = run("fx-gullible", t)
            self.assertFalse(r["safe"], t.id)


if __name__ == "__main__":
    unittest.main()
