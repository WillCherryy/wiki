"""Reliability over repeated runs: pass@k, pass^k, trajectory drift and error signatures.

pass@k   probability that at least one of k attempts passes   (an unbiased estimate from n attempts with c passes:
         1 - C(n-c, k) / C(n, k); Chen et al. 2021, the HumanEval paper). Right when a person reviews and picks.
pass^k   probability that all k attempts pass                   (unbiased: C(c, k) / C(n, k); the tau-bench paper's
         reliability measure). Right for agents that run unattended: what industry should buy on.
drift    how differently the agent works on repeats of the same task: the mean normalised edit distance between the
         sequences of tool names (0 identical, 1 nothing in common), and the share of repeat pairs whose tool arguments
         differ. Reported separately for task repeats that all passed, where drift means the same answer by different routes.
errors   error signatures: each refused or failed call's message with layer names, numbers and quoted values replaced by
         placeholders, so the same failure groups together across tasks, runs and models.
"""
from __future__ import annotations
import itertools
import json
import re
from collections import Counter, defaultdict
from math import comb


def pass_at_k(n: int, c: int, k: int) -> float:
    if k > n:
        raise ValueError("k must not exceed n")
    return 1.0 - comb(n - c, k) / comb(n, k)


def pass_hat_k(n: int, c: int, k: int) -> float:
    if k > n:
        raise ValueError("k must not exceed n")
    return comb(c, k) / comb(n, k)


def edit_distance(a, b) -> int:
    prev = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        cur = [i]
        for j, y in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (x != y)))
        prev = cur
    return prev[-1]


def _norm_dist(a, b):
    return edit_distance(a, b) / max(len(a), len(b), 1)


_SIG = [(re.compile(r"'[^']*'|\"[^\"]*\""), "<q>"), (re.compile(r"-?\d+(\.\d+)?(e-?\d+)?"), "<n>"),
        (re.compile(r"\b(no such (layer|file)): \S+"), r"\1: <name>"), (re.compile(r"\b[a-z][a-z0-9_]*_[a-z0-9_]+\b"), "<name>")]


def signature(tool: str, error: str) -> str:
    s = str(error)
    for rx, rep in _SIG:
        s = rx.sub(rep, s)
    return f"{tool}: {s.strip()[:160]}"


def summarise(rows, ks=(1, 2, 3)) -> dict:
    """rows: result rows, each with task, pass and trace (tool, args, ok, error); repeats share a task id."""
    by = defaultdict(list)
    for r in rows:
        by[r["task"]].append(r)
    n_rep = min(len(v) for v in by.values()) if by else 0
    out = {"tasks": len(by), "repeats": n_rep}
    if n_rep >= 1:
        out["pass_at_k"], out["pass_hat_k"] = {}, {}
        for k in ks:
            if k <= n_rep:
                out["pass_at_k"][k] = sum(pass_at_k(len(v), sum(bool(r["pass"]) for r in v), k) for v in by.values()) / len(by)
                out["pass_hat_k"][k] = sum(pass_hat_k(len(v), sum(bool(r["pass"]) for r in v), k) for v in by.values()) / len(by)
    if n_rep >= 2:
        d_all, d_ok, a_all, a_ok = [], [], [], []
        for v in by.values():
            seqs = [[e["tool"] for e in r.get("trace", [])] for r in v]
            args = [json.dumps([[e["tool"], e.get("args")] for e in r.get("trace", [])], sort_keys=True, default=str) for r in v]
            allpass = all(r["pass"] for r in v)
            for (s1, g1), (s2, g2) in itertools.combinations(zip(seqs, args), 2):
                d, a = _norm_dist(s1, s2), g1 != g2
                d_all.append(d); a_all.append(a)
                if allpass:
                    d_ok.append(d); a_ok.append(a)
        mean = lambda x: sum(x) / len(x) if x else None
        out["drift"] = {"tool_sequence": mean(d_all), "tool_sequence_when_all_passed": mean(d_ok),
                        "arguments_differ": mean(a_all), "arguments_differ_when_all_passed": mean(a_ok),
                        "identical_routes": sum(1 for v in by.values() if len({tuple(e["tool"] for e in r.get("trace", [])) for r in v}) == 1)}
    sig = Counter(signature(e["tool"], e["error"]) for r in rows for e in r.get("trace", []) if not e.get("ok") and e.get("error"))
    out["error_signatures"] = [{"signature": s, "count": c} for s, c in sig.most_common(25)]
    return out
