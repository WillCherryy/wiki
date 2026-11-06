import itertools
import unittest
import numpy as np
from earthbench import mining as M
from earthbench.core import score, convert


def run(arm, t):
    s = M.SESSION(t); M.ARMS[arm][1](t, s); k = M.key(t)
    return score(t, s, k, M.checks(t, s, k) if s.answer else {}, M.physics(t, s) if s.answer else {}), s


class PitSolver(unittest.TestCase):
    def test_exact_against_brute_force(self):
        # every closed set of a 3 x 3 x 2 model, enumerated: the min-cut pit must be the best
        old = (M.NX, M.NY, M.NZ)
        try:
            M.NX, M.NY, M.NZ = 3, 3, 2
            rng = np.random.default_rng(4)
            for trial in range(6):
                a = np.zeros(18, [("i", "i4"), ("j", "i4"), ("k", "i4"), ("rock", "i4"), ("density", "f8"), ("cu", "f8")])
                g = np.array(list(itertools.product(range(3), range(3), range(2))))
                a["i"], a["j"], a["k"] = g[:, 0], g[:, 1], g[:, 2]
                v = rng.normal(-1000, 3000, 18).round()
                v[a["k"] == 1] += rng.choice([0, 6000], 9)
                slope = [38.66, 45.0, 50.19][trial % 3]
                pit = M.ultimate_pit(a, v, slope)
                idx = {tuple(x): n for n, x in enumerate(g)}
                pairs = [(n, idx[(i + di, j + dj, k + dk)]) for n, (i, j, k) in enumerate(g) for di, dj, dk in M.precedence_offsets(slope)
                         if (i + di, j + dj, k + dk) in idx]
                masks = ((np.arange(2 ** 18)[:, None] >> np.arange(18)) & 1).astype(bool)
                closed = np.ones(len(masks), bool)
                for c, p in pairs:
                    closed &= ~masks[:, c] | masks[:, p]
                best = (masks[closed] * v).sum(1).max()
                self.assertAlmostEqual(v[pit].sum(), best, places=6)
                self.assertEqual(M.closure_violations(a, pit, slope), 0)
        finally:
            M.NX, M.NY, M.NZ = old

    def test_matches_networkx_min_cut_on_a_full_model(self):
        try:
            import networkx as nx
        except ImportError:
            self.skipTest("networkx not installed")
        t = M.make_task(3, "pit", "L1", "clean"); a = t.meta["model"]; d = t.truth
        v, _ = M.block_values(a, d["price_usd_t"], d["recovery"], d["mining_usd_t"], d["processing_usd_t"])
        vi = np.rint(v).astype(int)
        G = nx.DiGraph()
        for n, x in enumerate(vi):
            if x > 0: G.add_edge("s", n, capacity=int(x))
            elif x < 0: G.add_edge(n, "t", capacity=int(-x))
        idx = {(i, j, k): n for n, (i, j, k) in enumerate(zip(a["i"], a["j"], a["k"]))}
        for n, (i, j, k) in enumerate(zip(a["i"], a["j"], a["k"])):
            for di, dj, dk in M.precedence_offsets(d["slope_deg"]):
                p = idx.get((i + di, j + dj, k + dk))
                if p is not None: G.add_edge(n, p)          # no capacity attribute = infinite
        cut, (S, _) = nx.minimum_cut(G, "s", "t")
        nxpit = np.zeros(a.shape[0], bool); nxpit[[n for n in S if n != "s"]] = True
        pit = M.ultimate_pit(a, v, d["slope_deg"])
        self.assertEqual(int(vi[pit].sum()), int(vi[nxpit].sum()))
        self.assertEqual(int(vi[pit].sum()), int(vi.clip(min=0).sum()) - int(cut))   # max closure = sum of positives - min cut


class Pack(unittest.TestCase):
    def test_analyst_passes_and_is_physically_clean(self):
        for t in M.suite("main")[::3] + M.suite("heldout")[::5]:
            r, _ = run("d1", t)
            self.assertTrue(r["pass"], (t.id, r["checks"])); self.assertTrue(r["physics_ok"], (t.id, r["physics"])); self.assertTrue(r["integrity_ok"], t.id)

    def test_defects_and_units_bite(self):
        for df in ("missing_density", "ppm", "dupes"):
            t = M.make_task(1, "gt", "L1", df)
            self.assertFalse(run("fx-naive", t)[0]["pass"], t.id)
        self.assertFalse(run("fx-naive", M.make_task(1, "pit", "L2", "clean"))[0]["pass"])

    def test_too_steep_a_pit_is_unsafe(self):
        t = next(t for t in (M.make_task(s, "pit", "L1", "clean") for s in range(40)) if t.truth["slope_deg"] < 40)
        r, _ = run("d0", t)                                  # the default 45 degree wall is steeper than the geotechnical slope
        self.assertGreater(r.get("hard", 0), 0); self.assertFalse(r["safe"])

    def test_stress_and_injection(self):
        for t in M.suite("stress"):
            self.assertTrue(run("d1", t)[0]["pass"], t.id)
            if t.faults in ("transient", "corrupt", "combined"):
                self.assertFalse(run("fx-brittle", t)[0]["pass"], t.id)
        t = M.suite("injection")[0]
        r, _ = run("fx-gullible", t)
        self.assertFalse(r["safe"]); self.assertEqual(r["violations"][0]["kind"], "restricted_read")

    def test_units(self):
        self.assertAlmostEqual(convert(1, "USD/lb", "USD/t"), 2204.62262185, places=6)
        self.assertAlmostEqual(convert(10, "USD/short_ton", "USD/t"), 10 / 0.90718474)
        self.assertAlmostEqual(convert(212, "F", "C"), 100)
        self.assertAlmostEqual(convert(5000, "ppm", "percent"), 0.5)


if __name__ == "__main__":
    unittest.main()
