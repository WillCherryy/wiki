"""Compare this package's primitives with QGIS 3.x processing algorithms.

    cd <repo> && python3 -m gisbench.export_crosscheck
    QT_QPA_PLATFORM=offscreen /usr/bin/python3.12 gisbench/qgis_crosscheck.py [dir] [report.json]

This is the independent evidence that the answer key's slope and buffer primitives agree with QGIS. It does not cover the distance
raster or connected components (tested against shapely and a breadth-first search in tests/).
"""
import json
import os
import sys
import numpy as np

sys.path.append("/usr/share/qgis/python/plugins")
from qgis.core import QgsApplication, Qgis, QgsVectorLayer, QgsRasterLayer, QgsProcessingFeedback
from osgeo import gdal


def main(root="/tmp/gisbench-xcheck", report="gisbench/results/qgis-crosscheck.json"):
    app = QgsApplication([], False)
    app.initQgis()
    import processing
    from processing.core.Processing import Processing
    Processing.initialize()
    fb = QgsProcessingFeedback()
    rows = []
    for m in json.load(open(os.path.join(root, "manifest.json"))):
        d = m["dir"]
        out = os.path.join(d, "slope_qgis.tif")
        processing.run("native:slope", {"INPUT": os.path.join(d, "dem.tif"), "Z_FACTOR": 1, "OUTPUT": out}, feedback=fb)
        ours = gdal.Open(os.path.join(d, "slope_ours.tif")).ReadAsArray().astype("float64")
        theirs_ds = gdal.Open(out)
        theirs = theirs_ds.ReadAsArray().astype("float64")
        nd = theirs_ds.GetRasterBand(1).GetNoDataValue()
        inner = (slice(1, -1), slice(1, -1))
        a, b = ours[inner], theirs[inner]
        ok = (b != nd) if nd is not None else np.ones(b.shape, bool)
        diff = np.abs(a - b)[ok]
        row = {"seed": m["seed"], "slope_cells": int(ok.sum()), "slope_max_abs_diff_deg": float(diff.max()), "slope_mean_abs_diff_deg": float(diff.mean()), "slope_share_over_0_01_deg": float((diff > 0.01).mean())}
        for des, dist in (("A", 250), ("B", 500)):
            src = QgsVectorLayer(os.path.join(d, "protected.geojson"), "p", "ogr")
            src.setSubsetString(f"\"designation\" = '{des}'")
            res = processing.run("native:buffer", {"INPUT": src, "DISTANCE": dist, "SEGMENTS": 16, "END_CAP_STYLE": 0, "JOIN_STYLE": 0, "MITER_LIMIT": 2, "DISSOLVE": False, "OUTPUT": "memory:"}, feedback=fb)
            area = sum(f.geometry().area() for f in res["OUTPUT"].getFeatures())
            ref = m["buffer_area_m2"][f"buffer_{des}_{dist}"]
            row[f"buffer_{des}_rel_diff"] = abs(area - ref) / ref
        rows.append(row)
    summary = {"qgis": Qgis.QGIS_VERSION, "worlds": rows,
               "max_slope_diff_deg": max(r["slope_max_abs_diff_deg"] for r in rows),
               "max_buffer_rel_diff": max(r[k] for r in rows for k in r if k.startswith("buffer_"))}
    os.makedirs(os.path.dirname(report), exist_ok=True)
    json.dump(summary, open(report, "w"), indent=1)
    print(json.dumps({k: v for k, v in summary.items() if k != "worlds"}))
    app.exitQgis()


if __name__ == "__main__":
    main(*sys.argv[1:3])
