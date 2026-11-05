"""Write a few worlds to disk (GeoTIFF, GeoJSON) with this package's own results, for qgis_crosscheck.py to compare against QGIS.
Run with the project Python; qgis_crosscheck.py needs the Python that ships PyQGIS (python3.12 with the Ubuntu qgis package)."""
import json
import os
import sys
import numpy as np
import rasterio
from . import ops, world as W


def main(out="/tmp/gisbench-xcheck", seeds=(0, 1, 2, 3, 4)):
    os.makedirs(out, exist_ok=True)
    manifest = []
    for s in seeds:
        w = W.make_world(s)
        d = os.path.join(out, f"w{s}")
        os.makedirs(d, exist_ok=True)
        prof = dict(driver="GTiff", height=W.N, width=W.N, count=1, dtype="float32", crs=W.CRS, transform=w.dem.transform)
        with rasterio.open(os.path.join(d, "dem.tif"), "w", **prof) as f:
            f.write(w.dem.a, 1)
        sl = ops.slope(w.dem)
        with rasterio.open(os.path.join(d, "slope_ours.tif"), "w", **prof) as f:
            f.write(sl.a, 1)
        json.dump(ops.to_geojson(w.protected), open(os.path.join(d, "protected.geojson"), "w"))
        json.dump(ops.to_geojson(w.grid), open(os.path.join(d, "grid.geojson"), "w"))
        ours = {f"buffer_{des}_{dist}": sum(g.buffer(dist).area for g, p in w.protected.feats if p["designation"] == des) for des, dist in (("A", 250), ("B", 500))}
        manifest.append({"seed": s, "dir": d, "buffer_area_m2": {k: v for k, v in ours.items()}})
    json.dump(manifest, open(os.path.join(out, "manifest.json"), "w"))
    print("wrote", out)


if __name__ == "__main__":
    main(*sys.argv[1:2])
