"""Geospatial primitives shared by the tool layer and the answer key.

Both use these functions, so the answer key is only as good as these primitives. They are cross-checked against
QGIS processing algorithms in qgis_crosscheck.py; that check, not this module, is the independent evidence.
"""
from __future__ import annotations
import math
import numpy as np
from scipy import ndimage as ndi
from rasterio import features
from rasterio.transform import Affine
import shapely
from shapely.geometry import shape, mapping
from shapely.validation import explain_validity

EPSILON = 1e-9
NODATA = -9999.0


class Raster:
    """A single-band raster in a projected CRS. `nodata` cells hold NODATA in float rasters."""
    __slots__ = ("a", "transform", "crs", "kind", "nodata_declared", "meta")

    def __init__(self, a, transform: Affine, crs: str, kind: str = "float", nodata_declared: bool = True, meta: dict | None = None):
        self.a, self.transform, self.crs, self.kind, self.nodata_declared = a, transform, crs, kind, nodata_declared
        self.meta = meta or {}          # layer metadata as a GIS would show it (vertical units, class legend)

    @property
    def cell(self) -> float:
        return abs(self.transform.a)

    @property
    def shape(self):
        return self.a.shape

    @property
    def cell_ha(self) -> float:
        return self.cell * self.cell / 10_000.0


class Vector:
    """Features as (shapely geometry, properties) pairs in one CRS."""
    __slots__ = ("feats", "crs")

    def __init__(self, feats, crs: str):
        self.feats, self.crs = feats, crs

    def is_geographic(self) -> bool:
        return self.crs.upper() in ("EPSG:4326", "EPSG:4269")

    def invalid(self):
        return [(i, explain_validity(g)) for i, (g, _) in enumerate(self.feats) if not g.is_valid]


def slope(dem: Raster, unit: str = "degrees", honor_nodata: bool = True) -> Raster:
    """Horn (1981) slope, with GDAL and QGIS conventions for missing data.

    honor_nodata: a nodata cell stays nodata; a nodata neighbour is replaced by the centre value (what gdaldem and QGIS native:slope do),
    so cells beside a gap still get a slope. Without it (an undeclared nodata value) the raw numbers are used, as GIS software does.
    Cells beyond the raster edge repeat the edge value.
    """
    z = dem.a.astype("float64")
    zz = np.where(z == NODATA, np.nan, z) if honor_nodata else z
    p = np.pad(zz, 1, mode="edge")
    c = dem.cell

    def nb(dr, dc):
        n = p[1 + dr:p.shape[0] - 1 + dr, 1 + dc:p.shape[1] - 1 + dc]
        return np.where(np.isnan(n), zz, n) if honor_nodata else n

    a, b, cc = nb(-1, -1), nb(-1, 0), nb(-1, 1)
    d, f = nb(0, -1), nb(0, 1)
    g, h, i = nb(1, -1), nb(1, 0), nb(1, 1)
    dzdx = ((cc + 2 * f + i) - (a + 2 * d + g)) / (8 * c)
    dzdy = ((g + 2 * h + i) - (a + 2 * b + cc)) / (8 * c)
    rise = np.hypot(dzdx, dzdy)
    out = np.degrees(np.arctan(rise)) if unit == "degrees" else 100.0 * rise
    out = np.where(np.isnan(out), NODATA, out)
    return Raster(out.astype("float32"), dem.transform, dem.crs, "float")


def nodata_mask(r: Raster, grow: int = 0) -> Raster:
    """Mask of nodata cells, grown by `grow` cells in every direction (8-neighbourhood)."""
    m = r.a == NODATA
    if grow:
        m = ndi.binary_dilation(m, structure=np.ones((3, 3)), iterations=int(grow))
    return Raster(m.astype("uint8"), r.transform, r.crs, "mask")


def rasterize(v: Vector, tmpl: Raster, all_touched: bool = False) -> Raster:
    shapes = [(g, 1) for g, _ in v.feats if not g.is_empty]
    m = features.rasterize(shapes, out_shape=tmpl.shape, transform=tmpl.transform, fill=0, all_touched=all_touched, dtype="uint8") if shapes else np.zeros(tmpl.shape, "uint8")
    return Raster(m, tmpl.transform, tmpl.crs, "mask")


def distance_to(v: Vector, tmpl: Raster) -> Raster:
    m = rasterize(v, tmpl, all_touched=True).a
    d = ndi.distance_transform_edt(m == 0, sampling=tmpl.cell)
    return Raster(d.astype("float32"), tmpl.transform, tmpl.crs, "float")


def threshold(r: Raster, op: str, value: float) -> Raster:
    a = r.a
    valid = a != NODATA
    f = {"lt": np.less, "le": np.less_equal, "gt": np.greater, "ge": np.greater_equal, "eq": np.equal}[op]
    return Raster((f(a, value) & valid).astype("uint8"), r.transform, r.crs, "mask")


def member(r: Raster, classes, invert: bool = False) -> Raster:
    m = np.isin(r.a, list(classes))
    return Raster((~m if invert else m).astype("uint8"), r.transform, r.crs, "mask")


def logic(a: Raster, b: Raster, op: str) -> Raster:
    x, y = a.a.astype(bool), b.a.astype(bool)
    m = {"and": x & y, "or": x | y, "andnot": x & ~y}[op]
    return Raster(m.astype("uint8"), a.transform, a.crs, "mask")


def area_ha(mask: Raster) -> float:
    return float(mask.a.astype(bool).sum()) * mask.cell_ha


def largest_patch(mask: Raster, connectivity: int = 8):
    st = np.ones((3, 3)) if connectivity == 8 else None
    lab, n = ndi.label(mask.a.astype(bool), structure=st)
    if n == 0:
        return 0.0, 0, Raster(np.zeros(mask.shape, "uint8"), mask.transform, mask.crs, "mask")
    sizes = ndi.sum(np.ones_like(lab), lab, index=np.arange(1, n + 1))
    k = int(np.argmax(sizes)) + 1
    out = Raster((lab == k).astype("uint8"), mask.transform, mask.crs, "mask")
    return float(sizes[k - 1]) * mask.cell_ha, n, out


def iou(a: Raster, b: Raster) -> float:
    x, y = a.a.astype(bool), b.a.astype(bool)
    u = (x | y).sum()
    return 1.0 if u == 0 else float((x & y).sum() / u)


def buffer_vector(v: Vector, dist: float, where=None) -> Vector:
    out = []
    for g, p in v.feats:
        if where and p.get(where[0]) != where[1]:
            continue
        out.append((g.buffer(dist), p))
    return Vector(out, v.crs)


def to_geojson(v: Vector) -> dict:
    return {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": mapping(g), "properties": p} for g, p in v.feats]}


def from_geojson(d: dict, crs: str) -> Vector:
    return Vector([(shape(f["geometry"]), dict(f.get("properties") or {})) for f in d["features"]], crs)


# unit conversion: exact factors, used by the unit tool and by the answer key
_LEN = {"m": 1.0, "km": 1000.0, "ft": 0.3048, "mi": 1609.344}
_AREA = {"ha": 1.0, "acre": 0.40468564224, "km2": 100.0, "m2": 1e-4}


def convert(value: float, src: str, dst: str) -> float:
    for table in (_LEN, _AREA):
        if src in table and dst in table:
            return value * table[src] / table[dst]
    if src == "percent" and dst == "degrees":
        return math.degrees(math.atan(value / 100.0))
    if src == "degrees" and dst == "percent":
        return 100.0 * math.tan(math.radians(value))
    raise ValueError(f"cannot convert {src} to {dst}")


def reproject_geometry(g, transformer):
    """Apply a pyproj Transformer (always_xy) to a shapely geometry."""
    return shapely.transform(g, lambda c: np.column_stack(transformer.transform(c[:, 0], c[:, 1])))
