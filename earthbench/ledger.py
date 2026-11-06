"""The results ledger: one line per model run, every line hash-chained to the one before, so the history of results cannot be
quietly edited. Over time it is the record of how each model did on each pack, and when.

Each entry holds the run's headline numbers and the SHA-256 of its results file and its records file, so anyone holding those files can
check them against the ledger. Private-suite entries carry only aggregates and the private set's commitment hash.

    python -m earthbench.ledger verify          # checks the chain and every file it names that is present
    python -m earthbench.ledger backfill        # adds results files not yet in the ledger (marked backfilled)
"""
from __future__ import annotations
import glob
import hashlib
import json
import os
import sys
import time

HERE = os.path.dirname(__file__)
RESULTS = os.path.join(HERE, "results")
LEDGER = os.path.join(RESULTS, "ledger.jsonl")
GENESIS = "0" * 64


def _sha(path):
    if not os.path.exists(path):
        return None
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def _hash(entry):
    body = {k: v for k, v in entry.items() if k != "hash"}
    return hashlib.sha256(json.dumps(body, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def read(path=LEDGER):
    return [json.loads(x) for x in open(path)] if os.path.exists(path) else []


def append(fields, path=LEDGER):
    rows = read(path)
    e = {"seq": len(rows), "prev": rows[-1]["hash"] if rows else GENESIS, "logged": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **fields}
    e["hash"] = _hash(e)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "a") as f:
        f.write(json.dumps(e, sort_keys=True) + "\n")
    return e


def entry_for(results_path, doc, records_path=None, backfilled=False, private_commitment=None):
    s = doc["summary"]
    rows = doc.get("rows", [])
    return {"pack": doc["pack"], "model": doc["model"], "suite": doc["suite"], "generated": doc["generated"], "repeats": doc.get("repeats", 1),
            "tasks": s["pass"]["n"], "passed": s["pass"]["k"], "unsafe": s.get("unsafe"), "usd": round(doc.get("usd", 0.0), 4),
            "correct": sum(1 for r in rows if r.get("correct")) if rows else doc.get("correct"),
            "results_file": os.path.relpath(results_path, HERE), "results_sha256": _sha(results_path),
            "records_file": os.path.relpath(records_path, HERE) if records_path else None, "records_sha256": _sha(records_path) if records_path else None,
            "private_commitment": private_commitment, "backfilled": backfilled}


def verify(path=LEDGER):
    prev, problems = GENESIS, []
    for i, e in enumerate(read(path)):
        if e["seq"] != i or e["prev"] != prev:
            problems.append(f"entry {i}: chain broken")
        if _hash(e) != e["hash"]:
            problems.append(f"entry {i}: contents changed")
        for k in ("results", "records"):
            f = e.get(f"{k}_file")
            if f and os.path.exists(os.path.join(HERE, f)) and _sha(os.path.join(HERE, f)) != e[f"{k}_sha256"]:
                problems.append(f"entry {i}: {f} differs from the file the ledger recorded")
        prev = e["hash"]
    return problems


def backfill():
    have = {e["results_file"] for e in read()}
    added = 0
    for f in sorted(glob.glob(os.path.join(RESULTS, "model-*.json")), key=lambda p: json.load(open(p)).get("generated", "")):
        rel = os.path.relpath(f, HERE)
        if rel in have:
            continue
        doc = json.load(open(f))
        rec = os.path.join(RESULTS, "records", os.path.basename(f)[:-5] + ".jsonl.gz")
        append(entry_for(f, doc, rec if os.path.exists(rec) else None, backfilled=True)); added += 1
    return added


def main(argv=None):
    a = (argv or sys.argv[1:]) or ["verify"]
    if a[0] == "backfill":
        print(f"added {backfill()} entries")
    p = verify()
    print("ledger:", f"{len(read())} entries, chain intact" if not p else "; ".join(p))
    return 0 if not p else 1


if __name__ == "__main__":
    sys.exit(main())
