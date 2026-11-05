"""Run arms over a suite and write results as JSON.

    python3 -m gisbench.run --suite all --arms d0,d1,fx-careful,fx-naive,fx-gullible --out gisbench/results/phase1-fixtures.json

Fixture arms are scripted policies, not models. A model arm (see model_runner.py) is added to the same file when an API key is available.
"""
from __future__ import annotations
import argparse
import json
import os
import platform
import sys
import time
from . import tasks as T, world as W
from .agents import ARMS
from .score import score
from .session import Session
from .stats import wilson, paired


def run_one(arm_fn, task):
    s = Session(task)
    t0 = time.perf_counter()
    arm_fn(task, s)
    r = score(task, s)
    r["wall_ms"] = round((time.perf_counter() - t0) * 1000, 1)
    r["trace"] = [{"i": e["i"], "tool": e["tool"], "ok": e["ok"], "error": e["error"], "hash": e["hash"][:12]} for e in s.trace]
    return r, s


def _rate(rows, pred=lambda r: True, key="pass"):
    sel = [r for r in rows if pred(r)]
    return wilson(sum(1 for r in sel if r[key]), len(sel))


def summarise(rows):
    out = {"pass": _rate(rows), "correct": _rate(rows, key="correct"), "safe": _rate(rows, key="safe"),
           "partial": sum(r["partial"] for r in rows) / len(rows) if rows else None,
           "unsafe_runs": sum(1 for r in rows if not r["safe"]), "mean_calls": sum(r["calls"] for r in rows) / len(rows) if rows else None,
           "violations": {}}
    for r in rows:
        for v in r["violations"]:
            out["violations"][v["kind"]] = out["violations"].get(v["kind"], 0) + 1
    out["hard_violation_runs"] = sum(1 for r in rows if r.get("hard_cells"))
    specs, defects = sorted({r["spec"] for r in rows}), [d for d in W.DEFECTS + W.HARD_DEFECTS if any(r["defect"] == d for r in rows)]
    out["by_spec"] = {k: _rate(rows, lambda r, k=k: r["spec"] == k) for k in specs}
    out["by_defect"] = {k: _rate(rows, lambda r, k=k: r["defect"] == k) for k in defects}
    out["by_standard"] = {k: _rate(rows, lambda r, k=k: r["standard"] == (k == "standard")) for k in ("standard", "non_standard")}
    out["by_cell"] = {f"{sp}/{df}": _rate(rows, lambda r, sp=sp, df=df: r["spec"] == sp and r["defect"] == df) for sp in specs for df in defects}
    return out


def run_suite(name, tasklist, arm_keys, extra_rows=None):
    rows = {}
    for k in arm_keys:
        _, fn = ARMS[k]
        rows[k] = [run_one(fn, t)[0] for t in tasklist]
    for k, r in (extra_rows or {}).items():
        rows[k] = r
    arms = [{"key": k, "label": (ARMS[k][0] if k in ARMS else k), "kind": "fixture" if k.startswith("fx-") else ("scripted" if k in ARMS else "model"),
             "summary": summarise(rows[k]), "rows": rows[k]} for k in rows]
    ref = "d0" if "d0" in rows else next(iter(rows))
    pairs = [{"a": ref, "b": k, **paired([int(r["pass"]) for r in rows[ref]], [int(r["pass"]) for r in rows[k]])} for k in rows if k != ref]
    if "d1" in rows and "d0" in rows:
        pairs.append({"a": "d1", "b": "d0", **paired([int(r["pass"]) for r in rows["d1"]], [int(r["pass"]) for r in rows["d0"]])})
    return {"suite": name, "nTasks": len(tasklist), "arms": arms, "pairs": pairs,
            "tasks": [{"id": t.id, "spec": t.spec, "defect": t.defect, "inject": t.inject, "seed": t.seed, "world": W.digest(t.world)} for t in tasklist]}


def environment():
    import numpy, scipy, rasterio, shapely, pvlib
    return {"python": platform.python_version(), "numpy": numpy.__version__, "scipy": scipy.__version__, "rasterio": rasterio.__version__, "shapely": shapely.__version__, "pvlib": pvlib.__version__}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--suite", default="all", choices=["main", "injection", "hard", "all"])
    ap.add_argument("--arms", default=",".join(ARMS))
    ap.add_argument("--seeds", type=int, default=10, help="seeds for the main suite (120 tasks at 10)")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "results", "phase1-fixtures.json"))
    a = ap.parse_args(argv)
    keys = a.arms.split(",")
    suites = {}
    if a.suite in ("main", "all"):
        suites["main"] = run_suite("main", T.main_suite(range(a.seeds)), keys)
    if a.suite in ("injection", "all"):
        suites["injection"] = run_suite("injection", T.injection_suite(), keys)
    if a.suite in ("hard", "all"):
        suites["hard"] = run_suite("hard", T.hard_suite(), keys)
    doc = {"synthetic": True, "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "environment": environment(), "suites": suites,
           "note": "Fixture arms are scripted policies, not language models. No model has been run."}
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(doc, open(a.out, "w"))
    for sname, su in suites.items():
        print(f"\n{sname}: {su['nTasks']} tasks")
        for arm in su["arms"]:
            s = arm["summary"]
            print(f"  {arm['key']:12s} pass {s['pass']['k']:3d}/{s['pass']['n']} ({s['pass']['lo']:.2f}-{s['pass']['hi']:.2f})  partial {s['partial']:.2f}  unsafe {s['unsafe_runs']:3d}  calls {s['mean_calls']:.1f}")
    print("wrote", a.out)


if __name__ == "__main__":
    main()
