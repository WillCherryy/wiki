#!/usr/bin/env node
'use strict';
// Check a customer's task spec, and optionally run a Claude model on it (route 1, over MCP) with its own policy and limits.
//   node harness/run-spec.js task.json --check                       validate; show what the agent will see; spend nothing
//   ANTHROPIC_API_KEY=... node harness/run-spec.js task.json --model claude-haiku-5-5 --yes [--prompt hardened]
const { loadSpec } = require('./taskspec');
const { Trial, call, verifyChain } = require('./gateway');
const { createHttp } = require('./mcp');
const { runModelAgent, SYSTEMS } = require('./llm-agent');
const { scoreRow } = require('./score');
const { PRICES, trialCost } = require('./pricing');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
async function main() {
  const file = process.argv[2]; if (!file || file.startsWith('--')) { console.error('usage: run-spec.js task.json [--check | --model M --yes]'); process.exit(1); }
  let task; try { task = loadSpec(file); } catch (e) { console.error('Spec problem: ' + e.message); process.exit(1); }
  if (process.argv.includes('--check')) {
    const t = new Trial('check', task), seen = call(t, 'task_get');
    console.log(`Spec is valid: ${task.id}, ${task.files.length} files (${task.files.filter(f => f.sensitivity === 'restricted').length} restricted, ${task.security ? task.security.canaries.length : 0} secret values guarded).`);
    console.log('Tools this trial may call:', task.policy && task.policy.tools ? task.policy.tools.join(', ') + ' (plus task_get, submit_answer)' : 'all');
    console.log('What the agent sees:\n' + JSON.stringify(seen, null, 2)); return;
  }
  const model = arg('model', 'claude-haiku-5-5'), p = PRICES[model], prompt = arg('prompt', 'hardened'), maxCost = task.limits && task.limits.maxCostUsd || 0.25;
  if (!p) { console.error('No price for ' + model); process.exit(1); }
  console.log(`${p.name} on ${task.id}, ${prompt} prompt. Spend cap $${maxCost.toFixed(2)}.`);
  if (!process.argv.includes('--yes')) { console.log('Not running: add --yes to spend.'); return; }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) { console.error('No credentials: set ANTHROPIC_API_KEY as an environment variable.'); process.exit(2); }
  const h = createHttp(), port = await h.listen(), { trial, token } = h.open(task); let run, error = null;
  try { run = await runModelAgent({ model, url: `http://127.0.0.1:${port}/mcp`, token, trial, maxCostUsd: maxCost, system: SYSTEMS[prompt] }); } catch (e) { error = e.message; }
  await h.close(); const cost = run ? trialCost(model, run.calls) : null, row = scoreRow(task, trial, error, { stopReason: run && run.stopReason, cost });
  console.log(`${row.pass ? 'PASS' : 'FAIL'}${row.category ? ' (' + row.category + ')' : ''} · ${trial.trace.length} calls · ${cost ? '$' + cost.total.toFixed(4) : ''} · audit chain ${verifyChain(trial.trace).ok ? 'intact' : 'BROKEN'}`);
  row.grade.checks.forEach(c => console.log(' ', c.ok ? 'ok  ' : 'FAIL', c.name, '-', c.detail)); row.violations.forEach(v => console.log('  violation:', v.type, v.detail));
}
main().catch(e => { console.error(e); process.exit(1); });
