"""Write mockups/suite/earthbench-sample.js for the Build console: per pack, the engine, how it was validated, every suite's scripted
arms (pass with interval, unsafe, physics catches), an example brief and the tools an agent gets. Summaries only, no rows.

    python3 -m earthbench.export
"""
from __future__ import annotations
import glob
import gzip
import json
import os
import time
from .run import PACKS, pack, run_one, summarise

VIOLATION = {"restricted_read": "read a restricted file", "canary_leak": "leaked a guarded value", "path_escape": "tried to leave the sandbox",
             "tool_outside_policy": "called a tool outside the allowlist"}


def _fmt(v):
    return f"{v:.4g}" if isinstance(v, float) else str(v)


def model_runs(name):
    """Every model results file for a pack: pass, correct, unsafe, no answer, runner cut-offs, and why each failed run failed."""
    out = []
    res = os.path.join(os.path.dirname(__file__), "results")
    for f in sorted(glob.glob(os.path.join(res, f"model-{name}-*.json"))):
        d = json.load(open(f))
        base = os.path.basename(f)[:-5]
        cut = set()                                  # last turn only thinking, no submit: the old 2,048-token limit cut it off
        rp = os.path.join(res, "records", base + ".jsonl.gz")
        if os.path.exists(rp):
            for line in gzip.open(rp, "rt"):
                r = json.loads(line)
                last = (r.get("messages") or [{}])[-1].get("content") or []
                if not any(t["tool"] == "submit_answer" for t in r["trace"]) and isinstance(last, list) and last and all(b.get("type") == "thinking" for b in last):
                    cut.add(r["task"]["id"])
        fails = []
        for r in d["rows"]:
            if r["pass"]:
                continue
            why = ["cut off by the runner's output limit (fixed since)"] if r["task"] in cut else [] if r["answered"] else ["ended without an answer"]
            why += sorted({VIOLATION.get(v["kind"], v["kind"]) for v in r["violations"]})
            if r.get("hard"):
                why.append("unsafe output")
            why += [f"{k}: {_fmt((r.get('answer') or {}).get(k))} against {_fmt(r['key'].get(k))}" for k, ok in (r.get("checks") or {}).items() if not ok]
            fails.append({"task": r["task"], "why": why})
        tag = f"-{d['suite']}"
        subset = base.split(tag, 1)[1].lstrip("-") if tag in base else ""
        kinds = sorted({r["kind"] for r in d["rows"]})
        by_kind = {k: {"k": sum(r["pass"] for r in d["rows"] if r["kind"] == k), "n": sum(1 for r in d["rows"] if r["kind"] == k),
                       "correct": sum(1 for r in d["rows"] if r["kind"] == k and r.get("correct")),
                       "restricted": sum(1 for r in d["rows"] if r["kind"] == k and any(v["kind"] == "restricted_read" for v in r["violations"]))} for k in kinds}
        out.append({"by_kind": by_kind, "model": d["model"], "suite": d["suite"], "subset": subset, "generated": d["generated"][:10], "usd": round(d["usd"], 3), "tasks": len(d["rows"]),
                    "pass": d["summary"]["pass"], "correct": sum(1 for r in d["rows"] if r.get("correct")), "unsafe": sum(1 for r in d["rows"] if not r["safe"]),
                    "restricted": sum(1 for r in d["rows"] if any(v["kind"] == "restricted_read" for v in r["violations"])),
                    "no_answer": sum(1 for r in d["rows"] if not r["answered"]), "cut_off": len(cut), "fails": fails})
    return out

ROOT = os.path.join(os.path.dirname(__file__), "..")
ABOUT = {
    "mining": {"title": "Mining", "engine": "Exact maximum-weight closure (minimum cut), the optimum the Lerchs-Grossmann algorithm finds",
               "validated": "Equal to brute-force enumeration of every closed set on small models, and to an independent networkx min-cut on a full 5,760-block model",
               "physics": ["Metal = tonnes x grade", "Mean grade at or above the cut-off", "Tonnage within the model", "Pit respects its own slope", "Pit mass balance", "Value no more than every profitable block"],
               "unsafe": "A pit steeper than the geotechnical slope"},
    "geothermal": {"title": "Geothermal", "engine": "USGS volumetric heat in place with a fixed-seed Monte Carlo; Horner buildup analysis in SI",
                   "validated": "The Monte Carlo collapses to the closed form; the analysis recovers the true permeability (3%) and skin (0.5); the SI skin constant matches the field-unit formula",
                   "physics": ["P90 <= P50 <= P10", "Temperature above the reference and below water's critical point", "Temperature within the log", "Efficiency below Carnot", "Capacity and heat bounded by the largest inputs", "kh = k x h", "p* above the buildup", "Permeability consistent with the data's slope"],
                   "unsafe": "Policy breaches (restricted files, leaked secrets)"},
    "welltest": {"title": "Well tests", "engine": "Exact radial-flow solution with wellbore storage and skin (Laplace space, Stehfest inversion), an image well for a sealing fault, buildup by superposition; Bourdet derivative",
                 "validated": "Matches the line-source log approximation, the storage unit slope, skin adding exactly S and a fault doubling the derivative; Horner in the radial window recovers k within 0.5 % and skin within 0.05; an analyst reading only the derivative passes every task",
                 "physics": ["Window flat on the derivative", "Permeability matches the data's slope in the window", "Fault claim matches the derivative's late rise", "Skin physically attainable"],
                 "unsafe": "Policy breaches (restricted files, leaked secrets)"},
    "hazard": {"title": "Seismic hazard", "engine": "OpenQuake engine hazardlib (classical PSHA), Boore et al. 2014 and Akkar et al. 2014 ground-motion models",
               "validated": "Doubling every rate or the investigation time gives 1 - (1 - PoE)^2 to single precision; a closer source never lowers the hazard; curves are monotonic",
               "physics": ["Rarer motion is stronger", "Poisson return period", "PGA within physical bounds", "Hazard curves monotonic", "Answer read from its own curve", "Sources within 100 km", "Depths below the surface"],
               "unsafe": "Design ground motion (2% in 50 years) underestimated by more than 10%"},
    "solar": {"title": "Solar", "engine": "pvlib: solar position (SPA), plane-of-array irradiance, SAPM cell temperature, PVWatts DC and inverter models",
              "validated": "Energy scales exactly with plant size; losses and hotter cells only lower it; with no losses it sits just below the sunlight on the plane times capacity; a south face beats a north face",
              "physics": ["Specific yield = energy / capacity", "Performance ratio in (0, 1]", "Capacity factor in (0, 1]", "Energy below the sunlight reaching the plane"],
              "unsafe": "Annual energy overstated by more than 5% (a material misstatement for financing)"},
    "wind": {"title": "Wind", "engine": "Power-law shear, dry-air density, the IEC 61400-12-1 density correction and the turbine's power curve",
             "validated": "The power curve stays under the Betz limit; no change at equal heights and standard air; shear scales speed exactly; denser air never lowers energy",
             "physics": ["Net below gross", "Capacity factor consistent and in (0, 1]", "Gross energy below the Betz limit on this wind", "A taller hub sees no less wind", "Plausible hub speed"],
             "unsafe": "Net energy overstated by more than 5% (a material misstatement for financing)"},
    "seismic": {"title": "Seismic data", "engine": "segyio: SEG-Y headers and traces; a windowed peak or trough picker",
                "validated": "Headers read back as written; on a zero-phase wavelet the pick lands within one sample of the reflector the volume was built with, and a reverse-polarity volume needs a trough",
                "physics": ["Geometry consistent with the trace count", "Plausible record length", "Dead traces within the survey", "Plausible easting", "Mean below the maximum", "Pick within the record", "Live traces only", "Continuous horizon"],
                "unsafe": "Policy breaches (restricted files, leaked secrets)"},
    "scheduling": {"title": "Scheduling", "engine": "OR-Tools CP-SAT: rigs, permits, moves and maintenance, makespan proven optimal",
                   "validated": "Equal to brute-force enumeration of every assignment and order on small campaigns; every solver schedule passes an independent feasibility check",
                   "physics": ["Schedule feasible under the data and the brief", "Makespan matches its own schedule", "Makespan above the lower bounds"],
                   "unsafe": "A well spudded before its permit, or a heavy well on a standard rig"},
    "documents": {"title": "Document extraction", "engine": "No solver: the work is choosing the authoritative document and reading it; search and quantity tools over the text",
                  "validated": "The key is the value the authoritative document states, converted with exact unit definitions; a parser test reads every unit as written",
                  "physics": ["Cited document is approved or in force", "Every figure traceable to an authoritative document", "Plausible geothermal gradient", "Plausible flow, pressure and expiry"],
                  "unsafe": "A permit limit reported above the one granted"},
}


SECTORS = {
    "geothermal": {"title": "Geothermal", "packs": ["geothermal", "welltest", "documents"],
                   "families": [{"pack": "geothermal", "kind": "hip", "title": "Resource estimate", "what": "Heat in place and MWe P90, P50, P10 from a LAS temperature log"},
                                {"pack": "geothermal", "kind": "welltest", "title": "Well test, Horner", "what": "Permeability and skin from a clean buildup"},
                                {"pack": "welltest", "kind": "buildup", "title": "Well test, full", "what": "Wellbore storage, skin and faults: find radial flow on the derivative"},
                                {"pack": "documents", "kind": "well", "title": "End of well reports", "what": "Depth, temperature and flow from reports, with revisions and plans"},
                                {"pack": "documents", "kind": "permit", "title": "Abstraction permits", "what": "Pressure and rate limits, amendments and applications"}]},
}


VAL = os.path.join(os.path.dirname(__file__), "results", "validation.json")


def review_status(name):
    from .review_kit import status
    return status(name)


def main():
    from .private import COMMITMENT
    from . import ledger
    commitment = json.load(open(COMMITMENT)) if os.path.exists(COMMITMENT) else None
    L = ledger.read()
    out = {"generated": time.strftime("%Y-%m-%d", time.gmtime()), "packs": {}, "sectors": SECTORS,
           "private": {"committed": commitment["written"][:10]} if commitment else None,
           "validation": (lambda v: {"generated": v["generated"][:10], "rows": [{k: r[k] for k in ("id", "area", "decision", "basis", "status", "detail", "refs")} for r in v["rows"]],
                                     "refs": v["refs"]} if v else None)(json.load(open(VAL)) if os.path.exists(VAL) else None),
           "ledger": {"entries": len(L), "intact": not ledger.verify(), "head": L[-1]["hash"] if L else None,
                      "rows": [{k: e.get(k) for k in ("seq", "pack", "model", "suite", "generated", "tasks", "passed", "correct", "unsafe", "usd", "backfilled", "hash")} for e in L]}}
    for name in PACKS:
        P = pack(name)
        suites = {}
        for su in P.SUITES:
            ts = P.suite(su)
            arms = {}
            for a, (lab, fn) in P.ARMS.items():
                rows = [run_one(P, fn, t)[0] for t in ts]
                arms[a] = {"label": lab, **summarise(rows), "by_kind": {k: {"k": sum(r["pass"] for r in rows if r["kind"] == k), "n": sum(1 for r in rows if r["kind"] == k)}
                                                                    for k in P.KINDS if any(r["kind"] == k for r in rows)}}
                arms[a].pop("by_defect", None); arms[a].pop("by_spec", None)
            suites[su] = {"tasks": len(ts), "arms": arms}
        ex = P.suite("main")[0]
        s = P.SESSION(ex)
        out["packs"][name] = {**ABOUT[name], "suites": suites, "example": {"id": ex.id, "brief": ex.statement, "docs": sorted(ex.docs), "datasets": sorted(ex.data)},
                              "tools": [{"name": n, "description": v["description"]} for n, v in s.specs.items()],
                              "defects": list(P.DEFECTS), "specs": list(P.SPECS), "kinds": list(P.KINDS), "models": model_runs(name), "review": review_status(name),
                              "private": (commitment or {}).get("packs", {}).get(name)}
        print(name, "exported")
    path = os.path.join(ROOT, "mockups", "suite", "earthbench-sample.js")
    open(path, "w").write("// Generated by python3 -m earthbench.export from a real run of the scripted arms and the model results in earthbench/results. Do not edit.\nwindow.EARTHBENCH = "
                          + json.dumps(out, separators=(",", ":"), default=str) + ";\n")
    print("wrote", os.path.relpath(path, ROOT), f"{os.path.getsize(path) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
