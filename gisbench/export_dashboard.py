"""Write mockups/suite/gisbench-sample.js for the Build console from a real benchmark run (fixtures, plus any model files).

    python3 -m gisbench.export_dashboard
"""
from __future__ import annotations
import base64
import glob
import json
import os
import numpy as np
from . import tasks as T, world as W
from .agents import ARMS
from .run import run_suite, run_one, environment
from .session import Session
from .stats import wilson, paired

ROOT = os.path.join(os.path.dirname(__file__), "..")
EXAMPLES = [(2, "S3", d) for d in W.DEFECTS] + [(2, "S2", "crs")]


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def rle(a):
    """Run-length code for small class rasters: (value, run) byte pairs, runs up to 255."""
    v, out = np.ascontiguousarray(a, "uint8").ravel(), []
    i = 0
    while i < v.size:
        j = i
        while j + 1 < v.size and v[j + 1] == v[i] and j + 1 - i < 255:
            j += 1
        out += [int(v[i]), j - i + 1]
        i = j + 1
    return b64(np.array(out, "uint8"))


def bits(m):
    return b64(np.packbits(m.astype(bool).ravel()))


def example(seed, spec, defect, arm_keys):
    t = T.make_task(seed, spec, defect)
    key = W.solve(t.world, t.params, defect)
    z = t.world.dem.a
    q = np.round((z - z.min()) / (z.max() - z.min()) * 255).astype("uint8")
    inv = lambda x, y: [(x - W.X0) / W.CELL, (W.Y0 - y) / W.CELL]
    prot = [{"designation": p["designation"], "name": p["name"], "ring": [inv(*c) for c in g.exterior.coords]} for g, p in t.world.protected.feats]
    grid = [inv(*c) for c in t.world.grid.feats[0][0].coords]
    arms = {}
    for k in arm_keys:
        r, s = run_one(ARMS[k][1], t)
        r.pop("key", None)
        arms[k] = {"row": r, "mask": bits(s.layers[s.answer["mask"]].a) if s.answer else None, "assumptions": s.answer["assumptions"] if s.answer else None,
                   "errors": [{"i": e["i"], "tool": e["tool"], "error": e["error"]} for e in s.trace if not e["ok"]]}
    return {"id": t.id, "spec": spec, "defect": defect, "statement": t.statement, "docs": t.docs, "params": t.params.__dict__, "stated": t.stated, "n": W.N, "cell_m": W.CELL,
            "dem": b64(q), "dem_range": [float(z.min()), float(z.max())], "land": b64(t.world.landcover.a), "key_mask": bits(key["mask"].a), "hard": bits(key["hard"].a),
            "key": {k: key[k] for k in ("suitable_area_ha", "largest_parcel_ha", "feasible", "clear_sky_yield_gwh")}, "protected": prot, "grid": grid, "arms": arms}


def _all_tasks():
    return {t.id: t for t in T.main_suite() + T.injection_suite() + T.hard_suite()}


def _brief_args(args):
    """Tool arguments as shown in the console: short, never a document's contents."""
    out = {}
    for k, v in (args or {}).items():
        v = v if isinstance(v, (int, float, bool)) or v is None else str(v)
        out[k] = v[:80] + "..." if isinstance(v, str) and len(v) > 80 else v
    return out


def model_runs(results_dir):
    """Model result files of the current benchmark version, with each task's mask rebuilt by replaying the recorded tool calls
    (the tools are deterministic), the scripted arms on the same tasks for a paired comparison, and map data per task."""
    tasks, runs, worlds = _all_tasks(), [], {}
    files = sorted(glob.glob(os.path.join(results_dir, "model-*.json"))) + sorted(glob.glob(os.path.join(results_dir, "v[0-9]*", "model-*.json")), reverse=True)
    for f in files:
        m = json.load(open(f))
        if m.get("bench_version", 1) < 2:
            continue  # version 1 traces carry no arguments, so they cannot be replayed; kept in results/v1 and summarised in the README
        rows, base = [], {"d0": [], "d1": []}
        for r in m["rows"]:
            t = tasks[r["task"]]
            mask, replay, phys = None, None, None
            if all("args" in e for e in r.get("trace", [])):
                s = Session(t, engine=m.get("engine", "numpy"))
                for e in r["trace"]:
                    s.call(e["tool"], e["args"])
                replay = s.answer is not None and all(s.answer.get(k) == v for k, v in (r.get("answer") or {}).items())
                lay = s.layers.get((s.answer or {}).get("mask"))
                mask = bits(lay.a) if lay is not None and getattr(lay, "kind", None) != "vector" and hasattr(lay, "a") else None
                if replay:
                    from .physics import validate
                    phys = validate(t, s)
            for k in base:
                base[k].append(run_one(ARMS[k][1], t)[0]["pass"])
            u = r.get("usage") or {}
            rows.append({k: r.get(k) for k in ("task", "spec", "defect", "pass", "partial", "correct", "safe", "checks", "answer", "key", "iou", "hard_cells", "violations", "calls", "errors")}
                        | {"usd": u.get("usd"), "stop": u.get("stop"), "replayed": replay, "mask": mask, "physics": phys,
                           "trace": [{"tool": e["tool"], "args": _brief_args(e.get("args")), "ok": e["ok"], "error": e["error"]} for e in r.get("trace", [])]})
            if t.id not in worlds:
                key = W.solve(t.world, t.params, t.defect)
                inv = lambda x, y: [(x - W.X0) / W.CELL, (W.Y0 - y) / W.CELL]
                worlds[t.id] = {"statement": t.statement, "land_rle": rle(t.world.landcover.a), "key_mask": bits(key["mask"].a), "hard": bits(key["hard"].a), "n": W.N,
                                "protected": [{"designation": p["designation"], "ring": [inv(*c) for c in g.exterior.coords]} for g, p in t.world.protected.feats],
                                "grid": [inv(*c) for c in t.world.grid.feats[0][0].coords]}
        mp = [bool(r["pass"]) for r in rows]
        runs.append({"engine": m.get("engine", "numpy"), "version": m.get("bench_version", 1), "current": m.get("bench_version", 1) == T.BENCH_VERSION, "model": m["model"], "prompt": m["prompt"], "suite": m["suite"], "file": os.path.basename(f), "generated": m.get("generated"), "n_run": m["n_run"],
                     "n_suite": m["n_suite"], "usd": m["usd"], "pass": wilson(sum(mp), len(mp)), "safe": wilson(sum(bool(r["safe"]) for r in rows), len(rows)),
                     "vs": {k: {"pass": wilson(sum(v), len(v)), "paired": paired(v, mp)} for k, v in base.items()}, "rows": rows})
    return runs, worlds


def fail_kinds(rows):
    out = {"no answer": 0, "wrong value": 0, "inside protected area": 0, "policy violation": 0}
    for r in rows:
        if r["pass"]:
            continue
        if not r["answered"]:
            out["no answer"] += 1
        if r.get("hard_cells"):
            out["inside protected area"] += 1
        if r["violations"]:
            out["policy violation"] += 1
        if r["answered"] and not r["correct"]:
            out["wrong value"] += 1
    return out


def main():
    keys = list(ARMS)
    main_s, inj_s, hard_s = run_suite("main", T.main_suite(), keys), run_suite("injection", T.injection_suite(), keys), run_suite("hard", T.hard_suite(), keys)
    for su in (main_s, inj_s, hard_s):
        for a in su["arms"]:
            a["summary"]["fail_kinds"] = fail_kinds(a["rows"])
            for r in a["rows"]:
                r.pop("trace", None); r.pop("key", None)
    # model arms, if saved by model_runner: shown as they are, with how many tasks were run
    runs, worlds = model_runs(os.environ.get("GISBENCH_RESULTS") or os.path.join(os.path.dirname(__file__), "results"))
    models = [{k: r[k] for k in ("model", "prompt", "suite", "n_run", "n_suite", "usd")} for r in runs]
    xc = os.path.join(os.path.dirname(__file__), "results", "qgis-crosscheck.json")
    ec = os.path.join(os.path.dirname(__file__), "results", "qgis-engine-check.json")
    engine = {k: v for k, v in json.load(open(ec)).items() if k != "rows"} if os.path.exists(ec) else None
    doc = {"generated": main_s and __import__("time").strftime("%Y-%m-%d", __import__("time").gmtime()), "environment": environment(), "labels": {k: ARMS[k][0] for k in keys},
           "main": main_s, "injection": inj_s, "hard": hard_s, "examples": [example(*e, keys) for e in EXAMPLES], "models": models, "runs": runs, "worlds": worlds, "bench_version": T.BENCH_VERSION,
           "crosscheck": json.load(open(xc)) if os.path.exists(xc) else None, "engine": engine, "tools": len(__import__("gisbench.session", fromlist=["TOOL_SPECS"]).TOOL_SPECS)}
    out = os.path.join(ROOT, "mockups", "suite", "gisbench-sample.js")
    open(out, "w").write("// Generated by python3 -m gisbench.export_dashboard from a real run of gisbench (fixtures and scripted arms; no model unless listed in models). Do not edit.\nwindow.GISBENCH = " + json.dumps(doc, separators=(",", ":")) + ";\n")
    print("wrote", os.path.relpath(out, ROOT), f"{os.path.getsize(out) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
