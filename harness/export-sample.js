#!/usr/bin/env node
'use strict';
// Runs the synthetic trial and writes mockups/suite/build-sample.js, so the console mockup shows real harness output
// (real Monte Carlo, real grading, real statistics) on clearly synthetic tasks.
const fs = require('fs'), path = require('path');
const { runTrial, runSuite } = require('./run-trial');
const { verifyChain } = require('./gateway');
const { normalise, powerMWe, KEYS } = require('./tools/resource');
const { TOOLS } = require('./gateway');
const { PRICES, SOURCE } = require('./pricing');
const { wilson, pairedDiff } = require('./stats');
const { summarise } = require('./score');

const r = runTrial(), f = (x, d = 1) => (+x).toFixed(d);
const note = e => {
  if (!e.ok) return e.error;   // a refused call shows the reason; the audit record also holds the violation
  const a = e.args || {}, x = e.result || {};
  switch (e.tool) {
    case 'task_get': return 'Read the task statement and inputs';
    case 'units_convert': return `${f(a.value, 3)} ${a.from} to ${f(x.value, 3)} ${a.to}`;
    case 'resource_volumetric_mc': return `Monte Carlo, ${x.n.toLocaleString('en-GB')} draws, seed ${x.seed}: P90 ${f(x.p90)}, P50 ${f(x.p50)}, P10 ${f(x.p10)} MWe`;
    case 'files_list': return `${x.files.length} files visible`;
    case 'files_read': return `Read ${a.name} (${x.bytes} bytes)`;
    case 'table_query': return `${a.file}: ${x.rowsMatched} of ${x.rowsTotal} rows matched; ${Object.entries(x.results).map(([k, v]) => k + ' ' + (+v).toFixed(2)).join(', ')}`;
    case 'submit_answer': return x.accepted ? `Accepted on attempt ${x.attempt}` : `Rejected by the review gate: ${x.errors.join('; ')}`;
    default: return '';
  }
};
const slimRow = row => ({ pass: row.pass, correct: row.correct, safe: row.safe, violations: row.violations, firstPass: row.firstPass, category: row.category, gate: row.gate, checks: row.grade.checks, attempts: row.attempts, wallMs: row.summary.wallMs, calls: row.summary.calls,
  trace: row.trace.map(e => ({ i: e.i, tool: e.tool, ok: e.ok, ms: e.ms, note: note(e), hash: e.hash.slice(0, 12) })) });

// one task in metric units and one in field units, to show the unit trap
const metric = r.tasks.find(t => t.inputs.area.unit === 'km2'), field = r.tasks.find(t => t.inputs.area.unit === 'acre');
// one-at-a-time sensitivity: P50-style output with every input at its central value, then one input at its lower and upper limit
const LABEL = { areaKm2: 'Area', thicknessM: 'Thickness', tempC: 'Reservoir temperature', refTempC: 'Reference temperature', rhoC: 'Volumetric heat capacity', recovery: 'Recovery factor', efficiency: 'Conversion efficiency', lifeYears: 'Project life', loadFactor: 'Load factor' };
const mid = d => d.kind === 'fixed' ? d.value : d.kind === 'uniform' ? (d.min + d.max) / 2 : d.mode;
function tornado(task) { const n = normalise(task), base = Object.fromEntries(KEYS.map(k => [k, mid(n[k])])), b = powerMWe(base);
  return { base: b, rows: KEYS.filter(k => n[k].kind !== 'fixed').map(k => ({ key: k, label: LABEL[k], lo: powerMWe({ ...base, [k]: n[k].min }), hi: powerMWe({ ...base, [k]: n[k].max }), min: n[k].min, max: n[k].max })).sort((x, y) => Math.abs(y.hi - y.lo) - Math.abs(x.hi - x.lo)) }; }
const detail = t => ({ id: t.id, inputs: t.inputs, normalised: normalise(t), tornado: tornado(t), reference: t.reference, arms: Object.fromEntries(r.arms.map(a => [a.name, slimRow(a.rows.find(x => x.task === t.id))])) });

// real model runs, if any were saved by run-llm-trial.js: only those on the same tasks (same seed and count) can be compared with the fixtures
const resDir = path.join(__dirname, 'results');
const models = fs.existsSync(resDir) ? fs.readdirSync(resDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(resDir, f), 'utf8'))).filter(m => m.seed === r.seed && m.nTasks === r.nTasks) : [];
const allArms = [...r.arms, ...models.map(m => ({ ...m }))];
const units = r.tasks.map(t => t.inputs.area.unit), bench = a => { const g = (pred) => { const idx = units.map((u, i) => pred(u) ? i : -1).filter(i => i >= 0), k = idx.reduce((s, i) => s + a.rows[i].pass, 0); return { ...wilson(k, idx.length) }; };
  return { metric: g(u => u === 'km2'), field: g(u => u !== 'km2') }; };
const pairs = allArms.slice(1).map(a => ({ a: allArms[0].name, b: a.name, ...pairedDiff(allArms[0].rows.map(x => x.pass), a.rows.map(x => x.pass)) }));
const EST = { inTokens: 25000, outTokens: 3000 };   // the runner's rough per-task assumption, shown only as an estimate
// the other suites, run on their fixture agents; model runs saved by run-llm-trial.js are added to the suite they ran on
const suiteRuns = { resource: r, mining: runSuite('mining'), security: runSuite('security') };
const armSummary = a => ({ name: a.name, kind: a.kind || 'fixture', model: a.model || null, prompt: a.prompt || null, pass: a.pass, correct: a.correct, safe: a.safe, unsafeRuns: a.unsafeRuns, failures: a.failures, cost: a.cost || null });
const savedAll = fs.existsSync(resDir) ? fs.readdirSync(resDir).filter(f => f.endsWith('.json')).map(f => JSON.parse(fs.readFileSync(path.join(resDir, f), 'utf8'))) : [];
const suites = Object.fromEntries(Object.entries(suiteRuns).map(([k, run]) => [k, { nTasks: run.nTasks, arms: [...run.arms.map(armSummary), ...savedAll.filter(m => (m.suite || 'resource') === k && m.nTasks === run.nTasks).map(armSummary)] }]));
const sec = suiteRuns.security, secTask = sec.tasks[0], mn = suiteRuns.mining, minTask = mn.tasks[0];
const rowOf = (run, armPrefix, id) => run.arms.find(a => a.name.startsWith(armPrefix)).rows.find(x => x.task === id);
const gul = rowOf(sec, 'gullible', secTask.id), gTrial = gul.trace, tamper = JSON.parse(JSON.stringify(gTrial)); tamper[2].args = { name: 'edited-after-the-fact' };
const security = { task: secTask.id, injection: require('./packs').INJECTION, canaryShown: 'sk-canary-' + '\u2022'.repeat(8), chain: { length: verifyChain(gTrial).length, head: verifyChain(gTrial).head.slice(0, 16), intact: verifyChain(gTrial).ok, tamperedCall: 3, afterTamper: verifyChain(tamper) },
  arms: Object.fromEntries(sec.arms.map(a => [a.name, slimRow(a.rows.find(x => x.task === secTask.id))])) };
const mining = { id: minTask.id, dom: minTask.dom, cut: minTask.cut, reference: minTask.reference, blocks: minTask.rows.map(b => [b.x, b.y, b.tonnes, b.grade_gpt, b.domain === 'oxide' ? 0 : 1]), procedure: require('./packs').PROCEDURE,
  arms: Object.fromEntries(mn.arms.map(a => [a.name, slimRow(a.rows.find(x => x.task === minTask.id))])) };
const out = {
  synthetic: true, generated: r.generated, nTasks: r.nTasks, seed: r.seed,
  arms: allArms.map(a => ({ name: a.name, kind: a.kind, model: a.model || null, route: a.route || null, pass: a.pass, firstPass: a.firstPass, failures: a.failures, corrected: a.corrected, meanCalls: a.meanCalls, cost: a.cost || null, bench: bench(a), results: a.rows.map(x => x.pass), first: a.rows.map(x => x.firstPass) })),
  prices: { source: SOURCE, models: Object.entries(PRICES).map(([id, p]) => ({ id, name: p.name, inPerM: p.inPerM, outPerM: p.outPerM, note: p.note || null, estimatePerTask: (EST.inTokens * p.inPerM + EST.outTokens * p.outPerM) / 1e6 })), estimate: EST },
  tools: Object.entries(TOOLS).map(([name, t]) => ({ name, description: t.description })),
  pairs, taskIds: r.tasks.map(t => t.id), taskUnits: r.tasks.map(t => t.inputs.area.unit),
  detail: { [metric.id]: detail(metric), [field.id]: detail(field) }, suites, security, mining,
};
const file = path.join(__dirname, '..', 'mockups', 'suite', 'build-sample.js');
fs.writeFileSync(file, '// Generated by harness/export-sample.js: a synthetic trial run by the harness. Do not edit.\nwindow.BUILD_SAMPLE = ' + JSON.stringify(out) + ';\n');
console.log('wrote', path.relative(process.cwd(), file), (fs.statSync(file).size / 1024).toFixed(0) + ' KB', 'tasks', out.nTasks, 'detail', Object.keys(out.detail).join(', '));
