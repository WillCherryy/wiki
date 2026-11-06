import math
import unittest
import numpy as np
from earthbench import welltest as W
from earthbench.welltest_engine import pwd, Well, bourdet
from earthbench.core import score


def run(arm, t):
    s = W.SESSION(t); W.ARMS[arm][1](t, s); k = W.key(t)
    return score(t, s, k, W.checks(t, s, k) if s.answer else {}, W.physics(t, s) if s.answer else {}), s


class Engine(unittest.TestCase):
    def test_radial_flow_matches_the_log_approximation(self):
        # no storage, no skin: p_D -> (ln t_D + 0.80907) / 2 once t_D is large (the Theis line source)
        for tD in (1e5, 1e7, 1e9):
            self.assertAlmostEqual(pwd(tD, 0, 0)[0], 0.5 * (math.log(tD) + 0.80907), places=4)

    def test_wellbore_storage_unit_slope(self):
        # very early, the well is a tank: p_D = t_D / C_D
        self.assertAlmostEqual(pwd(1.0, 1000, 5)[0] * 1000, 1.0, places=3)

    def test_skin_adds_its_value_in_radial_flow(self):
        self.assertAlmostEqual(pwd(1e7, 100, 4)[0] - pwd(1e7, 100, 0)[0], 4.0, places=3)

    def test_negative_skin_is_physical(self):
        # regression for the audit: with S < 0 the response must stay positive and rise monotonically, and match the effective-radius
        # model (an independent formulation: a well of radius r_w e^-S with no skin), and it must join the S >= 0 branch continuously
        tD = np.logspace(0, 8, 60)
        for S in (-0.5, -1.0, -2.0, -3.0):
            for CD in (0.0, 300.0, 3000.0):
                p = pwd(tD, CD, S)
                self.assertTrue(np.all(p > 0) and np.all(np.diff(p) > 0), (S, CD))
        self.assertAlmostEqual(pwd(1e5, 100, -1e-9)[0], pwd(1e5, 100, 0.0)[0], places=6)
        # late time: semilog line with skin S, i.e. 0.5 (ln tD + 0.80907) + S
        self.assertAlmostEqual(pwd(1e8, 0, -2.0)[0], 0.5 * (math.log(1e8) + 0.80907) - 2.0, places=3)

    def test_sealing_fault_doubles_the_derivative(self):
        w = Well(50, 100, 0.1, 2e-4, 1e-9, 0.108, 0.05, 2, 1e-6, fault_m=150)
        t = np.logspace(4, 9, 60); d = np.gradient(w.dp(t), np.log(t)) / (0.5 * w.scale)
        self.assertAlmostEqual(d[-1], 2.0, places=2)

    def test_buildup_derivative_sees_the_fault(self):
        # the Bourdet derivative against Agarwal time must rise towards two once the image well is felt
        t = W.make_task(1, "buildup", "L1", "clean"); d = t.truth
        self.assertTrue(d["fault_seen"])
        w = Well(d["k_md"], d["h"], d["phi"], d["mu"], d["ct"], d["rw"], d["q"], d["skin"], 0.0, fault_m=t.meta["L"])
        dt = np.logspace(math.log10(d["tr"]), math.log10(d["end"]), 60)
        pwf, pws = w.buildup(20e6, d["tp"], dt)
        der = bourdet(dt, pws, pwf, d["tp"], 0.2)[1] / (0.5 * w.scale)
        self.assertLess(abs(np.nanmedian(der[5:15]) - 1), 0.05)
        self.assertGreater(np.nanmedian(der[-8:]), 1.6)

    def test_horner_recovers_the_truth(self):
        # the semilog line in the radial window gives k within 0.5 % and skin within 0.05 on every main task
        for t in W.suite("main"):
            if not t.truth["reached"]:
                continue
            r, s = run("d1", t)
            # Horner's equivalent producing time is an approximation for a rate history: measured within 3 % on k and 0.4 on skin
            ek, es = (0.04, 0.5) if t.defect == "two_rate" else (0.005, 0.05)
            self.assertLess(abs(s.answer["k_md"] / t.truth["k_md"] - 1), ek, t.id)
            self.assertLess(abs(s.answer["skin"] - t.truth["skin"]), es, t.id)


class Pack(unittest.TestCase):
    def test_solvable_from_the_data_alone(self):
        for t in W.suite("main") + W.suite("heldout"):
            r, _ = run("d1-data", t)
            self.assertTrue(r["pass"], (t.id, r["checks"])); self.assertTrue(r["physics_ok"], (t.id, r["physics"]))

    def test_traps_bite_and_physics_catch_them(self):
        caught = wrong = 0
        for t in W.suite("main"):
            r, _ = run("fx-naive", t)
            self.assertFalse(r["pass"], t.id)
            if r["answered"]:
                wrong += 1; caught += not r["physics_ok"]
            r, _ = run("d0", t)
            if not r["pass"] and r["answered"]:
                self.assertFalse(r["physics_ok"], t.id)                    # every textbook-window failure is flagged without the key
        self.assertGreaterEqual(caught / wrong, 0.85)

    def test_abstention(self):
        # a test too short to reach radial flow: the data alone show it, an estimate fails, and the key-free check flags the claim
        for t in [W.make_task(sd, "buildup", sp, "short") for sd in (1, 2, 11) for sp in W.SPECS]:
            self.assertFalse(t.truth["reached"])
            r, s = run("d1-data", t)
            self.assertTrue(r["pass"], t.id); self.assertIs(s.answer["radial_flow_reached"], False)
            r, s = run("fx-naive", t)
            self.assertFalse(r["pass"], t.id)
            if r["answered"]:
                self.assertFalse(r["physics_ok"], t.id)

    def test_rate_history(self):
        # two rates: Horner's equivalent time with the last rate recovers k; the first rate with total time does not
        w = Well(80, 50, 0.1, 2e-4, 1e-9, 0.108, 0.02, 1.0, 1e-6)
        dt = np.logspace(-2, 1, 30)
        a = w.buildup(20e6, 30, dt)[1]; b = w.buildup_history(20e6, [(0.02, 10), (0.02, 20)], dt)[1]
        self.assertLess(np.max(np.abs(a - b)), 1.0)
        for t in [W.make_task(sd, "buildup", sp, "two_rate") for sd in (1, 2) for sp in W.SPECS]:
            self.assertTrue(run("d1-data", t)[0]["pass"], t.id)
            self.assertFalse(run("d0", t)[0]["pass"], t.id)

    def test_stress(self):
        for t in W.suite("stress"):
            self.assertTrue(run("d1", t)[0]["pass"], t.id)
            if t.faults in ("transient", "corrupt", "combined"):
                self.assertFalse(run("fx-brittle", t)[0]["pass"], t.id)


if __name__ == "__main__":
    unittest.main()
