"""QGIS engine process for gisbench. Runs under the Python that has the QGIS bindings (Ubuntu: /usr/bin/python3.12) and answers
one JSON request per line on stdin with one line on stdout, prefixed "@@" so stray library output is ignored.

    QT_QPA_PLATFORM=offscreen /usr/bin/python3.12 gisbench/qgis_worker.py

Layers travel as files (GeoTIFF, GeoJSON) in a folder the client owns. What each operation uses:
  slope        QGIS processing native:slope (Horn)
  reproject    QGIS processing native:reprojectlayer
  fix          QGIS processing native:fixgeometries (structure method)
  buffer       QGIS processing native:buffer, 16 segments per quarter circle, round caps and joins
  rasterize    GDAL Rasterize (the GDAL that QGIS is built on, called in-process: the processing wrapper shells out to a
               separate Python that cannot load this GDAL)
  distance     GDAL ComputeProximity on the all-touched rasterization, in metres
This file imports nothing from gisbench, so it can run in a different Python from the rest of the benchmark.
"""
import json
import os
import sys

os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
sys.path.append("/usr/share/qgis/python/plugins")
from qgis.core import QgsApplication, Qgis, QgsVectorLayer, QgsCoordinateReferenceSystem, QgsProcessingFeedback  # noqa: E402
from osgeo import gdal, ogr, osr  # noqa: E402

gdal.UseExceptions()


def _vec(path):
    v = QgsVectorLayer(path, "v", "ogr")
    if not v.isValid():
        raise ValueError(f"cannot open {path}")
    return v


def _save(layer, path):
    from qgis.core import QgsVectorFileWriter, QgsCoordinateTransformContext
    o = QgsVectorFileWriter.SaveVectorOptions(); o.driverName = "GeoJSON"
    err = QgsVectorFileWriter.writeAsVectorFormatV3(layer, path, QgsCoordinateTransformContext(), o)
    if err[0] != QgsVectorFileWriter.NoError:
        raise ValueError(f"write failed: {err}")


def _template(path):
    ds = gdal.Open(path)
    return ds.RasterXSize, ds.RasterYSize, ds.GetGeoTransform(), ds.GetProjection()


def _rasterize(src, tmpl, out, all_touched):
    nx, ny, gt, wkt = _template(tmpl)
    ds = gdal.GetDriverByName("GTiff").Create(out, nx, ny, 1, gdal.GDT_Byte)
    ds.SetGeoTransform(gt); ds.SetProjection(wkt); ds.GetRasterBand(1).Fill(0)
    v = ogr.Open(src)
    gdal.RasterizeLayer(ds, [1], v.GetLayer(0), burn_values=[1], options=["ALL_TOUCHED=TRUE"] if all_touched else [])
    ds.FlushCache(); ds = None


def main():
    app = QgsApplication([], False); app.initQgis()
    import processing
    from processing.core.Processing import Processing
    Processing.initialize()
    fb = QgsProcessingFeedback()
    run = lambda alg, p: processing.run(alg, p, feedback=fb)
    print("@@" + json.dumps({"ok": True, "qgis": Qgis.QGIS_VERSION, "gdal": gdal.__version__}), flush=True)
    for line in sys.stdin:
        if not line.strip():
            continue
        q = json.loads(line)
        try:
            op, a = q["op"], q["args"]
            if op == "slope":
                run("native:slope", {"INPUT": a["dem"], "Z_FACTOR": 1, "OUTPUT": a["out"]})
            elif op == "reproject":
                run("native:reprojectlayer", {"INPUT": _vec(a["src"]), "TARGET_CRS": QgsCoordinateReferenceSystem(a["crs"]), "OUTPUT": a["out"]})
            elif op == "fix":
                run("native:fixgeometries", {"INPUT": _vec(a["src"]), "METHOD": 1, "OUTPUT": a["out"]})
            elif op == "buffer":
                run("native:buffer", {"INPUT": _vec(a["src"]), "DISTANCE": a["distance"], "SEGMENTS": 16, "END_CAP_STYLE": 0, "JOIN_STYLE": 0,
                                      "MITER_LIMIT": 2, "DISSOLVE": False, "OUTPUT": a["out"]})
            elif op == "rasterize":
                _rasterize(a["src"], a["template"], a["out"], a.get("all_touched", False))
            elif op == "distance":
                burn = a["out"] + ".burn.tif"
                _rasterize(a["src"], a["template"], burn, True)
                b = gdal.Open(burn)
                nx, ny, gt, wkt = _template(a["template"])
                ds = gdal.GetDriverByName("GTiff").Create(a["out"], nx, ny, 1, gdal.GDT_Float32)
                ds.SetGeoTransform(gt); ds.SetProjection(wkt)
                gdal.ComputeProximity(b.GetRasterBand(1), ds.GetRasterBand(1), ["VALUES=1", "DISTUNITS=GEO"])
                ds.FlushCache(); ds = None; b = None
            elif op == "version":
                pass
            else:
                raise ValueError(f"unknown op {op}")
            print("@@" + json.dumps({"ok": True}), flush=True)
        except Exception as e:  # report and carry on: one bad call must not end the engine
            print("@@" + json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"}), flush=True)
    app.exitQgis()


if __name__ == "__main__":
    main()
