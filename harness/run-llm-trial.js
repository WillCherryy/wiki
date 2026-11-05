#!/usr/bin/env node
'use strict';
// Run a Claude model over the synthetic tasks through the harness (route 1) and save a scorecard to harness/results/.
//   ANTHROPIC_API_KEY=... node harness/run-llm-trial.js --model claude-haiku-5-5 --n 24 --max-cost 1 --yes
// Spends real money. Without --yes it prints the estimate and stops. --max-cost caps the spend of the whole run.
const fs = require('fs'), path = require('path');
const { generate, reference } = require('./tasks');
const { createHttp } = require('./mcp');
const { runModelAgent } = require('./llm-agent');
const { scoreRow, summarise } = require('./score');
const { PRICES, SOURCE, trialCost } = require('./pricing');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const model = arg('model', 'claude-opus-5-5'), n = +arg('n', 24), maxCost = +arg('max-cost', 1), yes = process.argv.includes('--yes'), seed = 20261105;
const EST = { inTokens: 25000, outTokens: 3000 };   // rough per-task assumption, to be replaced by the measured mean after the first run

async function main() {
  if (!PRICES[model]) { console.error(`No price for ${model}. Known: ${Object.keys(PRICES).join(', ')}`); process.exit(1); }
  const p = PRICES[model], est = n * (EST.inTokens * p.inPerM + EST.outTokens * p.outPerM) / 1e6;
  console.log(`${p.name}: ${n} tasks. Rough estimate $${est.toFixed(2)} (assumes ${EST.inTokens.toLocaleString()} input and ${EST.outTokens.toLocaleString()} output tokens per task; prices ${SOURCE}). Spend cap $${maxCost.toFixed(2)}.`);
  if (!yes) { console.log('Not running: add --yes to spend this.'); return; }
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN) { console.error('No credentials: set ANTHROPIC_API_KEY (as an environment variable or secret; never paste it into a chat).'); process.exit(2); }
  const tasks = generate(n, seed), h = createHttp(), port = await h.listen(), url = `http://127.0.0.1:${port}/mcp`, rows = []; let spent = 0;
  for (const task of tasks) {
    if (spent > maxCost) { console.log(`Spend cap reached after ${rows.length} tasks; stopping.`); break; }
    const { trial, token } = h.open(task); let run = null, error = null;
    try { run = await runModelAgent({ model, url, token, trial, maxCostUsd: Math.max(0, maxCost - spent) }); } catch (e) { error = e.message; }
    const cost = run ? trialCost(model, run.calls) : null; if (cost) spent += cost.total;
    rows.push(scoreRow(task, trial, error, { stopReason: run && run.stopReason, turns: run && run.turns, cost }));
    console.log(`${task.id} ${rows[rows.length - 1].pass ? 'pass' : 'fail'}${run ? ' · ' + run.stopReason + ' · $' + cost.total.toFixed(4) : ' · error ' + error}`);
  }
  await h.close();
  const costs = rows.map(r => r.cost).filter(Boolean), sum = k => costs.reduce((s, c) => s + c[k], 0);
  const arm = summarise(p.name, rows, { kind: 'model', model, route: 'remote MCP', nTasks: rows.length, seed, generated: new Date().toISOString().slice(0, 10),
    cost: { inputTokens: sum('inputTokens'), outputTokens: sum('outputTokens'), input: sum('input'), output: sum('output'), total: sum('total'), perTask: sum('total') / rows.length, perCorrect: rows.some(r => r.pass) ? sum('total') / rows.reduce((s, r) => s + r.pass, 0) : null, source: SOURCE, tokensLabel: 'self-reported' } });
  const dir = path.join(__dirname, 'results'); fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${model}-${arm.generated}.json`); fs.writeFileSync(file, JSON.stringify(arm, null, 1));
  const pc = x => (x * 100).toFixed(0) + ' %';
  console.log(`\n${p.name}: pass ${pc(arm.pass.rate)} (${pc(arm.pass.lo)} to ${pc(arm.pass.hi)}), first attempt ${pc(arm.firstPass.rate)}, $${arm.cost.total.toFixed(2)} total, $${arm.cost.perTask.toFixed(4)} per task${arm.cost.perCorrect ? ', $' + arm.cost.perCorrect.toFixed(4) + ' per correct answer' : ''}\nSaved ${path.relative(process.cwd(), file)}`);
}
main().catch(e => { console.error(e); process.exit(1); });
