"""Write a sample of tasks (as served to an agent, defects included) with their keys, for qgis_engine_check.py.
Run with the project Python; the QGIS side needs the Python that ships PyQGIS."""
import json
import os
import sys
import numpy as np
import rasterio
from . import ops, tasks as T, world as W


def main(out="/tmp/gisbench-engine", seeds=(0, 1, 2)):
    os.makedirs(out, exist_ok=True)
    man = []
    for s in seeds:
        for sp in W.SPECS:
            for df in W.DEFECTS:
                t = T.make_task(s, sp, df)
                served = W.serve(t.world, df, False)
                key = W.solve(t.world, t.params, df)
                d = os.path.join(out, t.id); os.makedirs(d, exist_ok=True)
                prof = dict(driver="GTiff", height=W.N, width=W.N, count=1, crs=W.CRS, transform=t.world.dem.transform)
                dem = served["dem"].a
                with rasterio.open(os.path.join(d, "dem.tif"), "w", dtype="float32", nodata=W.NODATA, **prof) as f:
                    f.write(dem, 1)                           # nodata declared here: QGIS is given a well-formed file
                with rasterio.open(os.path.join(d, "land.tif"), "w", dtype="uint8", **prof) as f:
                    f.write(t.world.landcover.a, 1)
                for name, v in (("protected", served["protected_areas"]), ("grid", served["grid_line"])):
                    gj = ops.to_geojson(v)
                    gj["crs"] = {"type": "name", "properties": {"name": v.crs}}
                    json.dump(gj, open(os.path.join(d, name + ".geojson"), "w"))
                np.save(os.path.join(d, "key_mask.npy"), key["mask"].a)
                man.append({"id": t.id, "dir": d, "params": t.params.__dict__, "key": {k: key[k] for k in ("suitable_area_ha", "largest_parcel_ha", "feasible")}})
    json.dump(man, open(os.path.join(out, "manifest.json"), "w"))
    print("wrote", len(man), "tasks to", out)


if __name__ == "__main__":
    main()
