import itertools
import unittest
from earthbench import scheduling as S
from earthbench.core import score


def run(arm, t):
    s = S.SESSION(t); S.ARMS[arm][1](t, s); k = S.key(t)
    return score(t, s, k, S.checks(t, s, k) if s.answer else {}, S.physics(t, s) if s.answer else {}), s


def brute(wells, move, maint):
    """Every assignment of wells to allowed rigs and every order on each rig, each well started as early as it can be."""
    best = None
    rigs = list(S.RIGS)
    allowed = [[r for r in rigs if not w["heavy"] or S.RIGS[r] == "heavy"] for w in wells]
    for assign in itertools.product(*allowed):
        groups = {r: [w for w, a in zip(wells, assign) if a == r] for r in rigs}
        span = 0
        for r, ws in groups.items():
            bestr = None
            for order in itertools.permutations(ws):
                free, end = 0, 0
                for w in order:
                    s = max(free, w["permit_day"])
                    if r == "R2" and s < maint[1] and s + w["duration_days"] + move > maint[0]:
                        s = max(s, maint[1])
                    end = s + w["duration_days"]; free = end + move
                bestr = end if bestr is None else min(bestr, end)
            span = max(span, bestr or 0)
        best = span if best is None else min(best, span)
    return best


class Engine(unittest.TestCase):
    def test_cp_sat_equals_brute_force(self):
        import numpy as np
        for seed in range(6):
            rng = np.random.default_rng(seed)
            wells = [{"well": f"W{i}", "duration_days": int(rng.integers(3, 12)), "permit_day": int(rng.choice([0, 0, 5, 9])), "heavy": i == 0} for i in range(5)]
            move, maint = int(rng.integers(1, 4)), (int(rng.integers(2, 8)), int(rng.integers(10, 16)))
            r = S.solve(wells, move, maint)
            self.assertEqual(r["status"], "OPTIMAL")
            self.assertEqual(r["makespan_days"], brute(wells, move, maint), seed)
            self.assertEqual(S.check_schedule(r["assign"], wells, move, maint), [])

    def test_feasibility_check_catches_breaches(self):
        w = [{"well": "A", "duration_days": 5, "permit_day": 10, "heavy": True}]
        bad = S.check_schedule({"A": {"rig": "R1", "start_day": 0}}, w, 2, (0, 1))
        self.assertTrue(any("before its permit" in b for b in bad) and any("is heavy" in b for b in bad))


class Pack(unittest.TestCase):
    def test_analyst_passes_and_traps_bite(self):
        for t in S.suite("main"):
            r, _ = run("d1", t)
            self.assertTrue(r["pass"], (t.id, r["checks"])); self.assertTrue(r["physics_ok"], t.id)
        self.assertFalse(run("fx-naive", S.make_task(1, "campaign", "L1", "hours"))[0]["pass"])      # hours read as days
        self.assertFalse(run("fx-naive", S.make_task(1, "campaign", "L1", "cancelled"))[0]["pass"])  # the cancelled well drilled
        self.assertFalse(run("d0", S.make_task(1, "campaign", "L1", "clean"))[0]["pass"])

    def test_stress(self):
        for t in S.suite("stress"):
            self.assertTrue(run("d1", t)[0]["pass"], t.id)
            if t.faults in ("transient", "corrupt", "combined"):
                self.assertFalse(run("fx-brittle", t)[0]["pass"], t.id)


if __name__ == "__main__":
    unittest.main()
