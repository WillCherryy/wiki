"""Compare models on the same tasks, with intervals that respect how the tasks were made.

Tasks are not independent draws. Every task built from one seed shares a world (one deposit, one reservoir, one site), so a model that
misreads that world tends to fail all of its tasks together. A Wilson interval over tasks treats them as independent and is then too
narrow. Here the unit of resampling is the world: a cluster bootstrap (Davison and Hinkley 1997, on hierarchical data) resamples whole
(pack, kind, seed) clusters with replacement and recomputes the pass rate, or the paired difference between two models, each time.
Repeated runs of a task are averaged into that task's pass probability before clustering.

The paired comparison uses only tasks both models ran. It reports the difference in pass rate with its cluster-bootstrap interval, and
the exact McNemar test on the first run of each task (which assumes independent tasks, so read it beside the clustered interval).

    python -m earthbench.compare claude-haiku-5-5 claude-sonnet-5-5            # every pack both models ran
    python -m earthbench.compare claude-haiku-5-5 claude-sonnet-5-5 --pack welltest
    python -m earthbench.compare claude-haiku-5-5                              # one model: clustered intervals per pack
"""
from __future__ import annotations
import argparse
import glob
import json
import os
import re
import sys
import numpy as np

RESULTS = os.path.join(os.path.dirname(__file__), "results")
B = 10_000


def seed_of(task_id):
    m = re.search(r"-(\d{3,})(?:-|$)", task_id)
    return int(m.group(1)) if m else None


def load(model, packs=None):
    """Every public results file for a model, merged: one entry per (pack, task, repeat); a later file replaces an earlier one."""
    runs = {}
    files = sorted(glob.glob(os.path.join(RESULTS, f"model-*-{model}-*.json")), key=lambda f: json.load(open(f)).get("generated", ""))
    for f in files:
        d = json.load(open(f))
        if d.get("model") != model or (packs and d["pack"] not in packs) or d.get("suite") == "private":
            continue
        for r in d["rows"]:
            runs[(d["pack"], d["suite"], r["task"], r.get("repeat", 0))] = {"pack": d["pack"], "suite": d["suite"], "task": r["task"], "kind": r["kind"],
                                                                             "repeat": r.get("repeat", 0), "pass": bool(r["pass"]), "file": os.path.basename(f)}
    return list(runs.values())


def _current_ids(pack_name, suite):
    try:
        from .run import pack
        return {t.id for t in pack(pack_name).suite(suite)}
    except Exception:                               # engine not installed here: keep the rows
        return None


def current(runs):
    """Drop runs of tasks no longer in their suite (a retired pack, such as the original geothermal Horner tasks)."""
    ids = {}
    for r in runs:
        ids.setdefault((r["pack"], r["suite"]), None)
    for k in ids:
        ids[k] = _current_ids(*k)
    return [r for r in runs if ids[(r["pack"], r["suite"])] is None or r["task"] in ids[(r["pack"], r["suite"])]]


def by_task(runs):
    """{(pack, suite, task): (cluster, mean pass over repeats, pass on the first run, number of runs)}"""
    g = {}
    for r in runs:
        g.setdefault((r["pack"], r["suite"], r["task"]), []).append(r)
    out = {}
    for k, v in g.items():
        v.sort(key=lambda r: r["repeat"])
        out[k] = ((k[0], v[0]["kind"], seed_of(k[2])), float(np.mean([r["pass"] for r in v])), v[0]["pass"], len(v))
    return out


def cluster_bootstrap(clusters, stat, b=B, seed=0):
    """clusters: list of per-cluster arrays (or tuples of arrays). stat maps a list of clusters to a number. Returns the 2.5 and 97.5
    percentiles of stat over b resamples of whole clusters, and the bootstrap standard error."""
    rng = np.random.default_rng(seed)
    n = len(clusters)
    vals = np.array([stat([clusters[i] for i in rng.integers(0, n, n)]) for _ in range(b)])
    return float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5)), float(vals.std(ddof=1))


def _mean_of(cl):
    x = np.concatenate([c for c in cl]); return float(x.mean())


def summary(model, packs=None):
    t = by_task(current(load(model, packs)))
    if not t:
        return None
    cl = {}
    for c, p, _, _ in t.values():
        cl.setdefault(c, []).append(p)
    arrs = [np.array(v) for v in cl.values()]
    p = float(np.mean([x for _, x, _, _ in t.values()]))
    n = len(t)
    lo, hi, se = cluster_bootstrap(arrs, _mean_of)
    iid = (p * (1 - p) / n) ** 0.5 if n else 0.0
    return {"model": model, "tasks": n, "worlds": len(cl), "runs": sum(r for *_, r in t.values()), "pass": p, "lo": lo, "hi": hi,
            "se_clustered": se, "se_iid": iid, "design_effect": (se / iid) ** 2 if iid else None}


def compare(a, b, packs=None):
    ta, tb = by_task(current(load(a, packs))), by_task(current(load(b, packs)))
    both = sorted(set(ta) & set(tb))
    if not both:
        return {"a": a, "b": b, "tasks": 0, "note": "no task was run by both models"}
    cl = {}
    for k in both:
        cl.setdefault(ta[k][0], []).append((ta[k][1], tb[k][1]))
    arrs = [np.array(v) for v in cl.values()]
    diff = lambda cs: float(np.concatenate(cs)[:, 1].mean() - np.concatenate(cs)[:, 0].mean())
    lo, hi, se = cluster_bootstrap(arrs, diff)
    from gisbench.stats import paired
    mc = paired([int(ta[k][2]) for k in both], [int(tb[k][2]) for k in both])
    per_pack = {}
    for k in both:
        per_pack.setdefault(k[0], [0, 0, 0]); per_pack[k[0]][0] += 1; per_pack[k[0]][1] += ta[k][1]; per_pack[k[0]][2] += tb[k][1]
    return {"a": a, "b": b, "tasks": len(both), "worlds": len(cl), "pass_a": float(np.mean([ta[k][1] for k in both])), "pass_b": float(np.mean([tb[k][1] for k in both])),
            "diff_b_minus_a": diff(arrs), "lo": lo, "hi": hi, "separates": bool(lo > 0 or hi < 0),
            "mcnemar_first_run": {"only_a": mc["only_a"], "only_b": mc["only_b"], "p": mc["mcnemar_p"]},
            "by_pack": {p: {"tasks": n, "pass_a": x / n, "pass_b": y / n} for p, (n, x, y) in sorted(per_pack.items())}}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("models", nargs="+")
    ap.add_argument("--pack", action="append", help="limit to a pack (repeatable)")
    a = ap.parse_args(argv)
    pc = lambda x: f"{x * 100:.0f}%"
    out = {"summaries": [], "comparison": None}
    for m in a.models:
        s = summary(m, a.pack)
        if not s:
            print(f"{m}: no public results"); continue
        out["summaries"].append(s)
        print(f"{m}: {pc(s['pass'])} pass over {s['tasks']} tasks in {s['worlds']} worlds ({s['runs']} runs); 95% cluster-bootstrap interval "
              f"{pc(s['lo'])} to {pc(s['hi'])}; design effect {s['design_effect']:.2f}" if s["design_effect"] else "")
    if len(a.models) == 2:
        c = compare(*a.models, a.pack); out["comparison"] = c
        if c["tasks"]:
            print(f"\npaired, {c['tasks']} tasks both ran ({c['worlds']} worlds): {a.models[1]} minus {a.models[0]} = {c['diff_b_minus_a'] * 100:+.1f} points, "
                  f"95% interval {c['lo'] * 100:+.1f} to {c['hi'] * 100:+.1f}: {'the benchmark separates them' if c['separates'] else 'not separated at this sample size'}")
            m = c["mcnemar_first_run"]; print(f"McNemar on first runs: {m['only_a']} pass only for {a.models[0]}, {m['only_b']} only for {a.models[1]}, p = {m['p']:.3g}")
            for p, v in c["by_pack"].items():
                print(f"  {p:11} {v['tasks']:3} tasks  {pc(v['pass_a'])} against {pc(v['pass_b'])}")
        else:
            print(c["note"])
        path = os.path.join(RESULTS, f"compare-{a.models[0]}-vs-{a.models[1]}.json")
        json.dump(out, open(path, "w"), indent=1); print("wrote", os.path.relpath(path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
