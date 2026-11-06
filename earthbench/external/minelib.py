"""External validation of the pit solver on a real MineLib instance.

MineLib (Espinoza, Goycoolea, Moreno and Newman 2013, Annals of Operations Research 206, 93-114) is the standard library of open-pit
problems. Newman1 is its smallest instance: 1,060 blocks and 3,922 precedence arcs. The reference is an independent solve with a
different method: Gurobi 13.0.0 on the LP formulation, recorded in AMPL's MineLib notebook (github.com/ampl/colab.ampl.com,
authors/eduardosalaz/minelib): objective 26,086,899.03 with 1,059 of 1,060 blocks in the pit. The instance files are copied from that
notebook's data folder (earthbench/external/data); the MineLib site itself was not reachable from the environment that built this.

This checks Scorcher's own min-cut solver (earthbench.mining.max_closure), the one the mining pack's key and tool use.

    python -m earthbench.external.minelib
"""
from __future__ import annotations
import json
import os
import sys
import time
import numpy as np

HERE = os.path.dirname(__file__)
REF_VALUE, REF_BLOCKS = 26_086_899.03, 1059


def load(name="newman1"):
    vals = []
    with open(os.path.join(HERE, "data", f"{name}.upit")) as f:
        on = False
        for ln in f:
            t = ln.split()
            if not t:
                continue
            if t[0] == "OBJECTIVE_FUNCTION:":
                on = True; continue
            if on and t[0] == "EOF":
                break
            if on and len(t) == 2:
                vals.append((int(t[0]), float(t[1])))
    v = np.zeros(len(vals)); [v.__setitem__(i, x) for i, x in vals]
    arcs = []
    with open(os.path.join(HERE, "data", f"{name}.prec")) as f:
        for ln in f:
            t = ln.split()
            if not t or t[0].startswith("%"):
                continue
            b, k = int(t[0]), int(t[1])
            arcs += [(b, int(x)) for x in t[2:2 + k]]
    return v, np.array(arcs, np.int64)


def run():
    from earthbench.mining import max_closure
    v, arcs = load()
    pit = max_closure(v * 100, arcs)                     # cents, so rounding to whole units costs nothing material
    value, blocks = float(v[pit].sum()), int(pit.sum())
    closed = bool(np.all(~pit[arcs[:, 0]] | pit[arcs[:, 1]]))
    return [("Newman1 optimum", abs(value - REF_VALUE) <= 1.0, f"Scorcher {value:,.2f} against Gurobi {REF_VALUE:,.2f} (difference {value - REF_VALUE:+.2f})"),
            ("Newman1 pit size", blocks == REF_BLOCKS, f"{blocks} blocks against {REF_BLOCKS}"),
            ("Newman1 pit is closed", closed, f"every one of {len(arcs):,} precedence arcs respected" if closed else "a precedence arc is violated")]


def main():
    res = run()
    for n, ok, d in res:
        print(f"{'pass' if ok else 'FAIL'}  {n}: {d}")
    ok = all(o for _, o, _ in res)
    out = os.path.join(HERE, "..", "results", "external", "minelib.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    json.dump({"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "pass": ok, "checks": [{"name": n, "pass": o, "detail": d} for n, o, d in res]}, open(out, "w"), indent=1)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
