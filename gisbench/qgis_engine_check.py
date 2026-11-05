"""Run the screening pipeline end to end with QGIS 3.x processing algorithms and compare with the answer key.

    python3 -m gisbench.export_engine_check
    QT_QPA_PLATFORM=offscreen /usr/bin/python3.12 gisbench/qgis_engine_check.py [dir] [report.json]

Steps done by QGIS: reproject (native:reprojectlayer), repair (native:fixgeometries), slope (native:slope), per-designation buffers
(native:buffer), rasterize (gdal:rasterize), distance and 8-connected patches (the GDAL library calls ComputeProximity and Polygonize, called in-process because the processing wrappers shell out to a Python that cannot load this GDAL). Only the
boolean combination of masks is done in numpy. This validates the whole recipe, not only single primitives. It is not the agents' tool layer.
"""
import json
import os
import sys
import numpy as np

sys.path.append("/usr/share/qgis/python/plugins")
from qgis.core import QgsApplication, Qgis, QgsVectorLayer, QgsCoordinateReferenceSystem, QgsProcessingFeedback
from osgeo import gdal, ogr

N, CELL, X0, Y0 = 120, 25.0, 500000.0, 4400000.0
EXT = f"{X0},{X0 + N * CELL},{Y0 - N * CELL},{Y0} [EPSG:32630]"


def arr(path):
    ds = gdal.Open(path); b = ds.GetRasterBand(1)
    return b.ReadAsArray(), b.GetNoDataValue()


def main(root="/tmp/gisbench-engine", report="gisbench/results/qgis-engine-check.json"):
    app = QgsApplication([], False); app.initQgis()
    import processing
    from processing.core.Processing import Processing
    Processing.initialize()
    fb = QgsProcessingFeedback()
    run = lambda alg, p: processing.run(alg, p, feedback=fb)
    rows = []
    for m in json.load(open(os.path.join(root, "manifest.json"))):
        d, p = m["dir"], m["params"]
        prot = QgsVectorLayer(os.path.join(d, "protected.geojson"), "p", "ogr"); grid = QgsVectorLayer(os.path.join(d, "grid.geojson"), "g", "ogr")
        utm = QgsCoordinateReferenceSystem("EPSG:32630")
        if prot.crs().authid() != "EPSG:32630":
            prot = run("native:reprojectlayer", {"INPUT": prot, "TARGET_CRS": utm, "OUTPUT": "memory:"})["OUTPUT"]
            grid = run("native:reprojectlayer", {"INPUT": grid, "TARGET_CRS": utm, "OUTPUT": "memory:"})["OUTPUT"]
        prot = run("native:fixgeometries", {"INPUT": prot, "METHOD": 1, "OUTPUT": "memory:"})["OUTPUT"]
        slope_path = os.path.join(d, "slope_q.tif")
        run("native:slope", {"INPUT": os.path.join(d, "dem.tif"), "Z_FACTOR": 1, "OUTPUT": slope_path})
        s, snd = arr(slope_path)
        ok = (s <= p["slope_deg"]) & (s != snd if snd is not None else True)
        dem_a, dem_nd = arr(os.path.join(d, "dem.tif")); gap = dem_a == dem_nd
        pad = np.pad(gap, 1); grown = np.zeros_like(gap)
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                grown |= pad[1 + dr:1 + dr + N, 1 + dc:1 + dc + N]
        ok &= ~grown                                   # the brief's rule: no elevation, or touching a cell with none
        land, _ = arr(os.path.join(d, "land.tif")); ok &= np.isin(land, (1, 2))
        for des, dist in (("A", p["buffer_a_m"]), ("B", p["buffer_b_m"])):
            src = prot.materialize(__import__("qgis.core", fromlist=["QgsFeatureRequest"]).QgsFeatureRequest().setFilterExpression(f"\"designation\" = '{des}'"))
            b = run("native:buffer", {"INPUT": src, "DISTANCE": dist, "SEGMENTS": 16, "END_CAP_STYLE": 0, "JOIN_STYLE": 0, "MITER_LIMIT": 2, "DISSOLVE": False, "OUTPUT": "memory:"})["OUTPUT"]
            out = os.path.join(d, f"zone_{des}.tif")
            run("gdal:rasterize", {"INPUT": b, "BURN": 1, "UNITS": 1, "WIDTH": CELL, "HEIGHT": CELL, "EXTENT": EXT, "NODATA": 0, "DATA_TYPE": 0, "INIT": 0, "OUTPUT": out})
            ok &= arr(out)[0] != 1
        g_path, dist_path = os.path.join(d, "grid_r.tif"), os.path.join(d, "dist_q.tif")
        run("gdal:rasterize", {"INPUT": grid, "BURN": 1, "UNITS": 1, "WIDTH": CELL, "HEIGHT": CELL, "EXTENT": EXT, "NODATA": 0, "DATA_TYPE": 0, "INIT": 0, "EXTRA": "-at", "OUTPUT": g_path})
        src_ds = gdal.Open(g_path); dst = gdal.GetDriverByName("GTiff").Create(dist_path, N, N, 1, gdal.GDT_Float32); dst.SetGeoTransform(src_ds.GetGeoTransform()); dst.SetProjection(src_ds.GetProjection())
        gdal.ComputeProximity(src_ds.GetRasterBand(1), dst.GetRasterBand(1), ["VALUES=1", "DISTUNITS=GEO"]); dst.FlushCache(); dst = None
        ok &= arr(dist_path)[0] <= p["grid_m"]
        site = os.path.join(d, "site_q.tif")
        drv = gdal.GetDriverByName("GTiff").Create(site, N, N, 1, gdal.GDT_Byte); drv.SetGeoTransform((X0, CELL, 0, Y0, 0, -CELL)); drv.SetProjection(utm.toWkt())
        drv.GetRasterBand(1).WriteArray(ok.astype("uint8")); drv.FlushCache(); drv = None
        sds = gdal.Open(site); mem = ogr.GetDriverByName("Memory").CreateDataSource("p"); lyr = mem.CreateLayer("p", srs=None); lyr.CreateField(ogr.FieldDefn("DN", ogr.OFTInteger))
        gdal.Polygonize(sds.GetRasterBand(1), None, lyr, 0, ["8CONNECTED=8"])
        areas = [ft.GetGeometryRef().GetArea() for ft in lyr if ft.GetField("DN") == 1]
        largest_ha = max(areas, default=0.0) / 10_000
        area_ha = float(ok.sum()) * CELL * CELL / 10_000
        keym = np.load(os.path.join(d, "key_mask.npy")).astype(bool)
        iou = float((ok & keym).sum() / max((ok | keym).sum(), 1))
        k = m["key"]
        rows.append({"id": m["id"], "area_ha": area_ha, "key_area_ha": k["suitable_area_ha"], "area_rel_diff": abs(area_ha - k["suitable_area_ha"]) / max(k["suitable_area_ha"], 1e-9),
                     "largest_ha": largest_ha, "key_largest_ha": k["largest_parcel_ha"], "largest_rel_diff": abs(largest_ha - k["largest_parcel_ha"]) / max(k["largest_parcel_ha"], 1e-9),
                     "iou": iou, "feasible_agrees": (largest_ha >= p["capacity_mw"] * p["ha_per_mw"]) == k["feasible"], "cells_differ": int((ok ^ keym).sum())})
    summ = {"qgis": Qgis.QGIS_VERSION, "tasks": len(rows), "min_iou": min(r["iou"] for r in rows), "max_area_rel_diff": max(r["area_rel_diff"] for r in rows),
            "max_largest_rel_diff": max(r["largest_rel_diff"] for r in rows), "feasible_agrees": sum(r["feasible_agrees"] for r in rows), "rows": rows}
    os.makedirs(os.path.dirname(report) or ".", exist_ok=True)
    with open(report, "w") as fh:
        json.dump(summ, fh, indent=1)
    print(json.dumps({k: v for k, v in summ.items() if k != "rows"}))
    bad = [r for r in rows if r["iou"] < 0.99]
    for r in bad[:6]:
        print("low IoU", r["id"], round(r["iou"], 4), "cells differ", r["cells_differ"])
    app.exitQgis()


if __name__ == "__main__":
    main(*sys.argv[1:3])
