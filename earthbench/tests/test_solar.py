import unittest
import numpy as np
from earthbench import solar as S
from earthbench.core import score


def run(arm, t):
    s = S.SESSION(t); S.ARMS[arm][1](t, s); k = S.key(t)
    return score(t, s, k, S.checks(t, s, k) if s.answer else {}, S.physics(t, s) if s.answer else {}), s


class Engine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w = S.weather(5)

    def e(self, **kw):
        a = dict(kwp=1000.0, tilt=30.0, azimuth=180.0, gamma=-0.0035, inverter_kw=800.0, losses=0.1); a.update(kw)
        return S.pv_energy(*self.w, a["kwp"], a["tilt"], a["azimuth"], a["gamma"], a["inverter_kw"], a["losses"])

    def test_energy_scales_with_plant_size(self):
        a, b = self.e(), self.e(kwp=2000.0, inverter_kw=1600.0)
        self.assertAlmostEqual(b["annual_energy_mwh"], 2 * a["annual_energy_mwh"], places=6)
        self.assertAlmostEqual(b["performance_ratio"], a["performance_ratio"], places=9)

    def test_losses_and_temperature_only_lower_energy(self):
        base = self.e()
        self.assertLess(self.e(losses=0.2)["annual_energy_mwh"], base["annual_energy_mwh"])
        self.assertGreater(self.e(gamma=-0.0020)["annual_energy_mwh"], base["annual_energy_mwh"])

    def test_energy_below_the_sunlight_on_the_plane(self):
        r = self.e(gamma=-1e-12, losses=0.0, inverter_kw=1500.0)
        ceiling = r["poa_insolation_kwh_m2"] * 1000 / 1000          # kWh/m2 x kWp at 1 kW/m2, in MWh
        self.assertLess(r["annual_energy_mwh"], ceiling)
        self.assertGreater(r["annual_energy_mwh"], 0.9 * ceiling)     # only the inverter's efficiency in between
        self.assertTrue(0 < r["performance_ratio"] < 1)

    def test_a_south_face_beats_a_north_face(self):
        self.assertGreater(self.e()["annual_energy_mwh"], self.e(azimuth=0.0)["annual_energy_mwh"])


class Pack(unittest.TestCase):
    def test_analyst_passes_without_false_alarms(self):
        for t in S.suite("main")[::2] + S.suite("heldout")[::3]:
            r, _ = run("d1", t)
            self.assertTrue(r["pass"], (t.id, r["checks"])); self.assertTrue(r["physics_ok"], t.id); self.assertTrue(r["integrity_ok"], t.id)

    def test_traps_bite(self):
        for df in ("local_time", "kwh", "missing"):
            self.assertFalse(run("fx-naive", S.make_task(1, "yield", "L1", df))[0]["pass"], df)
        self.assertFalse(run("fx-naive", S.make_task(1, "yield", "L2", "clean"))[0]["pass"])   # the PVsyst azimuth read as pvlib's

    def test_stress(self):
        for t in S.suite("stress"):
            self.assertTrue(run("d1", t)[0]["pass"], t.id)
            if t.faults in ("transient", "corrupt", "combined"):
                self.assertFalse(run("fx-brittle", t)[0]["pass"], t.id)


if __name__ == "__main__":
    unittest.main()
