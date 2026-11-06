"""Model Context Protocol server: put any MCP-capable agent into any Scorcher benchmark task.

    python3 -m earthbench.mcp_server --list                                  # every task id, by pack
    python3 -m earthbench.mcp_server --task MIN-pit-L2-dupes-001             # serve one task over stdio
    python3 -m earthbench.mcp_server --task S2-crs-003                       # gisbench tasks too

Register the second command as a stdio MCP server in the agent's client (Claude Desktop, Claude Code, Cursor or any framework with an
MCP client). The agent sees exactly the task's tools and nothing else; the brief is the `task_get` tool and the `brief` prompt.
When the client disconnects, the run is scored (correctness, safety, key-free physics, integrity) and a record is written to
earthbench/results/mcp/<task>-<time>.json, with a one-line verdict on stderr. Protocol: JSON-RPC 2.0, one message per line.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import sys
import time
from .run import PACKS, pack

PROTOCOL = "2025-06-18"
OUT = os.path.join(os.path.dirname(__file__), "results", "mcp")


class Target:
    """A session and its scorer, for an earthbench pack task or a gisbench task."""

    def __init__(self, task_id):
        for name in PACKS:
            P = pack(name)
            for su in P.SUITES:
                for t in P.suite(su):
                    if t.id == task_id:
                        self.kind, self.P, self.t = "earth", P, t
                        self.s = P.SESSION(t)
                        self.specs = self.s.specs
                        self.brief = t.statement
                        return
        from gisbench import tasks as GT
        for t in GT.main_suite() + GT.injection_suite() + GT.hard_suite() + GT.stress_suite():
            if t.id == task_id:
                from gisbench.session import Session, TOOL_SPECS
                self.kind, self.t, self.s = "gis", t, Session(t)
                self.specs, self.brief = TOOL_SPECS, t.statement
                return
        raise SystemExit(f"no task {task_id}; use --list")

    def call(self, name, args):
        return self.s.call(name, args)

    def score(self):
        if self.kind == "gis":
            from gisbench.score import score
            return score(self.t, self.s)
        from .core import score
        k = self.P.key(self.t)
        return score(self.t, self.s, k, self.P.checks(self.t, self.s, k) if self.s.answer else {}, self.P.physics(self.t, self.s) if self.s.answer else {})


def list_tasks():
    out = {}
    for name in PACKS:
        P = pack(name)
        out[name] = {su: [t.id for t in P.suite(su)] for su in P.SUITES}
    from gisbench import tasks as GT
    out["gis"] = {"main": [t.id for t in GT.main_suite()], "injection": [t.id for t in GT.injection_suite()], "hard": [t.id for t in GT.hard_suite()], "stress": [t.id for t in GT.stress_suite()]}
    return out


def serve(task_id, rfile=sys.stdin, wfile=sys.stdout, out_dir=OUT):
    T = Target(task_id)
    started = time.time()
    send = lambda o: (wfile.write(json.dumps(o, default=str) + "\n"), wfile.flush())
    for line in rfile:
        if not line.strip():
            continue
        try:
            m = json.loads(line)
        except json.JSONDecodeError:
            send({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "parse error"}}); continue
        mid, method, p = m.get("id"), m.get("method"), m.get("params") or {}
        if mid is None:                              # a notification: nothing to answer
            continue
        if method == "initialize":
            res = {"protocolVersion": PROTOCOL, "capabilities": {"tools": {}, "prompts": {}},
                   "serverInfo": {"name": "scorcher-benchmark", "version": "1.0"}, "instructions": "Work the task with these tools; call submit_answer once."}
        elif method == "ping":
            res = {}
        elif method == "tools/list":
            res = {"tools": [{"name": n, "description": v["description"], "inputSchema": v["input_schema"]} for n, v in T.specs.items()]}
        elif method == "tools/call":
            ok, out = T.call(p.get("name", ""), p.get("arguments") or {})
            res = {"content": [{"type": "text", "text": json.dumps(out, default=str)}], "isError": not ok}
        elif method == "prompts/list":
            res = {"prompts": [{"name": "brief", "description": "The task brief"}]}
        elif method == "prompts/get":
            res = {"messages": [{"role": "user", "content": {"type": "text", "text": T.brief}}]}
        else:
            send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"method not found: {method}"}}); continue
        send({"jsonrpc": "2.0", "id": mid, "result": res})
    r = T.score()
    os.makedirs(out_dir, exist_ok=True)
    rec = {"schema": "scorcher.mcp-run/1", "task": task_id, "started": started, "ended": time.time(), "score": {k: v for k, v in r.items() if k not in ("trace",)},
           "trace": [{k: e[k] for k in ("i", "tool", "args", "ok", "error", "result", "hash")} for e in T.s.trace]}
    rec["record_sha256"] = hashlib.sha256(json.dumps(rec, sort_keys=True, default=str, separators=(",", ":")).encode()).hexdigest()
    path = os.path.join(out_dir, f"{task_id}-{time.strftime('%Y%m%dT%H%M%S')}.json")
    json.dump(rec, open(path, "w"), default=str)
    sys.stderr.write(f"scorcher: {task_id}: pass={r['pass']} safe={r['safe']} physics={'ok' if r.get('physics_ok', True) else 'FLAG'} calls={r['calls']} -> {path}\n")
    return r, path


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--task")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args(argv)
    if a.list:
        print(json.dumps(list_tasks(), indent=1)); return 0
    if not a.task:
        ap.error("--task or --list")
    serve(a.task)
    return 0


if __name__ == "__main__":
    sys.exit(main())
