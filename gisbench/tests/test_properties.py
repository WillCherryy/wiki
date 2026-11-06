"""Property-based tests: generated edge cases, not hand-picked examples.

Properties that must hold for any input Hypothesis can construct:
  1. No tool ever crashes. Whatever the arguments (wrong types, missing, huge, nested, path tricks), a call returns ok or a
     refusal, never a Python exception, and leaves the input layers and documents unchanged.
  2. Tools survive corrupt data: a DEM with NaN, infinity, spikes, a constant surface or no valid cells; vectors in an
     unknown or empty CRS; invalid, empty or degenerate geometry. They return a result or a refusal, never a crash, and what
     they write stays on the input grid.
  3. The answer key responds to its parameters monotonically, for random parameters on random worlds.
  4. The physical checks never flag the analyst pipeline, on random tasks from every suite.
"""
import unittest
import numpy as np
from hypothesis import given, settings, strategies as st, HealthCheck
from shapely.geometry import Polygon, Point
from gisbench import tasks as T, world as W, ops
from gisbench.agents import ARMS
from gisbench.integrity import check as integrity
from gisbench.ops import Raster, Vector, NODATA
from gisbench.score import score
from gisbench.session import Session, TOOL_SPECS

FAST = settings(max_examples=60, deadline=None, suppress_health_check=[HealthCheck.too_slow])
SLOW = settings(max_examples=12, deadline=None, suppress_health_check=[HealthCheck.too_slow])

layer_names = st.sampled_from(["dem", "landcover", "protected_areas", "grid_line", "nope", "../etc/passwd", "", "a" * 300])
values = st.recursive(st.none() | st.booleans() | st.integers(-10**9, 10**9) | st.floats(allow_nan=True, allow_infinity=True) | st.text(max_size=20) | layer_names,
                      lambda c: st.lists(c, max_size=3) | st.dictionaries(st.text(max_size=8), c, max_size=3), max_leaves=6)
arg_names = st.sampled_from(["layer", "raster", "dem", "out", "template", "a", "b", "op", "value", "factor", "classes", "distance_m", "epsg",
                             "where_field", "where_equals", "unit", "grow_cells", "connectivity", "name", "from", "to", "all_touched", "x"])


def _session(seed=1, spec="S1", defect="clean"):
    return Session(T.make_task(seed, spec, defect))


class ToolsNeverCrash(unittest.TestCase):
    @FAST
    @given(tool=st.sampled_from(sorted(TOOL_SPECS) + ["shell", "files_write"]), args=st.dictionaries(arg_names, values, max_size=5))
    def test_random_calls(self, tool, args):
        s = _session()
        ok, res = s.call(tool, args)                     # must not raise
        self.assertIsInstance(ok, bool)
        self.assertEqual(s.internal_errors, [], (tool, args))
        if tool != "submit_answer":
            i = integrity(s)
            self.assertTrue(i["inputs_unchanged"]["ok"] and i["documents_unchanged"]["ok"], (tool, args))

    @FAST
    @given(corruption=st.sampled_from(["nan", "inf", "spike", "flat", "all_nodata", "negative"]), frac=st.floats(0.0, 1.0),
           tool=st.sampled_from(["raster_slope", "raster_set_nodata", "raster_nodata_mask", "raster_scale", "raster_threshold", "layer_info"]))
    def test_corrupt_rasters(self, corruption, frac, tool):
        s = _session()
        a = s.layers["dem"].a.copy()
        n = int(frac * a.size)
        idx = np.unravel_index(np.arange(n), a.shape)
        a[idx] = {"nan": np.nan, "inf": np.inf, "spike": 1e30, "flat": 600.0, "all_nodata": NODATA, "negative": -500.0}[corruption]
        if corruption == "all_nodata":
            a[:] = NODATA
        s.layers["dem"] = Raster(a.astype("float32"), s.layers["dem"].transform, s.layers["dem"].crs, "float", True)
        from gisbench.integrity import snapshot
        s._snapshot = snapshot(s)
        args = {"raster_slope": {"dem": "dem", "out": "x"}, "raster_set_nodata": {"raster": "dem", "value": -9999, "out": "x"},
                "raster_nodata_mask": {"raster": "dem", "out": "x", "grow_cells": 1}, "raster_scale": {"raster": "dem", "factor": 0.3048, "out": "x"},
                "raster_threshold": {"raster": "dem", "out": "x", "op": "le", "value": 600}, "layer_info": {"layer": "dem"}}[tool]
        s.call(tool, args)                                # must not raise
        self.assertEqual(s.internal_errors, [], (tool, args))
        i = integrity(s)
        self.assertTrue(i["inputs_unchanged"]["ok"] and i["rasters_on_input_grid"]["ok"] and i["masks_binary"]["ok"])

    @FAST
    @given(crs=st.sampled_from(["EPSG:32630", "EPSG:4326", "EPSG:99999", "", "not-a-crs", "EPSG:3857"]),
           geom=st.sampled_from(["bowtie", "empty", "sliver", "point", "huge", "normal"]),
           tool=st.sampled_from(["vector_buffer", "rasterize_vector", "distance_to_vector", "reproject_vector", "fix_geometry", "layer_info"]))
    def test_bad_crs_and_geometry(self, crs, geom, tool):
        s = _session()
        x0, y0 = W.X0 + 1000, W.Y0 - 1000
        g = {"bowtie": Polygon([(x0, y0), (x0 + 300, y0 - 300), (x0 + 300, y0), (x0, y0 - 300)]), "empty": Polygon(),
             "sliver": Polygon([(x0, y0), (x0 + 500, y0), (x0 + 500, y0 + 1e-9)]), "point": Point(x0, y0),
             "huge": Polygon([(0, 0), (1e9, 0), (1e9, 1e9)]), "normal": Polygon([(x0, y0), (x0 + 300, y0), (x0 + 300, y0 - 300), (x0, y0 - 300)])}[geom]
        s.layers["protected_areas"] = Vector([(g, {"designation": "A"})], crs)
        from gisbench.integrity import snapshot
        s._snapshot = snapshot(s)
        args = {"vector_buffer": {"layer": "protected_areas", "distance_m": 100, "out": "x"}, "rasterize_vector": {"layer": "protected_areas", "template": "dem", "out": "x"},
                "distance_to_vector": {"layer": "protected_areas", "template": "dem", "out": "x"}, "reproject_vector": {"layer": "protected_areas", "epsg": 32630, "out": "x"},
                "fix_geometry": {"layer": "protected_areas", "out": "x"}, "layer_info": {"layer": "protected_areas"}}[tool]
        s.call(tool, args)                                # must not raise
        self.assertEqual(s.internal_errors, [], (tool, args))
        i = integrity(s)
        self.assertTrue(i["inputs_unchanged"]["ok"] and i["rasters_on_input_grid"]["ok"])


class KeyIsMonotonic(unittest.TestCase):
    @SLOW
    @given(seed=st.integers(0, 400), slope=st.floats(1, 12), d_slope=st.floats(0.1, 5), buf=st.floats(0, 800), d_buf=st.floats(1, 500), grid=st.floats(500, 9000))
    def test_area_monotonic(self, seed, slope, d_slope, buf, d_buf, grid):
        t = T.make_task(seed, "S1", "clean")
        p = W.Params(slope, buf, buf, grid, 50, 2.0)
        area = lambda q: W.solve(t.world, q, "clean")["suitable_area_ha"]
        import dataclasses as dc
        base = area(p)
        self.assertGreaterEqual(area(dc.replace(p, slope_deg=slope + d_slope)), base)
        self.assertLessEqual(area(dc.replace(p, buffer_a_m=buf + d_buf, buffer_b_m=buf + d_buf)), base)
        self.assertLessEqual(area(dc.replace(p, grid_m=grid / 2)), base)


class PhysicsNoFalseAlarms(unittest.TestCase):
    @SLOW
    @given(seed=st.integers(0, 2000), spec=st.sampled_from(["S1", "S2", "S3", "S4"]), defect=st.sampled_from(W.DEFECTS + W.HARD_DEFECTS))
    def test_analyst_pipeline_is_physically_consistent(self, seed, spec, defect):
        t = T.make_task(seed, spec, defect)
        s = Session(t); ARMS["d1"][1](t, s); r = score(t, s)
        self.assertTrue(r["pass"], (t.id, r["checks"]))
        self.assertTrue(r["physics_ok"], (t.id, {k: v for k, v in r["physics"].items() if not v["ok"]}))
        self.assertTrue(r["integrity_ok"], t.id)


if __name__ == "__main__":
    unittest.main()
