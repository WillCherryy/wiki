"""Geoprocessing engines behind the session's tools.

    numpy  the primitives in ops.py (rasterio, shapely, pyproj, scipy): the default, and what the answer key uses
    qgis   QGIS 3.x processing in a separate process (qgis_worker.py), for slope, reprojection, repair, buffer, rasterize
           and distance. Mask logic, thresholds, statistics, patches and yield stay in numpy in both engines: they are
           exact array operations with no convention to differ on.

Choose with Session(task, engine="qgis") or GISBENCH_ENGINE=qgis. GISBENCH_QGIS_PYTHON names the Python with the QGIS
bindings (default /usr/bin/python3.12). One QGIS process is started per Python process and reused.
"""
from __future__ import annotations
import atexit
import json
import math
import os
import shutil
import subprocess
import tempfile
import threading
import numpy as np
import pyproj
import rasterio
from shapely.geometry import shape, mapping, GeometryCollection, Polygon, MultiPolygon
from shapely.validation import make_valid
from . import ops
from .ops import Raster, Vector, NODATA


class NumpyEngine:
    name = "numpy"

    def slope(self, r: Raster, unit: str) -> Raster:
        return ops.slope(r, unit, honor_nodata=r.nodata_declared)

    def reproject(self, v: Vector, dst: str) -> Vector:
        t = pyproj.Transformer.from_crs(v.crs, dst, always_xy=True)
        return Vector([(ops.reproject_geometry(g, t), p) for g, p in v.feats], dst)

    def fix(self, v: Vector) -> Vector:
        feats = []
        for g, p in v.feats:
            if not g.is_valid:
                g = make_valid(g)
                if isinstance(g, GeometryCollection) and not isinstance(g, (Polygon, MultiPolygon)):
                    parts = [x for x in g.geoms if isinstance(x, (Polygon, MultiPolygon))]
                    g = MultiPolygon([q for x in parts for q in (x.geoms if isinstance(x, MultiPolygon) else [x])])
            feats.append((g, p))
        return Vector(feats, v.crs)

    def buffer(self, v: Vector, dist: float) -> Vector:
        return ops.buffer_vector(v, dist)

    def rasterize(self, v: Vector, tmpl: Raster, all_touched: bool) -> Raster:
        return ops.rasterize(v, tmpl, all_touched)

    def distance(self, v: Vector, tmpl: Raster) -> Raster:
        return ops.distance_to(v, tmpl)


class EngineError(RuntimeError):
    pass


class QgisEngine:
    name = "qgis"
    _lock = threading.Lock()

    def __init__(self, python=None):
        py = python or os.environ.get("GISBENCH_QGIS_PYTHON", "/usr/bin/python3.12")
        worker = os.path.join(os.path.dirname(__file__), "qgis_worker.py")
        env = {**os.environ, "QT_QPA_PLATFORM": "offscreen"}
        self.dir = tempfile.mkdtemp(prefix="gisbench-qgis-")
        self.p = subprocess.Popen([py, worker], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True, env=env, cwd=self.dir)
        hello = self._read()
        if not hello.get("ok"):
            raise EngineError(f"QGIS engine did not start: {hello}")
        self.version = {"qgis": hello["qgis"], "gdal": hello["gdal"]}
        self.n = 0
        atexit.register(self.close)

    def close(self):
        if self.p.poll() is None:
            self.p.stdin.close(); self.p.wait(timeout=30)
        shutil.rmtree(self.dir, ignore_errors=True)

    def _read(self):
        while True:
            line = self.p.stdout.readline()
            if not line:
                raise EngineError("QGIS engine stopped")
            if line.startswith("@@"):
                return json.loads(line[2:])

    def _op(self, op, **args):
        with self._lock:
            self.p.stdin.write(json.dumps({"op": op, "args": args}) + "\n"); self.p.stdin.flush()
            r = self._read()
        if not r["ok"]:
            raise EngineError(r["error"])

    def _path(self, ext):
        self.n += 1
        return os.path.join(self.dir, f"l{self.n}.{ext}")

    # ---- files ----------------------------------------------------------
    def _write_vector(self, v: Vector):
        path = self._path("geojson")
        fc = {"type": "FeatureCollection", "crs": {"type": "name", "properties": {"name": v.crs}},
              "features": [{"type": "Feature", "geometry": mapping(g), "properties": {**p, "_i": i}} for i, (g, p) in enumerate(v.feats)]}
        with open(path, "w") as fh:
            json.dump(fc, fh)
        return path

    def _read_vector(self, path, crs) -> Vector:
        with open(path) as fh:
            fc = json.load(fh)
        feats = sorted(((f["properties"].get("_i", k), shape(f["geometry"]), {a: b for a, b in f["properties"].items() if a != "_i"})
                        for k, f in enumerate(fc["features"]) if f.get("geometry")), key=lambda x: x[0])
        return Vector([(g, p) for _, g, p in feats], crs)

    def _write_raster(self, r: Raster):
        path = self._path("tif")
        prof = {"driver": "GTiff", "width": r.a.shape[1], "height": r.a.shape[0], "count": 1, "dtype": "float32", "crs": r.crs, "transform": r.transform}
        if r.nodata_declared:
            prof["nodata"] = NODATA
        with rasterio.open(path, "w", **prof) as ds:
            ds.write(r.a.astype("float32"), 1)
        return path

    def _read_raster(self, path):
        with rasterio.open(path) as ds:
            return ds.read(1), ds.nodata

    # ---- operations -------------------------------------------------------
    def slope(self, r: Raster, unit: str) -> Raster:
        out = self._path("tif")
        self._op("slope", dem=self._write_raster(r), out=out)
        a, nd = self._read_raster(out)
        valid = (a != nd) if nd is not None else np.ones(a.shape, bool)
        if r.nodata_declared:
            valid &= r.a != NODATA
        a = a.astype("float64")
        if unit == "percent":
            a = 100.0 * np.tan(np.radians(a))
        return Raster(np.where(valid, a, NODATA).astype("float32"), r.transform, r.crs, "float")

    def reproject(self, v: Vector, dst: str) -> Vector:
        out = self._path("geojson")
        self._op("reproject", src=self._write_vector(v), crs=dst, out=out)
        return self._read_vector(out, dst)

    def fix(self, v: Vector) -> Vector:
        out = self._path("geojson")
        self._op("fix", src=self._write_vector(v), out=out)
        return self._read_vector(out, v.crs)

    def buffer(self, v: Vector, dist: float) -> Vector:
        out = self._path("geojson")
        self._op("buffer", src=self._write_vector(v), distance=dist, out=out)
        return self._read_vector(out, v.crs)

    def rasterize(self, v: Vector, tmpl: Raster, all_touched: bool) -> Raster:
        out = self._path("tif")
        self._op("rasterize", src=self._write_vector(v), template=self._write_raster(tmpl), out=out, all_touched=bool(all_touched))
        a, _ = self._read_raster(out)
        return Raster(a.astype("uint8"), tmpl.transform, tmpl.crs, "mask")

    def distance(self, v: Vector, tmpl: Raster) -> Raster:
        out = self._path("tif")
        self._op("distance", src=self._write_vector(v), template=self._write_raster(tmpl), out=out)
        a, _ = self._read_raster(out)
        return Raster(a.astype("float32"), tmpl.transform, tmpl.crs, "float")


_ENGINES = {}


def get(name=None):
    name = name or os.environ.get("GISBENCH_ENGINE", "numpy")
    if name not in _ENGINES:
        _ENGINES[name] = {"numpy": NumpyEngine, "qgis": QgisEngine}[name]()
    return _ENGINES[name]
