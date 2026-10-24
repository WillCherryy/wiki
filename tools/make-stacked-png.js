#!/usr/bin/env node
'use strict';
// Renders the stacked logo (five dots above the plain word) as 2000x2000 PNGs in brand/stacked/: light, dark and transparent.
const fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const brand = path.join(__dirname, '..', 'brand'), out = path.join(brand, 'stacked'); fs.mkdirSync(out, { recursive: true });
const JOBS = [['stacked-light', 'logo-stacked.svg', '#f3eee4'], ['stacked-dark', 'logo-stacked-transparent-on-dark.svg', '#16130f'], ['stacked-transparent', 'logo-stacked.svg', null], ['stacked-transparent-on-dark', 'logo-stacked-transparent-on-dark.svg', null]];
(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 2000, height: 2000 } });
  for (const [name, file, bg] of JOBS) {
    const svg = fs.readFileSync(path.join(brand, file)).toString('base64');
    await p.setContent(`<body style="margin:0;background:${bg || 'transparent'};display:grid;place-items:center;width:2000px;height:2000px"><img src="data:image/svg+xml;base64,${svg}" style="width:1500px;display:block">`);
    await p.screenshot({ path: path.join(out, name + '.png'), omitBackground: !bg });
  }
  await b.close(); console.log('wrote', JOBS.map(j => j[0]).join(', '));
})();
