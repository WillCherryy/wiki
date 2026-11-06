import unittest
import numpy as np
from earthbench import seismic as S
from earthbench.core import score


def run(arm, t):
    s = S.SESSION(t); S.ARMS[arm][1](t, s); k = S.key(t)
    return score(t, s, k, S.checks(t, s, k) if s.answer else {}, S.physics(t, s) if s.answer else {}), s


class Engine(unittest.TestCase):
    def test_pick_lands_on_the_true_reflector(self):
        # a zero-phase Ricker wavelet peaks on its reflector: the pick must recover the sample the volume was built with
        for seed in (1, 2, 11):
            t = S.make_task(seed, "pick", "L1", "clean")
            p = S.pick_engine(t.data["survey.sgy"], *t.truth["window_ms"], "peak")
            true = t.meta["h2"].ravel() * S.DT_MS
            self.assertLessEqual(np.max(np.abs(p["twt"] - true)), S.DT_MS + 1e-9, seed)

    def test_headers_read_back_as_written(self):
        import segyio
        t = S.make_task(1, "qc", "L1", "scalar")
        with segyio.open(t.data["survey.sgy"], ignore_geometry=True) as f:
            self.assertEqual(f.bin[segyio.BinField.Interval], 2000); self.assertEqual(f.tracecount, S.NIL * S.NXL)
            self.assertEqual(set(f.attributes(segyio.TraceField.SourceGroupScalar)[:]), {-100})
            x = np.asarray(f.attributes(segyio.TraceField.CDP_X)[:], float) / 100
        self.assertAlmostEqual(x.mean(), S.key(t)["mean_cdp_x_m"], places=6)

    def test_reverse_polarity_needs_a_trough(self):
        t = S.make_task(1, "pick", "L1", "polarity")
        good = S.pick_engine(t.data["survey.sgy"], *t.truth["window_ms"], "trough")["twt"]
        self.assertLessEqual(np.max(np.abs(good - t.meta["h2"].ravel() * S.DT_MS)), S.DT_MS + 1e-9)


class Pack(unittest.TestCase):
    def test_analyst_passes_and_traps_bite(self):
        for t in S.suite("main"):
            r, _ = run("d1", t)
            self.assertTrue(r["pass"], (t.id, r["checks"])); self.assertTrue(r["physics_ok"], t.id)
        self.assertFalse(run("fx-naive", S.make_task(1, "qc", "L1", "scalar"))[0]["pass"])        # raw coordinates without the scalar
        self.assertFalse(run("fx-naive", S.make_task(1, "qc", "L1", "clean"))[0]["pass"])         # microseconds read as milliseconds
        self.assertFalse(run("fx-naive", S.make_task(1, "pick", "L1", "polarity"))[0]["pass"])    # peaks on a reverse-polarity volume
        self.assertFalse(run("d0", S.make_task(1, "pick", "L1", "polarity"))[0]["pass"])

    def test_stress(self):
        for t in S.suite("stress"):
            self.assertTrue(run("d1", t)[0]["pass"], t.id)
            if t.faults in ("transient", "corrupt", "combined"):
                self.assertFalse(run("fx-brittle", t)[0]["pass"], t.id)


if __name__ == "__main__":
    unittest.main()
