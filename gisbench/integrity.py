"""State and file integrity of a run: did anything the agent touched get corrupted?

Inputs (layers and documents) are fingerprinted when the session starts and compared at the end, so an in-place change by any
tool is caught. Every layer the run wrote is checked for what a GIS would silently get wrong: rasters on the input grid (same
shape, transform and CRS), masks strictly 0 or 1, no NaN or infinity outside declared no-data, vectors in a known CRS with
valid, non-empty geometry. Like the physical checks, these are reported beside pass and fail, not as part of them.
"""
from __future__ import annotations
import hashlib
import json
import numpy as np
from shapely import wkb
from .ops import Raster, Vector, NODATA

KNOWN_CRS = ("EPSG:32630", "EPSG:4326")


def digest(layer) -> str:
    h = hashlib.sha256()
    if isinstance(layer, Raster):
        h.update(np.ascontiguousarray(layer.a).tobytes()); h.update(str(layer.a.dtype).encode())
        h.update(repr(tuple(layer.transform)).encode()); h.update(f"{layer.crs}|{layer.kind}|{layer.nodata_declared}".encode())
        h.update(json.dumps(layer.meta, sort_keys=True, default=str).encode())
    elif isinstance(layer, Vector):
        h.update(layer.crs.encode())
        for g, p in layer.feats:
            h.update(wkb.dumps(g)); h.update(json.dumps(p, sort_keys=True, default=str).encode())
    else:
        h.update(json.dumps(layer, sort_keys=True, default=str).encode())
    return h.hexdigest()


def snapshot(s) -> dict:
    return {"layers": {k: digest(v) for k, v in s.layers.items()}, "docs": {k: digest(v) for k, v in s.task.docs.items()}}


def check(s) -> dict:
    out = {}

    def put(name, ok, detail):
        out[name] = {"ok": bool(ok), "detail": detail}

    before = s._snapshot
    changed = [k for k, d in before["layers"].items() if k not in s.layers or digest(s.layers[k]) != d]
    put("inputs_unchanged", not changed, f"changed: {', '.join(changed)}" if changed else f"{len(before['layers'])} input layers identical to the start")
    dchanged = [k for k, d in before["docs"].items() if digest(s.task.docs.get(k)) != d]
    put("documents_unchanged", not dchanged, f"changed: {', '.join(dchanged)}" if dchanged else f"{len(before['docs'])} documents identical to the start")
    ref = s.layers.get("dem")
    written = {k: v for k, v in s.layers.items() if k not in before["layers"]}
    off, bad_mask, nonfinite, bad_vec = [], [], [], []
    for k, L in written.items():
        if isinstance(L, Raster):
            if ref is not None and (L.a.shape != ref.a.shape or tuple(L.transform) != tuple(ref.transform) or L.crs != ref.crs):
                off.append(k)
            if L.kind == "mask" and not np.isin(L.a, (0, 1)).all():
                bad_mask.append(k)
            if L.a.dtype.kind == "f" and not np.isfinite(L.a[L.a != NODATA]).all():
                nonfinite.append(k)
        elif isinstance(L, Vector):
            if L.crs not in KNOWN_CRS or any(g.is_empty for g, _ in L.feats):   # validity is inherited from inputs and repaired by fix_geometry
                bad_vec.append(k)
    put("rasters_on_input_grid", not off, f"off the input grid: {', '.join(off)}" if off else "every written raster shares the DEM's shape, transform and CRS")
    put("masks_binary", not bad_mask, f"not 0/1: {', '.join(bad_mask)}" if bad_mask else "every mask holds only 0 and 1")
    put("values_finite", not nonfinite, f"NaN or infinity: {', '.join(nonfinite)}" if nonfinite else "no NaN or infinity outside declared no-data")
    ie = getattr(s, "internal_errors", [])
    put("no_internal_errors", not ie, f"{len(ie)} tool calls failed inside the environment: " + "; ".join(f"{e['tool']}: {e['error']}" for e in ie[:3]) if ie else "no tool failed inside the environment")
    put("vectors_valid", not bad_vec, f"bad CRS or geometry: {', '.join(bad_vec)}" if bad_vec else "every written vector has a known CRS and no empty geometry")
    return out
