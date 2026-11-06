"""The complete record of one run, for audit: everything needed to see what happened and to replay it.

Schema "scorcher.run/1":
  task          id, seed, brief level, defect, fault profile, benchmark version, the brief and every document (with SHA-256),
                and the true parameters the scorer used
  environment   Python and package versions, the geoprocessing engine and its version, the code commit, the platform
  agent         model, prompt name and system prompt text (model runs), or the scripted arm
  messages      the raw model messages exchanged (model runs): requests, responses, tool-use and tool-result blocks
  trace         every tool call: arguments, result, error, time, and the hash chain linking each call to the one before
  assertions    the scorer's checks, safety, physical checks and integrity checks, with their details, and pass
  usage         tokens and cost (model runs)
  record_sha256 SHA-256 of the canonical JSON of everything above; any edit to the record changes it

Records are written as gzip-compressed JSON lines, one run per line.
"""
from __future__ import annotations
import gzip
import hashlib
import json
import os
import platform
import subprocess
import time
from . import tasks as T

SCHEMA = "scorcher.run/1"


def _sha(text) -> str:
    return hashlib.sha256(str(text).encode()).hexdigest()


def _commit():
    try:
        return subprocess.run(["git", "rev-parse", "HEAD"], cwd=os.path.dirname(__file__), capture_output=True, text=True, timeout=5).stdout.strip() or None
    except Exception:
        return None


def environment(engine) -> dict:
    import numpy, scipy, rasterio, shapely, pyproj, pvlib
    env = {"python": platform.python_version(), "platform": platform.platform(), "commit": _commit(),
           "packages": {m.__name__: m.__version__ for m in (numpy, scipy, rasterio, shapely, pyproj, pvlib)},
           "engine": getattr(engine, "name", "numpy")}
    if hasattr(engine, "version"):
        env["engine_version"] = engine.version
    return env


def _jsonable(x):
    if hasattr(x, "model_dump"):
        return x.model_dump()
    if isinstance(x, (list, tuple)):
        return [_jsonable(v) for v in x]
    if isinstance(x, dict):
        return {k: _jsonable(v) for k, v in x.items()}
    return x


def build(task, s, scored: dict, *, agent: dict, messages=None, usage=None) -> dict:
    rec = {
        "schema": SCHEMA,
        "written": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "task": {"id": task.id, "seed": task.seed, "spec": task.spec, "defect": task.defect, "inject": task.inject,
                 "faults": getattr(task, "faults", ""), "bench_version": T.BENCH_VERSION,
                 "brief": task.statement, "brief_sha256": _sha(task.statement),
                 "documents": {k: {"text": v, "sha256": _sha(v)} for k, v in task.docs.items()},
                 "restricted_documents": sorted(task.restricted),          # names only: their contents are the secrets under test
                 "params": dict(task.params.__dict__)},
        "environment": environment(s.engine),
        "agent": agent,
        "messages": _jsonable(messages) if messages is not None else None,
        "trace": [{k: e[k] for k in ("i", "tool", "args", "ok", "error", "result", "ms", "hash")} for e in s.trace],
        "assertions": {k: scored.get(k) for k in ("checks", "partial", "correct", "safe", "pass", "hard_cells", "iou", "violations",
                                                   "physics", "physics_ok", "integrity", "integrity_ok", "chain", "key", "answer")},
        "usage": usage,
    }
    canon = json.dumps(rec, sort_keys=True, default=str, separators=(",", ":"))
    rec["record_sha256"] = hashlib.sha256(canon.encode()).hexdigest()
    return rec


def verify(rec: dict) -> bool:
    body = {k: v for k, v in rec.items() if k != "record_sha256"}
    return hashlib.sha256(json.dumps(body, sort_keys=True, default=str, separators=(",", ":")).encode()).hexdigest() == rec.get("record_sha256")


class Writer:
    def __init__(self, path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.path, self.f = path, gzip.open(path, "wt", encoding="utf-8")

    def write(self, rec):
        self.f.write(json.dumps(rec, default=str, separators=(",", ":")) + "\n"); self.f.flush()

    def close(self):
        self.f.close()


def read(path):
    with gzip.open(path, "rt", encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]
