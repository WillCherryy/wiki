"""Private held-out suites: the tasks nobody can train on.

A public benchmark leaks. Once its tasks are on the internet, a model can be tuned to them, and its score stops meaning anything. So
each pack also has a private suite: the same grid of briefs and data defects as the main suite, built from seeds that are derived from a
secret only the owner holds. The tasks are never published.

To prove the set existed, unchanged, on a date, without revealing it, a commitment is published instead: SHA-256 over every private
task's id, brief, documents and data, plus the hash of the secret. Revealing the secret later lets anyone rebuild the set and check
both hashes. The commitment file is safe to commit; the secret and private results never are.

    python -m earthbench.private init                 # once, on the owner's machine: writes the secret to ~/.scorcher/private_secret
    python -m earthbench.private commit               # writes earthbench/private/commitment.json (safe to publish)
    python -m earthbench.private verify               # rebuilds every private suite and checks it against the commitment
    python -m earthbench.run --model ... --pack welltest --suite private --yes     # results go to earthbench/results/private/ (git-ignored)

The secret can also come from the environment variable SCORCHER_PRIVATE_SECRET.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import secrets
import stat
import sys
import time

HERE = os.path.dirname(__file__)
SECRET_FILE = os.path.join(os.path.expanduser("~"), ".scorcher", "private_secret")
COMMITMENT = os.path.join(HERE, "private", "commitment.json")
PUBLIC_SEEDS = set(range(0, 100))               # seeds the public suites use: private seeds never collide with them


class NoSecret(RuntimeError):
    pass


def load_secret(required=True):
    s = os.environ.get("SCORCHER_PRIVATE_SECRET")
    if not s and os.path.exists(SECRET_FILE):
        s = open(SECRET_FILE).read().strip()
    if not s and required:
        raise NoSecret("no private secret: run `python -m earthbench.private init` on the owner's machine, or set SCORCHER_PRIVATE_SECRET")
    return s


def seeds(secret, pack, n=2):
    """n seeds for a pack, derived from the secret; distinct from every public seed."""
    out, i = [], 0
    while len(out) < n:
        x = int.from_bytes(hashlib.sha256(f"{secret}|{pack}|{i}".encode()).digest()[:8], "big") % 900_000 + 100_000
        if x not in PUBLIC_SEEDS and x not in out:
            out.append(x)
        i += 1
    return out


def suite(P, secret, pack_name):
    """The main suite's grid of kinds, briefs and defects, rebuilt on private seeds."""
    grid = sorted({(t.kind, t.spec, t.defect) for t in P.suite("main")}, key=lambda g: (P.KINDS.index(g[0]), P.SPECS.index(g[1]), P.DEFECTS.index(g[2])))
    return [P.make_task(s, k, sp, df) for s in seeds(secret, pack_name) for k, sp, df in grid]


def task_digest(t):
    from .core import digest
    h = hashlib.sha256()
    for part in (t.id, t.statement, digest(t.docs), digest(t.data)):
        h.update(part.encode()); h.update(b"\x00")
    return h.hexdigest()


def suite_digest(tasks):
    h = hashlib.sha256()
    for d in sorted(task_digest(t) for t in tasks):
        h.update(d.encode())
    return h.hexdigest()


def _packs():
    from .run import PACKS, pack
    out = {}
    for name in PACKS:
        try:
            out[name] = pack(name)
        except ImportError as e:                # a pack whose engine is not installed here (hazard needs OpenQuake)
            print(f"skipping {name}: {e}", file=sys.stderr)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("action", choices=["init", "commit", "verify"])
    a = ap.parse_args(argv)
    if a.action == "init":
        if load_secret(required=False):
            print("a private secret already exists; not replacing it (delete it by hand only if you mean to start a new private set)"); return 0
        os.makedirs(os.path.dirname(SECRET_FILE), exist_ok=True)
        with open(SECRET_FILE, "w") as f:
            f.write(secrets.token_hex(32))
        try:
            os.chmod(SECRET_FILE, stat.S_IRUSR | stat.S_IWUSR)
        except OSError:
            pass
        print(f"wrote a new secret to {SECRET_FILE}. Back it up somewhere safe and private: without it the private set cannot be rebuilt or revealed.")
        return 0
    secret = load_secret()
    packs = _packs()
    current = {name: {"tasks": len(ts), "sha256": suite_digest(ts)} for name, P in packs.items() for ts in [suite(P, secret, name)]}
    if a.action == "commit":
        old = json.load(open(COMMITMENT)) if os.path.exists(COMMITMENT) else {"packs": {}}
        doc = {"schema": "scorcher.private-commitment/1", "written": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
               "secret_sha256": hashlib.sha256(secret.encode()).hexdigest(), "packs": {**old.get("packs", {}), **current},
               "how_to_check": "Reveal the secret; rebuild with python -m earthbench.private verify; both hashes must match."}
        os.makedirs(os.path.dirname(COMMITMENT), exist_ok=True)
        json.dump(doc, open(COMMITMENT, "w"), indent=1)
        print(f"wrote {os.path.relpath(COMMITMENT)}: {sum(v['tasks'] for v in current.values())} private tasks over {len(current)} packs. Commit and push this file.")
        return 0
    doc = json.load(open(COMMITMENT))
    ok = doc["secret_sha256"] == hashlib.sha256(secret.encode()).hexdigest()
    print("secret:", "matches" if ok else "DOES NOT MATCH the commitment")
    for name, v in current.items():
        c = doc["packs"].get(name)
        m = c is not None and c["sha256"] == v["sha256"]
        ok &= m
        print(f"{name:11} {v['tasks']:4} tasks  {'matches' if m else 'not committed' if c is None else 'CHANGED since the commitment'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
