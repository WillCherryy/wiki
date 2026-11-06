"""Every function check in the validation register must pass (the unit-test checks it names run in their own files)."""
import unittest
from earthbench import validation as V


class Register(unittest.TestCase):
    def test_every_function_check_passes(self):
        for e in V.R:
            if callable(e["check"]):
                ok, detail = V.run_check(e["check"])
                if ok is None:
                    continue                                  # engine library not installed here
                self.assertTrue(ok, f"{e['id']}: {detail}")

    def test_every_named_unit_test_exists(self):
        for e in V.R:
            if isinstance(e["check"], str):
                self.assertGreater(unittest.defaultTestLoader.loadTestsFromName(e["check"]).countTestCases(), 0, e["id"])

    def test_sources_are_listed_and_design_choices_say_so(self):
        for e in V.R:
            self.assertTrue(all(r in V.REFS for r in e["refs"]), e["id"])
            if e["basis"] != "design choice":
                self.assertTrue(e["refs"], f"{e['id']} claims a basis but cites nothing")


if __name__ == "__main__":
    unittest.main()
