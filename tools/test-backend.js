#!/usr/bin/env node
'use strict';
// Runs the Build backend's type-check and tests (backend/ has its own package.json and `npm install`). Skipped, with a note, when its
// dependencies are not installed. The runtime smoke test (backend/scripts/smoke.mjs, against `wrangler dev`) is run by hand.
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const dir = path.join(__dirname, '..', 'backend');
if (!fs.existsSync(path.join(dir, 'node_modules', 'typescript'))) { console.log('ok: build backend (skipped: run "npm install" in backend/ to enable)'); process.exit(0); }
for (const [label, args] of [['type-check', ['run', 'typecheck']], ['tests', ['test']]]) {
  const r = spawnSync('npm', args, { cwd: dir, encoding: 'utf8', shell: process.platform === 'win32' });
  if (r.status !== 0) { console.error(`build backend ${label} failed:\n` + (r.stdout || '') + (r.stderr || '')); process.exit(1); }
  if (label === 'tests') { const m = /ℹ pass (\d+)/.exec(r.stdout || ''); console.log(`ok: build backend (strict type-check clean; ${m ? m[1] : '?'} tests: chain compatibility with the JS harness, tools, sandbox, policy, model loop, persistence, performance guards)`); }
}
