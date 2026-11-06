"""The model runner, end to end, with a stand-in client: it plays the analyst pipeline's tool calls as tool-use messages."""
import gzip
import hashlib
import json
import os
import sys
import tempfile
import types
import unittest
from unittest import mock
from earthbench import run as R, mining as M


class _Block:
    def __init__(self, **kw):
        self.__dict__.update(kw)

    def model_dump(self):
        return dict(self.__dict__)


class _Client:
    """Replays the d1 recipe for the task in the first user message, one tool call per response."""
    def __init__(self, *a, **k):
        self.messages = self
        self.plan = None

    def create(self, model, max_tokens, system, tools, messages):
        if len(messages) == 1:                     # a new task: plan it afresh
            t = next(x for x in M.suite("main") if x.statement == messages[0]["content"])
            calls = []

            class Rec:
                answer = None
                def call(_, tool, args=None):
                    calls.append((tool, args or {}))
                    s = M.SESSION(t); [s.call(c, a) for c, a in calls[:-1]]
                    return s.call(tool, args)
                def __getattr__(_, k):
                    return getattr(M.SESSION(t), k)
            M.recipe(t, Rec(), t.truth, robust=False)
            self.plan = calls
        n = sum(1 for m in messages if m["role"] == "assistant")
        usage = types.SimpleNamespace(input_tokens=1000, output_tokens=100)
        if n < len(self.plan):
            tool, args = self.plan[n]
            return types.SimpleNamespace(content=[_Block(type="tool_use", id=f"t{n}", name=tool, input=args)], usage=usage)
        return types.SimpleNamespace(content=[_Block(type="text", text="done")], usage=usage)


class Runner(unittest.TestCase):
    def test_model_run_scores_and_records(self):
        fake = types.ModuleType("anthropic"); fake.Anthropic = _Client
        with tempfile.TemporaryDirectory() as d, mock.patch.dict(sys.modules, {"anthropic": fake}), mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "test-not-a-key"}), \
                mock.patch.object(R, "RESULTS", d):
            rc = R.main(["--model", "claude-haiku-5-5", "--pack", "mining", "--suite", "main", "--limit", "2", "--yes"])
            self.assertEqual(rc, 0)
            out = json.load(open(os.path.join(d, "model-mining-claude-haiku-5-5-main.json")))
            self.assertEqual(out["summary"]["pass"]["k"], 2)
            recs = [json.loads(x) for x in gzip.open(os.path.join(d, "records", "model-mining-claude-haiku-5-5-main.jsonl.gz"), "rt")]
            self.assertEqual(len(recs), 2)
            for rec in recs:
                body = {k: v for k, v in rec.items() if k != "record_sha256"}
                self.assertEqual(hashlib.sha256(json.dumps(body, sort_keys=True, default=str, separators=(",", ":")).encode()).hexdigest(), rec["record_sha256"])
                self.assertTrue(rec["assertions"]["pass"]); self.assertTrue(rec["messages"])


if __name__ == "__main__":
    unittest.main()


class Mcp(unittest.TestCase):
    def test_an_mcp_client_works_a_task_and_is_scored(self):
        import subprocess
        from earthbench import mcp_server
        t = M.make_task(1, "gt", "L1", "dupes")
        plan = []

        class Rec:
            answer = None
            def call(_, tool, args=None):
                plan.append((tool, args or {}))
                s = M.SESSION(t); [s.call(c, a) for c, a in plan[:-1]]
                return s.call(tool, args)
        M.recipe(t, Rec(), t.truth, robust=False)
        msgs = [{"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-06-18", "capabilities": {}, "clientInfo": {"name": "test", "version": "0"}}},
                {"jsonrpc": "2.0", "method": "notifications/initialized"}, {"jsonrpc": "2.0", "id": 2, "method": "tools/list"}]
        msgs += [{"jsonrpc": "2.0", "id": 10 + n, "method": "tools/call", "params": {"name": tool, "arguments": args}} for n, (tool, args) in enumerate(plan)]
        with tempfile.TemporaryDirectory() as d:
            p = subprocess.run([sys.executable, "-W", "ignore", "-c", f"import sys; from earthbench import mcp_server as m; m.serve({t.id!r}, out_dir={d!r})"],
                               input="".join(json.dumps(x) + "\n" for x in msgs), capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(os.path.dirname(__file__))), timeout=120)
            replies = [json.loads(x) for x in p.stdout.splitlines()]
            self.assertEqual(replies[0]["result"]["serverInfo"]["name"], "scorcher-benchmark")
            names = {x["name"] for x in replies[1]["result"]["tools"]}
            self.assertIn("grade_tonnage", names); self.assertIn("submit_answer", names)
            self.assertFalse(replies[-1]["result"]["isError"])
            rec = json.load(open(os.path.join(d, os.listdir(d)[0])))
            self.assertTrue(rec["score"]["pass"]); self.assertIn("pass=True", p.stderr)
