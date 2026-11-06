"""Private held-out suites and the results ledger."""
import json
import os
import tempfile
import unittest
from unittest import mock
from earthbench import private, ledger, welltest, mining


class Private(unittest.TestCase):
    def test_private_suite_mirrors_main_on_secret_seeds(self):
        a = private.suite(welltest, "secret-one", "welltest")
        main = welltest.suite("main")
        self.assertEqual(sorted((t.kind, t.spec, t.defect) for t in a), sorted((t.kind, t.spec, t.defect) for t in main))
        self.assertTrue(all(t.seed >= 100_000 for t in a))                       # never a public seed
        self.assertFalse({private.task_digest(t) for t in a} & {private.task_digest(t) for t in main})   # no task shared with the public suite

    def test_deterministic_and_secret_dependent(self):
        d1 = private.suite_digest(private.suite(welltest, "secret-one", "welltest"))
        self.assertEqual(d1, private.suite_digest(private.suite(welltest, "secret-one", "welltest")))
        self.assertNotEqual(d1, private.suite_digest(private.suite(welltest, "secret-two", "welltest")))
        self.assertNotEqual(private.seeds("s", "mining"), private.seeds("s", "welltest"))
        parts = private.committed_sets(welltest, "welltest", private.suite(welltest, "secret-one", "welltest"))
        self.assertEqual(len(parts["welltest"]), 24)          # the grid committed on 6 November 2026, unchanged by the tasks added later
        self.assertTrue(all(t.spec != "L4" and t.defect not in ("two_rate", "short") for t in parts["welltest"]))

    def test_private_tasks_are_solvable(self):
        from earthbench.core import score
        for t in private.suite(welltest, "secret-one", "welltest")[:6]:
            s = welltest.SESSION(t); welltest.d1(t, s); k = welltest.key(t)
            self.assertTrue(score(t, s, k, welltest.checks(t, s, k), welltest.physics(t, s))["pass"], t.id)

    def test_commit_and_verify(self):
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(os.environ, {"SCORCHER_PRIVATE_SECRET": "test-secret"}), \
                mock.patch.object(private, "COMMITMENT", os.path.join(d, "c.json")), \
                mock.patch.object(private, "_packs", lambda: {"welltest": welltest, "mining": mining}):
            self.assertEqual(private.main(["commit"]), 0)
            c = json.load(open(os.path.join(d, "c.json")))
            self.assertNotIn("test-secret", json.dumps(c))                       # only its hash is published
            self.assertEqual(private.main(["verify"]), 0)
            with mock.patch.dict(os.environ, {"SCORCHER_PRIVATE_SECRET": "another"}):
                self.assertEqual(private.main(["verify"]), 1)


class Ledger(unittest.TestCase):
    def test_chain_detects_edits_and_changed_files(self):
        with tempfile.TemporaryDirectory() as d:
            L, f = os.path.join(d, "ledger.jsonl"), os.path.join(d, "r.json")
            json.dump({"x": 1}, open(f, "w"))
            for i in range(3):
                ledger.append({"pack": "p", "passed": i, "results_file": None}, L)
            self.assertEqual(ledger.verify(L), [])
            rows = open(L).read().splitlines()
            e = json.loads(rows[1]); e["passed"] = 99; rows[1] = json.dumps(e)
            open(L, "w").write("\n".join(rows) + "\n")
            self.assertTrue(any("contents changed" in p for p in ledger.verify(L)))


if __name__ == "__main__":
    unittest.main()
