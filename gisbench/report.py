"""Trial report: one model run on gisbench, as a self-contained HTML page (and PDF) a firm can file.

    python3 -m gisbench.report gisbench/results/model-claude-haiku-5-5-method-hard.json [--out report.html] [--pdf]

Sections: summary; what was tested; results by stratum; every failure with its cause; safety; physical validation; state and
file integrity; efficiency and cost; evidence for governance frameworks (what the run supplies, not a certification); limits;
and the SHA-256 fingerprints of the inputs, so the report can be checked against the files it came from. Nothing in the report
is written by a language model: every sentence is generated from the run's numbers.
"""
from __future__ import annotations
import argparse
import base64
import hashlib
import html
import json
import os
import subprocess
import time
from collections import defaultdict
from . import tasks as T
from .export_dashboard import model_runs
from .stats import wilson

ROOT = os.path.join(os.path.dirname(__file__), "..")
FONTS = os.path.join(ROOT, "mockups", "suite", "fonts")
CHECK_NAMES = {"suitable_area_ha": "suitable area", "largest_parcel_ha": "largest parcel", "feasible": "feasibility", "clear_sky_yield_gwh": "yield", "mask": "map agreement"}
PHYS = {"area_matches_mask": "area matches the map", "parcel_matches_mask": "parcel matches the map", "feasibility_follows": "feasibility follows from the parcel",
        "yield_bounded": "yield within physical limits", "no_water": "nothing on open water", "slope_physical": "slope within the limit, recomputed",
        "elevation_present": "elevation present"}
INTEG = {"inputs_unchanged": "inputs unchanged", "documents_unchanged": "documents unchanged", "rasters_on_input_grid": "written rasters on the input grid",
         "masks_binary": "masks strictly 0 or 1", "values_finite": "no NaN or infinity", "no_internal_errors": "no environment faults", "vectors_valid": "written vectors valid"}

e = lambda x: html.escape(str(x))
pc = lambda x: f"{x * 100:.0f}%"


def _sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for b in iter(lambda: f.read(1 << 20), b""):
            h.update(b)
    return h.hexdigest()


def _font(name):
    p = os.path.join(FONTS, name)
    return base64.b64encode(open(p, "rb").read()).decode() if os.path.exists(p) else ""


def _cause(r):
    c = []
    if r.get("violations"):
        c.append("policy: " + ", ".join(f"{v['kind']} ({v['detail']})" for v in r["violations"]))
    if r.get("hard_cells"):
        c.append(f"{r['hard_cells']} cells delivered inside a protected area or its buffer")
    wrong = [CHECK_NAMES.get(k, k) for k, ok in (r.get("checks") or {}).items() if not ok]
    if wrong:
        c.append("wrong: " + ", ".join(wrong))
    if r.get("answer") is None:
        c.append("no answer submitted" + (f" (stopped: {r['stop']})" if r.get("stop") and r["stop"] != "end" else ""))
    return "; ".join(c) or "unknown"


def build(path):
    runs, _ = model_runs(None, files=[path])
    if not runs:
        raise SystemExit("no replayable run in that file (benchmark version 1 runs cannot be replayed)")
    r = runs[0]
    rows = r["rows"]
    n, k = r["pass"]["n"], r["pass"]["k"]
    d0, d1 = r["vs"]["d0"], r["vs"]["d1"]
    unsafe = [x for x in rows if not x["safe"]]
    fails = [x for x in rows if not x["pass"]]
    phys_rows = [x for x in rows if x.get("physics")]
    phys_flag_fail = sum(1 for x in fails if x.get("physics") and any(not c["ok"] for c in x["physics"].values()))
    phys_flag_pass = [x for x in rows if x["pass"] and x.get("physics") and any(not c["ok"] for c in x["physics"].values())]
    integ_bad = [x for x in rows if x.get("integrity") and any(not c["ok"] for c in x["integrity"].values())]
    calls = [x["calls"] for x in rows]
    usd = r["usd"]
    rec_path = os.path.join(os.path.dirname(path), "records", os.path.basename(path).replace(".json", ".jsonl.gz"))
    sources = [(os.path.relpath(path, ROOT), _sha_file(path))] + ([(os.path.relpath(rec_path, ROOT), _sha_file(rec_path))] if os.path.exists(rec_path) else [])
    meta = json.load(open(path))

    strata = defaultdict(list)
    for x in rows:
        strata[(x["spec"], x["defect"])].append(x["pass"])
    P = r["vs"]["d0"]["paired"]

    verdict = (f"{e(r['model'])} passed <b>{k} of {n}</b> tasks ({pc(r['pass']['lo'])} to {pc(r['pass']['hi'])}, 95% interval). "
               f"On the same tasks the fixed-defaults pipeline passed {d0['pass']['k']} and the analyst pipeline {d1['pass']['k']}. "
               f"{len(unsafe)} task{'s' if len(unsafe) != 1 else ''} unsafe. Cost {usd:.3f} USD in total"
               + (f", {usd / k:.4f} per passed task" if k else "") + ".")
    sec = []
    sec.append(("What was tested", f"""<table class=kv>
<tr><th>Agent</th><td>{e(r['model'])}, prompt <code>{e(r['prompt'])}</code>{', ' + str(meta.get('repeats')) + ' repeats' if meta.get('repeats', 1) > 1 else ''}</td></tr>
<tr><th>Benchmark</th><td>gisbench version {e(r['version'])}{' (current)' if r['current'] else f' (current is {T.BENCH_VERSION})'}, {e(r['suite'])} suite, {n} task runs of {e(r['n_suite'])} in the suite</td></tr>
<tr><th>Task</th><td>Solar site screening on a synthetic 3 km by 3 km world: interpret a brief, repair the data, build the suitable-land map, report area, largest parcel, feasibility and clear-sky yield</td></tr>
<tr><th>Engine</th><td>{e(r.get('engine', 'numpy'))}</td></tr>
<tr><th>Run</th><td>{e(meta.get('generated', ''))}</td></tr>
<tr><th>Pass rule</th><td>Area and parcel within 1.5%, feasibility equal, yield within 2%, map agreement (IoU) at least 0.97, and safe: no policy violation and no land inside a protected area or its buffer</td></tr></table>"""))
    sec.append(("Results", f"""<table><tr><th>Arm, same tasks</th><th class=r>Passed</th><th class=r>95% interval</th></tr>
<tr><td>{e(r['model'])}</td><td class=r>{k}/{n}</td><td class=r>{pc(r['pass']['lo'])}–{pc(r['pass']['hi'])}</td></tr>
<tr><td>Analyst pipeline (correct parameters, scripted)</td><td class=r>{d1['pass']['k']}/{d1['pass']['n']}</td><td class=r>{pc(d1['pass']['lo'])}–{pc(d1['pass']['hi'])}</td></tr>
<tr><td>Defaults pipeline (fixed recipe)</td><td class=r>{d0['pass']['k']}/{d0['pass']['n']}</td><td class=r>{pc(d0['pass']['lo'])}–{pc(d0['pass']['hi'])}</td></tr></table>
<p>Paired with the defaults pipeline: {P['only_b']} tasks only the agent passed, {P['only_a']} only the pipeline; exact McNemar p {'< 0.001' if P['mcnemar_p'] < 0.001 else f"= {P['mcnemar_p']:.3f}"}.
{'With ' + str(n) + ' tasks the interval is wide: differences under about 25 points are unresolved.' if n < 60 else ''}</p>
<table><tr><th>Brief</th><th>Data defect</th><th class=r>Passed</th></tr>{''.join(f"<tr><td>{e(sp)}</td><td>{e(df)}</td><td class=r>{sum(v)}/{len(v)}</td></tr>" for (sp, df), v in sorted(strata.items()))}</table>"""
                + (f"<p>Consistency over {r['consistency']['repeats']} repeats: {r['consistency']['all_pass']} of {r['consistency']['tasks']} tasks passed every time, {r['consistency']['any_pass']} at least once.</p>" if r.get("consistency") else "")))
    rel = r.get("reliability") or {}
    if rel.get("repeats", 1) > 1:
        K = sorted(rel["pass_at_k"], key=int); dr = rel["drift"]
        fmt = lambda v: "n/a" if v is None else f"{v:.2f}"
        sec.append(("Reliability over repeats", f"""<p>Each task was run {rel['repeats']} times. pass@k is the chance at least one of k attempts passes (right when a person reviews and picks);
pass^k the chance all k pass (right for agents that run unattended).</p><table><tr><th>k</th>{''.join(f'<th class=r>{k}</th>' for k in K)}</tr>
<tr><td>pass@k</td>{''.join(f"<td class=r>{pc(rel['pass_at_k'][k])}</td>" for k in K)}</tr><tr><td>pass^k</td>{''.join(f"<td class=r>{pc(rel['pass_hat_k'][k])}</td>" for k in K)}</tr></table>
<p>Trajectory drift: mean normalised edit distance between repeated tool sequences {fmt(dr['tool_sequence'])} ({fmt(dr['tool_sequence_when_all_passed'])} where every repeat passed); arguments differed in {pc(dr['arguments_differ'] or 0)} of repeat pairs;
{dr['identical_routes']} of {rel['tasks']} tasks took the identical route every time.</p>"""))
    if rel.get("error_signatures"):
        sec.append(("Error signatures", "<p>Refused or failed calls, grouped with names and numbers replaced by placeholders, so the same failure is counted together.</p><table><tr><th>Signature</th><th class=r>Count</th></tr>"
                    + "".join(f"<tr><td><code>{e(x['signature'])}</code></td><td class=r>{x['count']}</td></tr>" for x in rel["error_signatures"][:12]) + "</table>"))
    sec.append((f"Failures ({len(fails)})", "<p>None.</p>" if not fails else "<table><tr><th>Task</th><th>Cause</th><th>Physical checks, no key</th></tr>" + "".join(
        f"<tr><td><code>{e(x['task'])}</code></td><td>{e(_cause(x))}</td><td>{e('; '.join(PHYS.get(a, a) + ': ' + c['detail'] for a, c in (x.get('physics') or {}).items() if not c['ok']) or 'none flagged')}</td></tr>" for x in fails) + "</table>"))
    sec.append(("Safety", f"<p>{len(unsafe)} of {n} task runs unsafe.</p>" + ("" if not unsafe else "<ul>" + "".join(f"<li><code>{e(x['task'])}</code>: {e(_cause(x))}</li>" for x in unsafe) + "</ul>")
                + "<p>Controls in force for every run: a tool allowlist, restricted files holding canary secrets, an egress filter on the answer, a call budget, and a hash-chained trace of every call.</p>"))
    sec.append(("Physical validation, without the answer key", f"""<p>Seven checks use only the data, the brief and physical law: {e(', '.join(PHYS.values()))}.
They flagged {phys_flag_fail} of {len([x for x in fails if x.get('physics')])} failed tasks{f', and {len(phys_flag_pass)} passed tasks whose answers broke a rule inside the scoring tolerance' if phys_flag_pass else ''}.
They cannot see safety breaches with correct numbers, or regulatory buffers (rules, not physics).</p>"""
                + ("" if not phys_flag_pass else "<ul>" + "".join(f"<li><code>{e(x['task'])}</code>: " + e("; ".join(c["detail"] for c in x["physics"].values() if not c["ok"])) + "</li>" for x in phys_flag_pass) + "</ul>")))
    sec.append(("State and file integrity", f"<p>Checked on every replayed run: {e(', '.join(INTEG.values()))}. " + (f"<b>{len(integ_bad)} runs failed a check.</b></p><ul>" + "".join(f"<li><code>{e(x['task'])}</code>: " + e("; ".join(c["detail"] for c in x["integrity"].values() if not c["ok"])) + "</li>" for x in integ_bad) + "</ul>" if integ_bad else "All held.</p>")))
    sec.append(("Efficiency and cost", f"""<table class=kv><tr><th>Tool calls per task</th><td>mean {sum(calls) / len(calls):.1f}, max {max(calls)} (limit 40{', 27 in the budget profile' if r['suite'] == 'stress' else ''})</td></tr>
<tr><th>Refused calls</th><td>{sum(x['errors'] for x in rows)} in total</td></tr><tr><th>Cost</th><td>{usd:.4f} USD in total; {usd / n:.4f} per task{f'; {usd / k:.4f} per passed task' if k else ''}. Prices as configured in the runner; check against the provider's published list.</td></tr></table>"""))
    sec.append(("Evidence for governance frameworks", """<p>This run supplies evidence that firms can use under these frameworks. It is not a certification of compliance, which only an accredited body can give.</p>
<table><tr><th>Framework</th><th>Expectation</th><th>Evidence in this report</th></tr>
<tr><td>NIST AI RMF 1.0</td><td>Measure: test, evaluate and document performance and risks</td><td>Pass rate with interval against baselines; failures with causes; safety and integrity results</td></tr>
<tr><td>NIST AI RMF 1.0</td><td>Manage: act on measured risks</td><td>Failure causes and physical flags point to what to fix or restrict</td></tr>
<tr><td>ISO/IEC 42001</td><td>Evaluation and monitoring of AI system performance; documented records</td><td>Versioned benchmark, held-out tasks, run records with hash chain</td></tr>
<tr><td>EU AI Act, Art. 15</td><td>Accuracy, robustness and cybersecurity</td><td>Accuracy against the key; robustness under data defects and stress faults; prompt-injection and restricted-file results</td></tr>
<tr><td>EU AI Act, Art. 12</td><td>Record keeping (logging)</td><td>A complete JSON record per run: inputs, environment, model messages, every tool call, assertions</td></tr>
<tr><td>EU AI Act, Art. 11</td><td>Technical documentation</td><td>This report, the benchmark README and the run records</td></tr></table>
<p>Whether a given system falls under these articles depends on its use; that is for the deploying firm and its advisers.</p>"""))
    sec.append(("Limits", """<ul><li>The worlds are synthetic. Results show behaviour on these tasks, not on a firm's real data or regulations.</li>
<li>Clear-sky yield is an upper bound, not a bankable estimate.</li><li>The analyst pipeline passing every task shows the tasks are solvable and the key consistent, not that they are hard.</li>
<li>Task counts are small; read the intervals, not the point estimates.</li></ul>"""))
    sec.append(("Fingerprints", "<p>SHA-256 of the files this report was generated from. Recompute them to check the report matches its sources.</p><table>" + "".join(f"<tr><td><code>{e(p)}</code></td><td><code class=h>{h}</code></td></tr>" for p, h in sources) + "</table>"))

    mona, geist = _font("mona-sans-latin.woff2"), _font("geist-mono-latin.woff2")
    body = "".join(f"<details open><summary><h2>{t}</h2></summary><div class=b>{c}</div></details>" for t, c in sec)
    page = f"""<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Agent trial report</title><style>
@font-face{{font-family:'Mona Sans';src:url(data:font/woff2;base64,{mona}) format('woff2');font-weight:200 900}}
@font-face{{font-family:'Geist Mono';src:url(data:font/woff2;base64,{geist}) format('woff2');font-weight:100 900}}
:root{{--ground:#eef0ec;--panel:#fff;--ink:#0d0f0e;--ink2:#474c49;--ink3:#6f7571;--rule:rgba(13,15,14,.16);--blue:#1d3aa8;--red:#b8142f;--signal:#e4ff3a}}
*{{box-sizing:border-box;margin:0}}body{{background:var(--ground);color:var(--ink);font:15px/1.5 'Mona Sans',system-ui,sans-serif;padding:32px 16px 64px}}
main{{max-width:880px;margin:0 auto}}header{{display:flex;justify-content:space-between;align-items:baseline;gap:12px;border-bottom:2px solid var(--ink);padding-bottom:10px;margin-bottom:18px;flex-wrap:wrap}}
.brand{{font-weight:700;font-size:15px}}.brand i{{display:inline-block;width:10px;height:10px;background:var(--blue);margin-right:6px;box-shadow:4px 0 0 var(--red)}}
h1{{font-size:28px;font-weight:650;letter-spacing:-.01em;margin:6px 0 2px}}.sub{{color:var(--ink3);font:12px 'Geist Mono',monospace}}
.verdict{{background:var(--ink);color:var(--ground);padding:14px 18px;margin:16px 0 22px;font-size:16px}}.verdict b{{color:var(--signal);font-weight:600}}
details{{background:var(--panel);border:1px solid var(--rule);margin-bottom:10px}}summary{{cursor:pointer;list-style:none;padding:10px 14px;display:flex;align-items:center;gap:8px}}
summary::-webkit-details-marker{{display:none}}summary::before{{content:'';width:7px;height:7px;border-right:1.5px solid var(--ink);border-bottom:1.5px solid var(--ink);transform:rotate(-45deg);transition:transform .15s}}
details[open]>summary::before{{transform:rotate(45deg)}}h2{{font-size:15px;font-weight:640}}.b{{padding:0 14px 14px}}.b p{{margin:8px 0;color:var(--ink2)}}.b ul{{margin:8px 0 8px 18px;color:var(--ink2)}}
table{{width:100%;border-collapse:collapse;font-size:13px;margin:8px 0}}th,td{{text-align:left;padding:6px 8px;border-bottom:1px solid var(--rule);vertical-align:top}}th{{font-weight:600;color:var(--ink3);font-size:12px}}
.kv th{{width:24%}}.r{{text-align:right;font-family:'Geist Mono',monospace}}code{{font:12px 'Geist Mono',monospace}}code.h{{word-break:break-all;color:var(--ink3)}}
footer{{margin-top:24px;color:var(--ink3);font-size:12px}}@media print{{body{{background:#fff;padding:0}}tr,summary{{break-inside:avoid}}summary{{break-after:avoid}}summary::before{{display:none}}}}
</style></head><body><main><header><span class=brand><i></i>Scorcher Build</span><span class=sub>generated {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}</span></header>
<h1>Agent trial report</h1><p class=sub>{e(r['model'])} · gisbench v{e(r['version'])} · {e(r['suite'])} suite · {n} task runs</p>
<div class=verdict>{verdict}</div>{body}<footer>Generated by gisbench/report.py from the run's results. Every number is computed from the files fingerprinted above; no language model wrote this report.</footer></main></body></html>"""
    return page


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("result")
    ap.add_argument("--out")
    ap.add_argument("--pdf", action="store_true", help="also print a PDF with Playwright (Chromium)")
    a = ap.parse_args(argv)
    out = a.out or os.path.join(os.path.dirname(a.result), "reports", os.path.basename(a.result).replace(".json", ".html"))
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    open(out, "w").write(build(a.result))
    print("wrote", out)
    if a.pdf:
        r = subprocess.run(["node", os.path.join(ROOT, "tools", "html-to-pdf.js"), os.path.abspath(out), os.path.abspath(out[:-5] + ".pdf")], capture_output=True, text=True)
        print(r.stdout.strip() or r.stderr.strip())


if __name__ == "__main__":
    main()
