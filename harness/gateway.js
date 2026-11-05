'use strict';
// The tool gateway: the one place an agent touches anything. Every call is validated, metered and written to the trial's trace.
// The MCP servers (mcp-server.js, mcp-http.js) expose exactly these tools, so an agent connecting over MCP and a scripted agent calling
// the gateway directly go through the same code and leave the same record. Tools are read-only: they compute; they never write to client data.
const { z } = require('zod');
const { convert } = require('./tools/units');
const { monteCarlo, KEYS } = require('./tools/resource');
const { hornerExtrapolate } = require('./tools/well');
const { pickDifference, withinHumanSpread } = require('./tools/seismic');
const { validate } = require('./grade');

const dist = z.object({ kind: z.enum(['tri', 'uniform', 'fixed']), min: z.number().optional(), mode: z.number().optional(), max: z.number().optional(), value: z.number().optional() });
const picks = z.array(z.number().nullable());

const TOOLS = {
  task_get: { description: 'Get the task statement and its inputs. Takes no arguments.', shape: {}, run: (_, trial) => ({ id: trial.task.id, statement: trial.task.statement, inputs: trial.task.inputs, unitsNote: trial.task.unitsNote }) },
  units_convert: { description: 'Convert a value between units of length, area, pressure or temperature.', shape: { value: z.number(), from: z.string(), to: z.string() }, run: a => ({ value: convert(a.value, a.from, a.to), unit: a.to }) },
  resource_volumetric_mc: {
    description: 'Monte Carlo of the volumetric heat-in-place method. Inputs in SI-friendly units: areaKm2, thicknessM, tempC, refTempC, rhoC (MJ/m3/K), recovery, efficiency (fractions), lifeYears, loadFactor. Each is a distribution {kind: tri|uniform|fixed, min, mode, max, value}. Returns P90, P50, P10 in MWe (exceedance convention) with the Monte Carlo interval on each.',
    shape: { inputs: z.object(Object.fromEntries(KEYS.map(k => [k, dist]))), n: z.number().int().min(1000).max(200000).optional(), seed: z.number().int().optional() },
    run: a => { const r = monteCarlo(a.inputs, { n: a.n || 20000, seed: a.seed || 1 }); return { unit: 'MWe', p90: r.p90, p50: r.p50, p10: r.p10, mean: r.mean, p50ci: r.p50ci, p90ci: r.p90ci, p10ci: r.p10ci, n: r.n, seed: r.seed, hist: r.hist }; } },
  well_horner: { description: 'Formation temperature from bottom-hole temperature readings by the Horner method, with a 95 % interval from the regression.', shape: { readings: z.array(z.object({ dtHours: z.number(), tempC: z.number() })).min(2), tcHours: z.number() }, run: a => hornerExtrapolate(a.readings, a.tcHours) },
  seismic_compare_picks: { description: 'Compare an agent horizon pick set with two interpreters: difference statistics and the fraction of picks within the human spread.', shape: { agent: picks, interpreterA: picks, interpreterB: picks, tolMs: z.number().optional() },
    run: a => ({ agentVsA: pickDifference(a.agent, a.interpreterA), agentVsB: pickDifference(a.agent, a.interpreterB), humans: pickDifference(a.interpreterA, a.interpreterB), withinHumanSpread: withinHumanSpread(a.agent, a.interpreterA, a.interpreterB, a.tolMs || 0) }) },
  report_usage: { description: 'Report the model and token usage of one model call your agent made (input_tokens, output_tokens). Self-reported: the scorecard labels it so. Optional, call once per model call or once with totals.',
    shape: { model: z.string(), input_tokens: z.number().int().min(0), output_tokens: z.number().int().min(0) },
    run: (a, trial) => { (trial.usage = trial.usage || []).push({ model: a.model, input_tokens: a.input_tokens, output_tokens: a.output_tokens }); return { recorded: true, calls: trial.usage.length }; } },
  submit_answer: { description: 'Submit the final answer. Deterministic checks run first and report what is wrong, so you may correct and resubmit; the number of attempts is recorded. Fields: p90, p50, p10 (numbers), unit ("MWe"), method (text), steps (optional list of text).',
    shape: { answer: z.record(z.string(), z.unknown()) },
    run: (a, trial) => { trial.attempts.push({ at: Date.now(), answer: a.answer }); const errors = validate(a.answer); if (!errors.length) { trial.accepted = a.answer; trial.done = true; return { accepted: true, attempt: trial.attempts.length }; } return { accepted: false, errors, attempt: trial.attempts.length }; } },
};

class Trial {
  constructor(id, task, { maxCalls = 60 } = {}) { Object.assign(this, { id, task, maxCalls, trace: [], attempts: [], accepted: null, done: false, tokens: null, usage: null, started: Date.now(), ended: null }); }
  summary() { return { id: this.id, task: this.task.id, calls: this.trace.length, attempts: this.attempts.length, accepted: !!this.accepted, wallMs: (this.ended || Date.now()) - this.started, tokens: this.tokens, usage: this.usage }; }
}

// Call a tool for a trial. Throws on a bad call but always writes the trace entry first.
function call(trial, name, args = {}) {
  const t0 = Date.now(), entry = { i: trial.trace.length + 1, tool: name, args, ok: false, ms: 0, at: t0 };
  trial.trace.push(entry);
  try {
    if (trial.done) throw new Error('trial is finished');
    if (trial.trace.length > trial.maxCalls) throw new Error('call budget exceeded');
    const tool = TOOLS[name]; if (!tool) throw new Error('unknown tool: ' + name);
    const parsed = z.object(tool.shape).strict().parse(args);
    const result = tool.run(parsed, trial); entry.ok = true; entry.result = result;
    if (trial.done) trial.ended = Date.now();
    return result;
  } catch (e) { entry.error = e.issues ? e.issues.map(i => i.path.join('.') + ': ' + i.message).join('; ') : e.message; throw new Error(entry.error); }
  finally { entry.ms = Date.now() - t0; }
}

module.exports = { TOOLS, Trial, call };
