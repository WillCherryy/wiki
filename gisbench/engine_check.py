"""Cross-check the QGIS engine against the numpy engine on every task.

    python3 -m gisbench.engine_check            # writes gisbench/results/engine-qgis-check.json

For each task the analyst pipeline (d1) runs once per engine. Reported: pass under each engine, agreement of the two final
masks (IoU), the largest relative difference in suitable area and largest parcel, and the largest slope difference on the DEM
(valid cells of both). The answer key is computed with the numpy engine, so a QGIS pass is also a check of the key against QGIS.
"""
from __future__ import annotations
import json
import os
import time
import numpy as np
from . import tasks as T, engine as E
from .agents import ARMS
from .ops import NODATA
from .score import score
from .session import Session


def _iou(a, b):
    a, b = a.astype(bool), b.astype(bool)
    u = (a | b).sum()
    return 1.0 if u == 0 else float((a & b).sum() / u)


def main():
    q = E.get("qgis")
    rows, t0 = [], time.time()
    for t in T.main_suite() + T.injection_suite() + T.hard_suite():
        out = {}
        for name in ("numpy", "qgis"):
            s = Session(t, engine=name); ARMS["d1"][1](t, s); r = score(t, s)
            out[name] = (r, s)
        (rn, sn), (rq, sq) = out["numpy"], out["qgis"]
        an, aq = sn.answer, sq.answer
        sl = [x.layers["slope"].a for x in (sn, sq)]
        ok = (sl[0] != NODATA) & (sl[1] != NODATA)
        rel = lambda k: abs(aq[k] - an[k]) / an[k] if an[k] else abs(aq[k] - an[k])
        rows.append({"task": t.id, "pass_numpy": rn["pass"], "pass_qgis": rq["pass"], "iou_engines": round(_iou(sn.layers["site"].a, sq.layers["site"].a), 5),
                     "iou_key_qgis": rq["iou"], "area_rel": rel("suitable_area_ha"), "parcel_rel": rel("largest_parcel_ha"),
                     "slope_max_diff_deg": float(np.abs(sl[0][ok] - sl[1][ok]).max()), "slope_nodata_agree": bool(((sl[0] == NODATA) == (sl[1] == NODATA)).all()),
                     "errors_qgis": [e["error"] for e in sq.trace if not e["ok"]]})
    n = len(rows)
    rep = {"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "engine": q.version, "tasks": n, "seconds": round(time.time() - t0, 1),
           "pass_numpy": sum(r["pass_numpy"] for r in rows), "pass_qgis": sum(r["pass_qgis"] for r in rows),
           "min_iou_engines": min(r["iou_engines"] for r in rows), "max_area_rel": max(r["area_rel"] for r in rows),
           "max_parcel_rel": max(r["parcel_rel"] for r in rows), "max_slope_diff_deg": max(r["slope_max_diff_deg"] for r in rows),
           "slope_nodata_agree_all": all(r["slope_nodata_agree"] for r in rows), "qgis_errors": sum(len(r["errors_qgis"]) for r in rows), "rows": rows}
    path = os.path.join(os.path.dirname(__file__), "results", "engine-qgis-check.json")
    json.dump(rep, open(path, "w"), indent=1)
    print({k: v for k, v in rep.items() if k != "rows"})
    print("wrote", path)


if __name__ == "__main__":
    main()
