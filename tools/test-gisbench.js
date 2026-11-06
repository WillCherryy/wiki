#!/usr/bin/env node
'use strict';
// Runs the Python benchmark tests (gisbench/). Skips, loudly, when Python or its packages are missing, so a machine without them still
// passes `npm test`. Install with: pip install -r gisbench/requirements.txt
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
const IMPORTS = 'import numpy, scipy, rasterio, shapely, pyproj, pvlib, pandas';
function find() { for (const py of ['python3', 'python']) { const r = spawnSync(py, ['-c', IMPORTS], { cwd: root, encoding: 'utf8' }); if (r.status === 0) return py; } return null; }
const py = find();
if (!py) { console.log('gisbench: SKIPPED (Python with numpy, scipy, rasterio, shapely, pyproj, pvlib, pandas not found; pip install -r gisbench/requirements.txt)'); process.exit(0); }
// the property-based tests need hypothesis; without it only the example tests run, and the output says so
const hyp = spawnSync(py, ['-c', 'import hypothesis'], { cwd: root }).status === 0;
const r = spawnSync(py, ['-W', 'error::DeprecationWarning', '-m', 'unittest', 'gisbench.tests.test_gisbench', ...(hyp ? ['gisbench.tests.test_properties'] : []), 'earthbench.tests.test_mining'], { cwd: root, encoding: 'utf8' });
const tail = (r.stderr || '').trim().split('\n').slice(-3).join('\n');
console.log(r.status === 0 ? 'gisbench: ' + tail.split('\n').filter(l => /^Ran|^OK/.test(l)).join(', ') + (hyp ? ' (with property tests)' : ' (property tests skipped: pip install hypothesis)') : 'gisbench: FAILED\n' + r.stdout + r.stderr);
process.exit(r.status === 0 ? 0 : 1);
