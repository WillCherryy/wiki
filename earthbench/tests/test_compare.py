import unittest
import numpy as np
from earthbench import compare as C


class ClusterBootstrap(unittest.TestCase):
    def test_design_effect_matches_theory(self):
        # 40 worlds of 5 tasks. Independent tasks: the clustered SE equals the iid SE. Tasks that always agree within a world: the
        # variance is 5 times larger (design effect 1 + (m - 1) rho with rho = 1).
        rng = np.random.default_rng(1)
        ind = [rng.integers(0, 2, 5).astype(float) for _ in range(40)]
        same = [np.full(5, float(rng.integers(0, 2))) for _ in range(40)]
        for cl, deff in ((ind, 1.0), (same, 5.0)):
            x = np.concatenate(cl); p = x.mean(); iid = (p * (1 - p) / x.size) ** 0.5
            _, _, se = C.cluster_bootstrap(cl, C._mean_of, b=4000)
            self.assertAlmostEqual((se / iid) ** 2, deff, delta=0.25 * deff)

    def test_seed_parsing(self):
        self.assertEqual(C.seed_of("WT-buildup-L2-two_rate-011"), 11)
        self.assertEqual(C.seed_of("MIN-gt-L1-clean-001-inj"), 1)


if __name__ == "__main__":
    unittest.main()
