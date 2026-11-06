import unittest
from earthbench import documents as D
from earthbench.core import score, convert


def run(arm, t):
    s = D.SESSION(t); D.ARMS[arm][1](t, s); k = D.key(t)
    return score(t, s, k, D.checks(t, s, k) if s.answer else {}, D.physics(t, s) if s.answer else {}), s


class Reading(unittest.TestCase):
    def test_quantities_parse_units_as_written(self):
        q = D.quantities("Total depth (drilled): 7,913 ft MD.\nBottom-hole temperature: 325.1 °F.\nRate: 716 US gpm and 45.2 L/s, 12.50 MPa")
        self.assertEqual([(v, u) for v, u, _ in q], [(7913.0, "ft"), (325.1, "°F"), (716.0, "US gpm"), (45.2, "L/s"), (12.5, "MPa")])

    def test_flow_units_exact(self):
        self.assertAlmostEqual(convert(1, "gpm", "L/s"), 0.0630901964, places=10)
        self.assertAlmostEqual(convert(3.6, "m3/h", "L/s"), 1.0, places=12)

    def test_units_identity_and_viscosity(self):
        self.assertEqual(convert(2.5, "m3/s", "m3/s"), 2.5)
        self.assertAlmostEqual(convert(0.2, "cP", "Pa*s"), 2e-4, places=15)
        self.assertAlmostEqual(convert(1, "bbl", "L"), 158.987294928, places=9)

    def test_every_out_argument_is_described(self):
        from earthbench.run import PACKS, pack
        for name in PACKS:
            try:
                P = pack(name)
            except ImportError:
                continue
            s = P.SESSION(P.suite("main")[0])
            for tool, spec in s.specs.items():
                o = spec["input_schema"]["properties"].get("out")
                if o is not None:
                    self.assertTrue(o.get("description"), (name, tool))

    def test_key_is_what_the_document_states(self):
        for df in D.DEFECTS:
            for kind in D.KINDS:
                t = D.make_task(1, kind, "L1", df)
                src = t.docs[t.truth["sources"][-1]]
                found = [D._si(v, u, kind)[0] for v, u, _ in D.quantities(src)]
                k = D.key(t)
                f = "flow_l_s" if kind == "well" else "max_rate_l_s"
                self.assertTrue(any(abs(k[f] - x) < 1e-9 * max(1, abs(x)) for x in found), (t.id, k[f], found))


class Pack(unittest.TestCase):
    def test_analyst_passes_and_traps_bite(self):
        for t in D.suite("main"):
            r, _ = run("d1", t)
            self.assertTrue(r["pass"], (t.id, r["checks"])); self.assertTrue(r["physics_ok"], t.id)
        for kind in D.KINDS:
            self.assertFalse(run("d0", D.make_task(1, kind, "L1", "units"))[0]["pass"])             # feet, °F, gpm or psi taken as SI
            self.assertFalse(run("fx-naive", D.make_task(1, kind, "L1", "planned"))[0]["pass"])     # the plan or the application, not the actual
        r, _ = run("d0", D.make_task(1, "permit", "L1", "revision"))                               # amendment not read: rate above the permit
        self.assertFalse(r["pass"]); self.assertFalse(r["safe"])

    def test_stress(self):
        for t in D.suite("stress"):
            self.assertTrue(run("d1", t)[0]["pass"], t.id)
            if t.faults in ("transient", "corrupt", "combined"):
                self.assertFalse(run("fx-brittle", t)[0]["pass"], t.id)


if __name__ == "__main__":
    unittest.main()
