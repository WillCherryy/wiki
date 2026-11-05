#!/usr/bin/env node
'use strict';
// Tests for the Scorcher Build harness: statistics against known values, the tools against closed forms, the gateway's trace and review
// gate, grading, and a full agent working a task over MCP. Skipped (with a note) when the harness dependencies are not installed.
const path = require('path');
try { require.resolve('zod', { paths: [__dirname] }); require.resolve('@modelcontextprotocol/sdk/package.json', { paths: [__dirname] }); }
catch { console.log('ok: build harness (skipped: run "npm install" in harness/ to enable)'); process.exit(0); }

let fails = 0, checks = 0;
const ok = (c, m) => { checks++; if (!c) { fails++; console.error('  FAIL ' + m); } };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b} (tolerance ${tol})`);
const { rng, wilson, quantile, quantileCI, pairedDiff } = require('./stats');
const { convert } = require('./tools/units');
const { monteCarlo, powerMWe, normalise } = require('./tools/resource');
const { hornerExtrapolate } = require('./tools/well');
const { pickDifference, withinHumanSpread } = require('./tools/seismic');
const { generate, reference } = require('./tasks');
const { Trial, call } = require('./gateway');
const { gradeResource, validate } = require('./grade');
const { runTrial } = require('./run-trial');

(async () => {
  // statistics
  { const w = wilson(28, 30); near(w.lo, 0.787, 0.002, 'Wilson lower bound for 28/30'); near(w.hi, 0.982, 0.002, 'Wilson upper bound for 28/30'); ok(wilson(0, 10).lo === 0 && wilson(10, 10).hi === 1, 'Wilson stays within 0 and 1');
    ok(quantile([5, 5, 5, 5], 0.37) === 5 && quantile([1, 2, 3, 4, 5], 0.5) === 3 && quantile([1, 2], 0.5) === 1.5, 'quantile (identical values exact, median, interpolation)');
    const a = Array(20).fill(1), z = Array(20).fill(0); ok(pairedDiff(a, z).verdict === 'a better' && pairedDiff(a, a).verdict === 'inconclusive' && pairedDiff(a, a).diff === 0, 'paired comparison verdicts');
    const sorted = Array.from({ length: 10001 }, (_, i) => i); const ci = quantileCI(sorted, 0.5); ok(ci.lo < 5000 && ci.hi > 5000 && ci.hi - ci.lo < 300, 'percentile interval brackets the median'); }
  // units
  near(convert(1, 'acre', 'm2'), 4046.8564224, 1e-6, 'acre'); near(convert(100, 'C', 'F'), 212, 1e-9, '100 C in F'); near(convert(1, 'psi', 'pa'), 6894.757293168, 1e-6, 'psi'); near(convert(1000, 'ft', 'm'), 304.8, 1e-9, 'ft');
  { let threw = false; try { convert(1, 'm', 'pa'); } catch { threw = true; } ok(threw, 'converting between unlike quantities is refused'); }
  // resource estimate: closed form, reproducibility, ordering, interval
  { const fixed = { areaKm2: 5, thicknessM: 500, tempC: 180, refTempC: 15, rhoC: 2.7, recovery: 0.25, efficiency: 0.12, lifeYears: 30, loadFactor: 0.9 };
    const expect = 5e6 * 500 * 2.7e6 * 165 * 0.25 * 0.12 / (30 * 3.15576e7 * 0.9) / 1e6; near(powerMWe(fixed), expect, 1e-9, 'volumetric formula'); near(expect, 39.2, 0.1, 'worked example is about 39 MWe');
    const f = Object.fromEntries(Object.entries(fixed).map(([k, v]) => [k, { kind: 'fixed', value: v }])); const m = monteCarlo(f, { n: 2000, seed: 3 }); ok(m.p90 === m.p50 && m.p50 === m.p10 && Math.abs(m.p50 - expect) < 1e-9, 'fixed inputs give one value at every percentile'); }
  { const t = generate(3)[1], a = monteCarlo(normalise(t), { n: 5000, seed: 5 }), b = monteCarlo(normalise(t), { n: 5000, seed: 5 }), c = monteCarlo(normalise(t), { n: 5000, seed: 6 });
    ok(a.p50 === b.p50 && a.p50 !== c.p50, 'same seed reproduces, a different seed differs'); ok(a.p90 < a.p50 && a.p50 < a.p10, 'exceedance order P90 < P50 < P10'); ok(a.p50ci.lo <= a.p50 && a.p50 <= a.p50ci.hi && a.p50ci.hi - a.p50ci.lo < 0.05 * a.p50, 'Monte Carlo interval brackets P50 and is tight'); }
  // Horner: exact recovery, and the interval is calibrated
  { const tc = 6, dts = [6, 12, 18, 24], exact = dts.map(dt => ({ dtHours: dt, tempC: 100 - 8 * Math.log((tc + dt) / dt) })), h = hornerExtrapolate(exact, tc);
    near(h.formationTempC, 100, 1e-9, 'Horner recovers the formation temperature'); near(h.slope, -8, 1e-9, 'Horner recovers the slope (negative: the well warms back as shut-in time grows)'); ok(hornerExtrapolate(exact.slice(0, 2), tc).ci95 === null, 'two readings give no interval');
    const r = rng(11), gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r()); let inside = 0; const N = 3000;
    for (let k = 0; k < N; k++) { const d = hornerExtrapolate(exact.map(x => ({ dtHours: x.dtHours, tempC: x.tempC + gauss() })), tc); if (d.ci95[0] <= 100 && 100 <= d.ci95[1]) inside++; }
    near(inside / N, 0.95, 0.02, 'the 95 % interval on formation temperature covers the truth about 95 % of the time'); }
  // seismic
  { const A = [100, 110, 120, null, 140], B = [102, 108, 123, 130, 138], d = pickDifference(A, B); ok(d.n === 4 && Math.abs(d.biasMs - (-1 / 4 * 2 + 0)) < 5, 'pick difference counts only traces picked by both');
    const s = withinHumanSpread([101, 109, 130, 135, 139], A, B, 0); ok(s.n === 4 && s.within === 3, 'within the human spread (the pick at 130 is outside 120 to 123)'); }
  // gateway: trace, bad calls, review gate, budget
  { const task = generate(1)[0], t = new Trial('t1', task);
    ok(call(t, 'task_get').id === task.id && t.trace.length === 1 && t.trace[0].ok, 'a call is traced');
    let msg = ''; try { call(t, 'units_convert', { value: 'x' }); } catch (e) { msg = e.message; } ok(msg && t.trace[1].ok === false && t.trace[1].error, 'a malformed call is refused and still traced');
    msg = ''; try { call(t, 'no_such_tool'); } catch (e) { msg = e.message; } ok(/unknown tool/.test(msg), 'unknown tool refused');
    const bad = call(t, 'submit_answer', { answer: { p90: 30, p50: 20, p10: 10, unit: 'MWe', method: 'a made-up method' } }); ok(bad.accepted === false && bad.errors.some(e => /exceedance/.test(e)), 'the review gate rejects P90 above P10');
    const bigUnits = call(t, 'submit_answer', { answer: { p90: 9000, p50: 10000, p10: 11000, unit: 'MWe', method: 'unit-blind estimate' } }); ok(bigUnits.errors.some(e => /units/.test(e)), 'the review gate flags an implausible magnitude');
    const good = call(t, 'submit_answer', { answer: { p90: 10, p50: 20, p10: 30, unit: 'MWe', method: 'a stated method of estimation' } }); ok(good.accepted && t.attempts.length === 3 && t.done, 'a valid answer is accepted and attempts are counted');
    msg = ''; try { call(t, 'task_get'); } catch (e) { msg = e.message; } ok(/finished/.test(msg), 'no calls after the trial is done');
    const t2 = new Trial('t2', task, { maxCalls: 2 }); call(t2, 'task_get'); call(t2, 'task_get'); msg = ''; try { call(t2, 'task_get'); } catch (e) { msg = e.message; } ok(/budget/.test(msg), 'call budget enforced'); }
  // grading
  { const task = generate(2)[1], ref = reference(task), mk = k => ({ p90: ref.p90 * k, p50: ref.p50 * k, p10: ref.p10 * k, unit: 'MWe', method: 'reference replay' });
    ok(gradeResource(task, mk(1)).pass, 'the reference answer passes'); ok(gradeResource(task, mk(1.03)).pass && !gradeResource(task, mk(1.2)).pass && gradeResource(task, mk(1.2)).category === 'value', 'tolerance: 3 % passes, 20 % fails as a value error');
    const point = { p90: ref.p50, p50: ref.p50, p10: ref.p50, unit: 'MWe', method: 'point estimate only' }; ok(gradeResource(task, point).category === 'no-uncertainty', 'a point estimate with no spread is graded as no-uncertainty');
    ok(validate({ p90: 1, p50: 2, p10: 3, unit: 'MW', method: 'long enough text' }).some(e => /MWe/.test(e)), 'wrong unit label rejected'); }
  // a whole trial of fixture agents
  { const r = runTrial({ n: 24 }), [careful, blind, point] = r.arms;
    ok(careful.pass.rate === 1, 'the careful fixture passes every synthetic task'); ok(blind.pass.rate < 1 && blind.pass.rate > 0 && blind.firstPass.rate < blind.pass.rate && blind.corrected > 0, 'the unit-blind fixture fails some, and the review gate rescues some on a second try');
    ok(point.pass.rate === 0 && point.failures['no-uncertainty'] === 24, 'the point-estimate fixture never passes and is labelled no-uncertainty'); ok(r.pairs.every(p => p.verdict === 'a better'), 'paired comparisons separate the agents');
    ok(r.arms.every(a => a.pass.lo <= a.pass.rate && a.pass.rate <= a.pass.hi), 'every pass rate sits inside its interval'); }
  // an external agent over MCP (HTTP, per-trial token): discover, work the task, submit, graded
  { const { createHttp } = require('./mcp'), { Client } = require('@modelcontextprotocol/sdk/client/index.js'), { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const h = createHttp(), port = await h.listen(), task = generate(3)[0], { trial, token } = h.open(task), url = new URL(`http://127.0.0.1:${port}/mcp`);
    const noToken = await fetch(url, { method: 'POST', body: '{}' }); ok(noToken.status === 401, 'MCP refuses a request without a trial token');
    const wrong = await fetch(url, { method: 'POST', headers: { authorization: 'Bearer nope' }, body: '{}' }); ok(wrong.status === 401, 'MCP refuses a wrong token');
    const client = new Client({ name: 'external-agent', version: '1' }); await client.connect(new StreamableHTTPClientTransport(url, { requestInit: { headers: { Authorization: 'Bearer ' + token } } }));
    const names = (await client.listTools()).tools.map(t => t.name); ok(['task_get', 'resource_volumetric_mc', 'submit_answer', 'units_convert'].every(n => names.includes(n)), 'MCP lists the gateway tools');
    const j = async (name, args) => JSON.parse((await client.callTool({ name, arguments: args })).content[0].text);
    const got = await j('task_get', {}); ok(got.id === task.id && !('reference' in got), 'the agent sees the task and no reference answer');
    const mc = await j('resource_volumetric_mc', { inputs: normalise(task), n: 20000, seed: 4 }), sub = await j('submit_answer', { answer: { p90: mc.p90, p50: mc.p50, p10: mc.p10, unit: 'MWe', method: 'MCP agent: Monte Carlo of the volumetric method' } });
    ok(sub.accepted && trial.accepted && gradeResource(task, trial.accepted).pass, 'an agent working over MCP is accepted and passes the grader');
    ok(trial.trace.map(t => t.tool).join() === 'task_get,resource_volumetric_mc,submit_answer', 'every MCP call is in the trace, in order');
    await client.close(); await h.close(); }
  // the same tools over stdio (an agent running next to the harness, e.g. on the client's own hardware); the trace is written when the agent disconnects
  { const { Client } = require('@modelcontextprotocol/sdk/client/index.js'), { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js'), fs = require('fs');
    const out = path.join(__dirname, 'out', 'stdio-res-001.json'); try { fs.unlinkSync(out); } catch {}
    const client = new Client({ name: 'stdio-agent', version: '1' }); await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(__dirname, 'mcp.js'), '--task', 'res-001'] }));
    const tools = (await client.listTools()).tools.map(t => t.name); ok(tools.includes('submit_answer') && tools.includes('task_get'), 'stdio lists the gateway tools');
    const got = JSON.parse((await client.callTool({ name: 'task_get', arguments: {} })).content[0].text); ok(got.id === 'res-001', 'stdio serves the requested task');
    await client.close(); await new Promise(r => setTimeout(r, 500));
    const rec = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null; ok(rec && rec.trace.length === 1 && rec.trace[0].tool === 'task_get', 'stdio writes the trace when the agent disconnects'); }
  // the model runner (route 1 for a model): a STAND-IN for the model, speaking the real message format, tests the wiring only. Its output is never reported as a result.
  { const { runModelAgent } = require('./llm-agent'), { createHttp } = require('./mcp'), { callCost, trialCost } = require('./pricing'), { scoreRow } = require('./score');
    const mk = (id, name, input) => ({ type: 'tool_use', id, name, input });
    const standIn = (script = {}) => { let turn = 0; return async ({ messages, tools }) => { turn++; const last = messages[messages.length - 1].content, usage = { input_tokens: 1000 * turn, output_tokens: 200 }; script.sawTools = tools.map(t => t.name);
      if (script.refuse) return { content: [], stop_reason: 'refusal', usage };
      if (turn === 1) return { content: [mk('t1', script.badFirst ? 'units_convert' : 'task_get', script.badFirst ? { value: 'x' } : {})], stop_reason: 'tool_use', usage };
      if (script.badFirst && turn === 2) { script.sawError = last[0].is_error === true; return { content: [mk('t2', 'task_get', {})], stop_reason: 'tool_use', usage }; }
      const t = turn - (script.badFirst ? 1 : 0);
      if (t === 2) return { content: [mk('t2', 'resource_volumetric_mc', { inputs: normalise(JSON.parse(last[0].content)), n: 20000, seed: 4 })], stop_reason: 'tool_use', usage };
      if (t === 3) { const m = JSON.parse(last[0].content); return { content: [mk('t3', 'submit_answer', { answer: { p90: m.p90, p50: m.p50, p10: m.p10, unit: 'MWe', method: 'stand-in: Monte Carlo of the volumetric method' } })], stop_reason: 'tool_use', usage }; }
      return { content: [{ type: 'text', text: 'done' }], stop_reason: 'end_turn', usage }; }; };
    const h = createHttp(), port = await h.listen(), url = `http://127.0.0.1:${port}/mcp`, task = generate(3)[0], model = 'claude-haiku-5-5';
    { const { trial, token } = h.open(task), script = {}, run = await runModelAgent({ model, url, token, trial, complete: standIn(script) });
      ok(run.stopReason === 'submitted' && trial.accepted && gradeResource(task, trial.accepted).pass, 'a model-shaped agent works a task over MCP and is graded');
      ok(!script.sawTools.includes('report_usage') && script.sawTools.includes('submit_answer'), 'the model is shown the task tools but not the accounting tool');
      ok(trial.usage.length === 3 && trial.usage.reduce((s, u) => s + u.input_tokens, 0) === 6000 && trial.usage.reduce((s, u) => s + u.output_tokens, 0) === 600, 'token usage is recorded on the trial, per call');
      near(trialCost(model, run.calls).total, 0.0009, 1e-9, 'cost from tokens at the published rates (Haiku 5.5: 6,000 in, 600 out)'); near(run.cost, 0.0009, 1e-9, 'running cost matches'); }
    { const { trial, token } = h.open(task), run = await runModelAgent({ model, url, token, trial, complete: standIn(), maxCostUsd: 0.0001 }); const row = scoreRow(task, trial, null, { stopReason: run.stopReason });
      ok(run.stopReason === 'cost-cap' && !trial.accepted && row.category === 'cost-cap' && row.pass === 0, 'the spend cap stops a run and is recorded as its own failure category'); }
    { const { trial, token } = h.open(task), run = await runModelAgent({ model, url, token, trial, complete: standIn({ refuse: true }) }); ok(run.stopReason === 'refusal' && scoreRow(task, trial, null, { stopReason: run.stopReason }).category === 'refusal', 'a refusal is recorded as a refusal, with no silent fallback to another model'); }
    { const { trial, token } = h.open(task), script = { badFirst: true }, run = await runModelAgent({ model, url, token, trial, complete: standIn(script) }); ok(script.sawError === true && run.stopReason === 'submitted', 'a malformed tool call comes back to the model as an error result, and it recovers'); }
    await h.close();
    near(callCost('claude-haiku-5-5', { input_tokens: 150000, output_tokens: 1000 }).input, 0.075, 1e-9, 'Haiku 5.5 long-prompt rate applies above 100K tokens'); let threw = false; try { callCost('no-such-model', { input_tokens: 1, output_tokens: 1 }); } catch { threw = true; } ok(threw, 'a model without a price is refused, never guessed');
    const run = args => require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'run-llm-trial.js'), ...args], { encoding: 'utf8', env: { PATH: process.env.PATH } });
    const dry = run(['--model', 'claude-haiku-5-5', '--n', '2']); ok(dry.status === 0 && /Not running/.test(dry.stdout) && /estimate/.test(dry.stdout), 'the trial command prints an estimate and does not spend without --yes');
    const nokey = run(['--model', 'claude-haiku-5-5', '--n', '2', '--yes']); ok(nokey.status === 2 && /No credentials/.test(nokey.stderr), 'with --yes but no credentials it refuses and says how to supply them'); }
  if (fails) { console.error(`build harness: ${fails} of ${checks} checks failed`); process.exit(1); }
  console.log(`ok: build harness (${checks} checks: statistics, tools against closed forms, gateway trace and review gate, grading, fixture trial, an agent over MCP, HTTP and stdio, the model runner with cost and spend cap)`);
})().catch(e => { console.error(e); process.exit(1); });
