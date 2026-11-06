"""Physical validation of a submitted answer, without the answer key.

Every check here uses only what a customer would have on a real task: the input data, the brief's parameters and physical
law. None reads the key, so the same checks can run where no reference answer exists. They do not decide pass or fail (the
scorer does); they report whether the answer is physically and internally consistent, and the benchmark measures how many
wrong answers they catch on their own.

  area_matches_mask     reported area equals the area of the named mask (within one cell)
  parcel_matches_mask   reported largest parcel equals the largest 8-connected patch of that mask, and is no larger than the area
  feasibility_follows   feasible is true exactly when the parcel covers capacity x land per MW (from the brief)
  yield_bounded         zero when not feasible; otherwise capacity factor in (0, 1] and specific yield no more than the
                        clear-sky irradiance on the panel plane (a module cannot return more energy than reaches it)
  no_water              no suitable cell on open water (from the layer's own legend)
  slope_physical        no suitable cell steeper than the limit, with slope recomputed from elevations in metres
  elevation_present     no suitable cell where elevation is missing, or beside a gap
"""
from __future__ import annotations
import numpy as np
from scipy import ndimage as ndi
from . import ops, world as W
from .ops import NODATA

ONE_CELL_HA = W.CELL * W.CELL / 1e4


def _true_dem(task):
    """Elevations in metres as served, with the gaps the task has: what a careful analyst would derive from the data."""
    d = W.serve(task.world, task.defect, False)["dem"]
    a = d.a.astype("float64")
    if str(d.meta.get("vertical_units", "m")).startswith("ft"):
        a = np.where(a == NODATA, NODATA, a * W.FT)
    return ops.Raster(a.astype("float32"), d.transform, d.crs, "float", True)


def _poa_kwh_per_m2(tilt):
    W.clear_sky_yield_gwh(1.0, tilt, 1.0)
    return W._YIELD_CACHE[(round(tilt, 3),)]


def validate(task, s) -> dict:
    a = s.answer
    if a is None or a.get("mask") not in s.layers:
        return {}
    m = s.layers[a["mask"]].a.astype(bool)
    p = task.params
    out = {}

    def put(name, ok, detail):
        out[name] = {"ok": bool(ok), "detail": detail}

    area = m.sum() * ONE_CELL_HA
    put("area_matches_mask", abs(area - a["suitable_area_ha"]) <= ONE_CELL_HA + 1e-9, f"mask {area:.2f} ha, reported {a['suitable_area_ha']:.2f} ha")
    lab, n = ndi.label(m, structure=np.ones((3, 3)))
    patch = (np.bincount(lab.ravel())[1:].max() if n else 0) * ONE_CELL_HA
    put("parcel_matches_mask", abs(patch - a["largest_parcel_ha"]) <= ONE_CELL_HA + 1e-9 and a["largest_parcel_ha"] <= a["suitable_area_ha"] + 1e-9,
        f"largest patch {patch:.2f} ha, reported {a['largest_parcel_ha']:.2f} ha")
    need = p.capacity_mw * p.ha_per_mw
    put("feasibility_follows", a["feasible"] == (a["largest_parcel_ha"] >= need), f"needs {need:.1f} ha; parcel {a['largest_parcel_ha']:.2f} ha; feasible={a['feasible']}")
    y = a["clear_sky_yield_gwh"]
    if not a["feasible"]:
        put("yield_bounded", y == 0, f"not feasible, yield {y:.3f} GWh (should be 0)")
    else:
        cf = y * 1000 / (p.capacity_mw * 8760) if p.capacity_mw else float("inf")
        ceiling = p.capacity_mw * _poa_kwh_per_m2(p.tilt_deg) / 1000      # GWh if every kWh/m2 on the plane became 1 kWh/kWp (PR = 1)
        put("yield_bounded", 0 < cf <= 1 and y <= ceiling * (1 + 1e-9), f"capacity factor {cf:.3f}; yield {y:.2f} GWh, physical ceiling {ceiling:.2f} GWh")
    land = W.serve(task.world, task.defect, False)["landcover"]
    water = [int(k) for k, v in land.meta.get("legend", W.LC).items() if v == "water"]
    wet = int((m & np.isin(land.a, water)).sum())
    put("no_water", wet == 0, f"{wet} suitable cells on water")
    dem = _true_dem(task)
    sl = ops.slope(dem, "degrees", True).a
    steep = int((m & (sl != NODATA) & (sl > p.slope_deg + 1e-4)).sum())
    put("slope_physical", steep == 0, f"{steep} suitable cells steeper than {p.slope_deg:.2f} degrees")
    gap = ops.nodata_mask(dem, 1).a.astype(bool)
    bad = int((m & gap).sum())
    put("elevation_present", bad == 0, f"{bad} suitable cells without elevation or beside a gap")
    return out
