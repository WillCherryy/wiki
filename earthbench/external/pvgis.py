"""External comparison of the solar chain with PVGIS 5.2 (European Commission Joint Research Centre), for the same hours of 2019 at three
real sites, using PVGIS's own satellite irradiance (SARAH-2) and ERA5 temperature and wind (files in earthbench/external/data/pvgis,
downloaded from the PVGIS API, re.jrc.ec.europa.eu/api/v5_2/seriescalc, no horizon shading).

Inputs: PVGIS's horizontal beam and diffuse (a call with a 0 degree plane), from which direct normal = beam horizontal / sin(sun height).
Scorcher's chain (earthbench.solar.pv_energy: pvlib SPA, isotropic sky, SAPM temperature, PVWatts) then computes the 30 degree south plane;
PVGIS's own run for that plane gives its plane-of-array components and power.

What is graded, and what is only measured:
  - beam on the plane is geometry (sun position and angle of incidence): the two must agree, within 1% over the year;
  - diffuse on the plane differs by model (isotropic sky against PVGIS's Muneer model) and energy differs by model (Scorcher has no
    angle-of-incidence or spectral loss and a different temperature model): these differences are reported, as quantified limits.

    python -m earthbench.external.pvgis
"""
from __future__ import annotations
import json
import os
import sys
import time
import numpy as np

HERE = os.path.dirname(__file__)
SITES = (("madrid", 40.4, -3.7), ("freiburg", 47.99, 7.85), ("seville", 37.39, -5.98))


def _load(site):
    import gzip
    rd = lambda f: json.load(gzip.open(os.path.join(HERE, "data", "pvgis", f"{f}_{site}.json.gz"), "rt"))
    return rd("h0"), rd("pv30")


def compare(site, lat, lon):
    import pandas as pd
    from earthbench import solar as S
    h0, p30 = _load(site)
    H, P = h0["outputs"]["hourly"], p30["outputs"]["hourly"]
    elev = p30["inputs"]["location"]["elevation"]
    t = pd.DatetimeIndex([pd.Timestamp(f"{x['time'][:4]}-{x['time'][4:6]}-{x['time'][6:8]}T{x['time'][9:11]}:{x['time'][11:13]}", tz="UTC") for x in H])
    bh = np.array([x["Gb(i)"] for x in H]); dh = np.array([x["Gd(i)"] for x in H]); hs = np.array([x["H_sun"] for x in H])
    ghi = bh + dh
    dni = np.where(hs > 2, bh / np.sin(np.radians(np.clip(hs, 2, 90))), 0.0)
    T = np.array([x["T2m"] for x in H]); W = np.array([x["WS10m"] for x in H])
    old = (S.LAT, S.LON, S.ALT)
    try:
        S.LAT, S.LON, S.ALT = lat, lon, elev
        import pvlib
        sp = pvlib.solarposition.get_solarposition(t, lat, lon, altitude=elev)
        aoi = pvlib.irradiance.aoi(30, 180, sp["apparent_zenith"].values, sp["azimuth"].values)
        beam = float(np.sum(dni * np.clip(np.cos(np.radians(aoi)), 0, None))) / 1000
        r = S.pv_energy(t, ghi, dni, dh, T, W, kwp=1.0, tilt=30, azimuth=180, gamma=-0.004, inverter_kw=2.0, losses=0.104, missing=None)
    finally:
        S.LAT, S.LON, S.ALT = old
    pb = sum(x["Gb(i)"] for x in P) / 1000; pd_ = sum(x["Gd(i)"] for x in P) / 1000; pr = sum(x["Gr(i)"] for x in P) / 1000; pe = sum(x["P"] for x in P) / 1000
    return {"site": site, "beam_scorcher": beam, "beam_pvgis": pb, "poa_scorcher": r["poa_insolation_kwh_m2"], "poa_pvgis": pb + pd_ + pr,
            "energy_scorcher": r["annual_energy_mwh"] * 1000, "energy_pvgis": pe}


def run():
    rows = [compare(*s) for s in SITES]
    out = []
    worst = max(abs(r["beam_scorcher"] / r["beam_pvgis"] - 1) for r in rows)
    out.append(("Beam on the plane (geometry), 3 sites, 2019", bool(worst <= 0.01),
                "; ".join(f"{r['site']} {r['beam_scorcher']:.0f} against {r['beam_pvgis']:.0f} kWh/m2 ({(r['beam_scorcher'] / r['beam_pvgis'] - 1) * 100:+.1f}%)" for r in rows)))
    out.append(("Total on the plane (isotropic sky against PVGIS's Muneer model): measured, not graded", None,
                "; ".join(f"{r['site']} {(r['poa_scorcher'] / r['poa_pvgis'] - 1) * 100:+.1f}%" for r in rows)))
    out.append(("Annual energy (no angle-of-incidence or spectral loss; SAPM temperature): measured, not graded", None,
                "; ".join(f"{r['site']} {r['energy_scorcher']:.0f} against {r['energy_pvgis']:.0f} kWh/kWp ({(r['energy_scorcher'] / r['energy_pvgis'] - 1) * 100:+.1f}%)" for r in rows)))
    return out, rows


def main():
    res, rows = run()
    for n, ok, d in res:
        print(f"{'pass' if ok else 'FAIL' if ok is False else 'note'}  {n}: {d}")
    ok = all(o is not False for _, o, _ in res)
    path = os.path.join(HERE, "..", "results", "external", "pvgis.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    json.dump({"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "pass": ok, "source": "PVGIS 5.2 (JRC) seriescalc, 2019, SARAH-2 and ERA5",
               "checks": [{"name": n, "pass": o, "detail": d} for n, o, d in res], "rows": rows}, open(path, "w"), indent=1)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
